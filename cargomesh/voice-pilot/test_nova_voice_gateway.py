import json
import time
import unittest

import jwt

from nova_voice_gateway import AUDIENCE, ISSUER, BrowserInput, BrowserOutput, _used_grants, validate_network, verify_grant
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
        self.assertIn("review step", prompt)
        self.assertNotIn("comparison", prompt)

    def test_carrier_prompt_uses_only_scoped_request_and_does_not_invent_a_quote(self):
        prompt = voice_prompt({"role": "carrier", "opportunity": {
            "route": "Lima to Arequipa", "cargo": "GENERAL", "responseDeadline": "2026-10-20",
        }})
        self.assertIn("Lima to Arequipa", prompt)
        self.assertIn("no verified tariff", prompt)
        self.assertIn("review and submit it on screen", prompt)
        with self.assertRaises(ValueError):
            voice_prompt({"role": "carrier"})


class VoiceTranscriptTests(unittest.IsolatedAsyncioTestCase):
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
