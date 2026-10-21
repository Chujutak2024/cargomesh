import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from nova_voice_gateway import BrowserOutput, handle, _used_grants
from test_nova_voice_gateway import signed, SECRET

class ResponseFinishTests(unittest.IsolatedAsyncioTestCase):
    async def test_boundary_is_sent_before_response_is_declared_idle(self):
        class Socket:
            async def send(self, value):
                if json.loads(value)["type"] == "response_end":
                    self.assert_not_idle = not output.response_idle.is_set()
        socket=Socket(); output=BrowserOutput(socket)
        await output({"type":"bidi_response_start","response_id":"one"})
        self.assertFalse(output.response_idle.is_set())
        await output({"type":"bidi_response_stop","response_id":"one"})
        self.assertTrue(socket.assert_not_idle);self.assertTrue(output.response_idle.is_set())

    async def test_soft_session_limit_waits_for_current_response_to_finish(self):
        class Socket:
            request=SimpleNamespace(path="/voice")
            state=SimpleNamespace(name="OPEN")
            def __init__(self):self.messages=[]
            async def recv(self):return json.dumps({"type":"auth","token":signed(jti="finish-response")})
            async def send(self, value):self.messages.append(json.loads(value)["type"])
            async def close(self, code=1000):self.messages.append("close");self.state=SimpleNamespace(name="CLOSED")
        class Agent:
            async def run(self, outputs, **kwargs):
                await outputs[0]({"type":"bidi_response_start","response_id":"one"})
                await asyncio.sleep(.05)
                await outputs[0]({"type":"bidi_response_stop","response_id":"one"})
                await asyncio.Future()
            def cancel(self):pass
        _used_grants.clear();socket=Socket()
        with patch("nova_voice_gateway.boto3.Session"),patch("nova_voice_gateway.BedrockNovaSonicModel"),patch("nova_voice_gateway.BidiAgent",return_value=Agent()),patch("nova_voice_gateway.SESSION_SECONDS",.01):
            await handle(socket,SECRET,None)
        self.assertEqual(socket.messages,["response_start","session_limit","response_end","close"])
