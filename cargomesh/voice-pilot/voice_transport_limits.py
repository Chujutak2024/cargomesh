"""Separate the signed context envelope budget from the binary microphone frame budget."""
MAX_AUTH_BYTES = 64 * 1024

def valid_auth_frame(frame: object) -> bool:
    return isinstance(frame, str) and 0 < len(frame.encode("utf-8")) <= MAX_AUTH_BYTES
