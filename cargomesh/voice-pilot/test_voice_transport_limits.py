import unittest
from voice_transport_limits import MAX_AUTH_BYTES, valid_auth_frame
class VoiceEnvelopeTests(unittest.TestCase):
    def test_catalog_grants_larger_than_old_4k_limit_are_allowed(self):
        self.assertTrue(valid_auth_frame('{"type":"auth","token":"'+'x'*8000+'"}'))
    def test_auth_budget_is_bounded_by_utf8_bytes(self):
        self.assertFalse(valid_auth_frame(b"audio"))
        self.assertFalse(valid_auth_frame(""))
        self.assertTrue(valid_auth_frame("x"*MAX_AUTH_BYTES))
        self.assertFalse(valid_auth_frame("x"*(MAX_AUTH_BYTES+1)))
        self.assertFalse(valid_auth_frame("á"*(MAX_AUTH_BYTES//2+1)))
