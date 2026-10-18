import json
import time
import unittest
from unittest.mock import patch

import jwt

from nova_voice_gateway import AUDIENCE, ISSUER, BrowserInput, BrowserOutput, _used_grants, handle, validate_network, verify_grant
from cargomesh_voice_prompt import voice_prompt

SECRET = "local-test-secret-at-least-thirty-two-characters"


def signed(*, audience=AUDIENCE, expires=45, jti="one"):
    now = int(time.time())
    return jwt.encode(
        {
            "iss": ISSUER,
            "aud": audience,
            "sub": "test-user",
            "memberId": "test-member",
            "organizationId": "test-org",
            "jti": jti,
            "iat": now,
            "exp": now + expires,
        },
        SECRET,
        algorithm="HS256",
    )


class VoiceGrantTests(unittest.TestCase):
    def setUp(self):
        _used_grants.clear()

    def test_valid_grant_is_bound_to_identity_and_one_use(self):
        claims = verify_grant(signed(), SECRET)
        self.assertEqual(claims["organizationId"], "test-org")
        with self.assertRaises(jwt.InvalidTokenError):
            verify_grant(signed(), SECRET)

    def test_wrong_audience_is_rejected(self):
        with self.assertRaises(jwt.InvalidTokenError):
            verify_grant(signed(audience="other"), SECRET)

    def test_expired_grant_is_rejected(self):
        with self.assertRaises(jwt.ExpiredSignatureError):
            verify_grant(signed(expires=-1), SECRET)

    def test_short_secret_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_grant(signed(), "too-short")

    def test_customer_prompt_guides_a_real_request_without_pilot_language(self):
        prompt = voice_prompt({"role": "shipper"})
        self.assertIn("freight request", prompt)
        self.assertIn("Review spoken request details", prompt)
        self.assertIn("voice session cannot directly populate", prompt)
        self.assertNotIn("comparison", prompt)

    def test_customer_prompt_keeps_latest_correction_across_sessions(self):
        prompt = voice_prompt({"role": "shipper", "voiceContext": [
            "Customer: from Lima to Piura",
            "Customer: sorry, from Lima to Santiago Chile",
            "Customer: 2000 kilograms, fragile handling",
        ]})
        self.assertIn("Lima to Santiago Chile", prompt)
        self.assertIn("2000 kilograms, fragile handling", prompt)
        self.assertIn("use the latest correction", prompt)
        self.assertIn("Never claim that a field was accepted", prompt)

    def test_customer_prompt_distinguishes_missing_facility_from_carrier_coverage(self):
        prompt = voice_prompt({"role": "shipper", "facilityCatalog": {
            "complete": True, "locations": ["Lima, PE", "Arequipa, PE"],
        }})
        self.assertIn("Lima, PE", prompt)
        self.assertIn("no saved facility there", prompt)
        self.assertIn("Do not say there are no carriers or companies there", prompt)
        incomplete = voice_prompt({"role": "shipper", "facilityCatalog": {"complete": False, "locations": []}})
        self.assertIn("do not infer absence", incomplete)

    def test_carrier_prompt_uses_only_scoped_request_and_does_not_invent_a_quote(self):
        prompt = voice_prompt({"role": "carrier", "opportunity": {
            "route": "Lima to Arequipa", "cargo": "GENERAL", "responseDeadline": "2026-10-20",
        }})
        self.assertIn("Lima to Arequipa", prompt)
        self.assertIn("no verified tariff", prompt)
        self.assertIn("review and submit it on screen", prompt)
        with self.assertRaises(ValueError):
            voice_prompt({"role": "carrier"})

    def test_shipper_offer_prompt_requires_server_briefing_and_keeps_booking_explicit(self):
        prompt = voice_prompt({"role": "shipper_offers", "offerBriefing": "Two current offers; option 1 is ranked first.",
                               "voiceContext": ["Customer: why option one?"]})
        self.assertIn("option 1 is ranked first", prompt)
        self.assertIn("why option one?", prompt)
        self.assertIn("explicitly select", prompt)
        with self.assertRaises(ValueError):
            voice_prompt({"role": "shipper_offers"})


class VoiceTranscriptTests(unittest.IsolatedAsyncioTestCase):
    async def test_timeout_emits_renewal_signal_without_claiming_provider_errors_are_renewable(self):
        class Socket:
            request = type("Request", (), {"path": "/voice"})()

            def __init__(self):
                self.state = type("State", (), {"name": "OPEN"})()
                self.messages = []
                self.closed = None

            async def recv(self):
                return json.dumps({"type": "auth", "token": signed()})

            async def send(self, message):
                self.messages.append(json.loads(message))

            async def close(self, code, reason=None):
                self.closed = code
                self.state.name = "CLOSED"

        class Agent:
            async def run(self, **_kwargs):
                raise TimeoutError

            def cancel(self):
                pass

        _used_grants.clear()
        socket = Socket()
        with patch("nova_voice_gateway.boto3.Session"), patch("nova_voice_gateway.BedrockNovaSonicModel"), patch("nova_voice_gateway.BidiAgent", return_value=Agent()):
            await handle(socket, SECRET, None)
        self.assertEqual(socket.messages, [{"type": "session_limit"}])
        self.assertEqual(socket.closed, 1000)

    async def test_carrier_opening_is_one_text_turn_before_microphone_audio(self):
        class Socket:
            async def recv(self):
                return b"\x00\x00"

        input_stream = BrowserInput(Socket(), "Brief me on this opportunity.")
        self.assertEqual(await input_stream(), "Brief me on this opportunity.")
        self.assertEqual((await input_stream()).source["bytes"], b"\x00\x00")

    async def test_partial_and_final_transcripts_retain_same_content_id(self):
        class Socket:
            def __init__(self):
                self.messages = []

            async def send(self, message):
                self.messages.append(json.loads(message))

        socket = Socket()
        output = BrowserOutput(socket)
        await output({"type": "bidi_transcript_delta", "role": "user", "content_id": "turn-1", "delta": "I need"})
        await output({"type": "bidi_transcript_block", "role": "user", "content_id": "turn-1", "transcript": "I need a truck"})
        self.assertEqual([message["type"] for message in socket.messages], ["transcript_delta", "transcript"])
        self.assertEqual([message["contentId"] for message in socket.messages], ["turn-1", "turn-1"])


class DeploymentConfigurationTests(unittest.TestCase):
    def test_local_mode_rejects_network_bind(self):
        with self.assertRaises(ValueError):
            validate_network("0.0.0.0", "http://localhost:3218", False, None)

    def test_deployment_requires_https_and_task_role(self):
        for origin, profile in [("http://example.com", None), ("https://example.com", "local-profile")]:
            with self.subTest(origin=origin, profile=profile), self.assertRaises(ValueError):
                validate_network("0.0.0.0", origin, True, profile)
        validate_network("0.0.0.0", "https://preview.example.com", True, None)

    def test_origin_rejects_path_or_query(self):
        with self.assertRaises(ValueError):
            validate_network("0.0.0.0", "https://example.com/other", True, None)
        with self.assertRaises(ValueError):
            validate_network("0.0.0.0", "https://example.com?token=x", True, None)


if __name__ == "__main__":
    unittest.main()
