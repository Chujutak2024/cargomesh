"""Authenticated WebSocket bridge from browser PCM audio to Nova 2.5 Sonic.

No CargoMesh business tools are exposed by this first transport slice.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from typing import Any
from urllib.parse import urlparse

import boto3
import jwt
from jwt import InvalidTokenError
from strands.bidi import BidiAgent
from strands.bidi.models import BedrockNovaSonicModel
from strands.bidi.types.media import AudioDelta
from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

from cargomesh_voice_prompt import voice_prompt
from voice_transport_limits import MAX_AUTH_BYTES, valid_auth_frame

ISSUER = "cargomesh-web"
AUDIENCE = "cargomesh-voice-gateway"
MODEL_ID = "amazon.nova-2-5-sonic"
REGION = os.environ.get("AWS_REGION", "us-east-1")
VOICE = "tiffany"
MAX_AUDIO_FRAME = 8192
MAX_SESSIONS = 2
SESSION_SECONDS = 240
_used_grants: dict[str, int] = {}
_slots = asyncio.Semaphore(MAX_SESSIONS)


def verify_grant(token: str, secret: str, now: int | None = None) -> dict[str, Any]:
    """Validate a signed, short-lived web grant and reject replay."""
    if len(secret.encode()) < 32:
        raise ValueError("Voice bridge secret must be at least 32 bytes")
    claims = jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience=AUDIENCE,
        issuer=ISSUER,
        options={"require": ["exp", "iat", "jti", "sub", "organizationId", "memberId"]},
        leeway=0,
    )
    current = now if now is not None else int(time.time())
    for key, expires_at in list(_used_grants.items()):
        if expires_at < current:
            del _used_grants[key]
    if not all(isinstance(claims[key], str) and claims[key] for key in ("jti", "sub", "organizationId", "memberId")):
        raise InvalidTokenError("Invalid voice grant claims")
    if claims["jti"] in _used_grants:
        raise InvalidTokenError("Voice grant already used")
    _used_grants[claims["jti"]] = claims["exp"]
    return claims


class BrowserInput:
    def __init__(self, socket: ServerConnection, opening: str | None = None):
        self.socket = socket
        self.opening = opening

    async def __call__(self) -> str | AudioDelta:
        if self.opening is not None:
            opening, self.opening = self.opening, None
            return opening
        packet = await self.socket.recv()
        if not isinstance(packet, bytes) or not 0 < len(packet) <= MAX_AUDIO_FRAME or len(packet) % 2:
            raise ValueError("Expected a bounded 16-bit PCM audio frame")
        return AudioDelta(format="pcm", source={"bytes": packet})


class BrowserOutput:
    def __init__(self, socket: ServerConnection):
        self.socket = socket
        self.lock = asyncio.Lock()

    async def __call__(self, event: dict[str, Any]) -> None:
        kind = event.get("type")
        if kind == "bidi_audio_delta":
            payload = {
                "type": "audio",
                "audio": event["audio"],
                "format": event["format"],
                "sampleRate": event["sample_rate"],
                "channels": event["channels"],
            }
        elif kind == "bidi_transcript_block":
            payload = {"type": "transcript", "role": event["role"], "contentId": event["content_id"], "text": event["transcript"]}
        elif kind == "bidi_transcript_delta":
            payload = {"type": "transcript_delta", "role": event["role"], "contentId": event["content_id"], "delta": event["delta"]}
        elif kind == "bidi_text_block":
            payload = {"type": "text", "text": event["text"]}
        elif kind == "bidi_barge_in":
            payload = {"type": "barge_in"}
        elif kind == "bidi_connection_start":
            payload = {"type": "ready"}
        else:
            return
        async with self.lock:
            await self.socket.send(json.dumps(payload))


async def handle(socket: ServerConnection, secret: str, profile: str | None) -> None:
    if socket.request.path not in {"/", "/voice"}:
        await socket.close(code=1008, reason="Invalid voice path")
        return
    try:
        first = await asyncio.wait_for(socket.recv(), timeout=5)
        if not valid_auth_frame(first):
            raise InvalidTokenError("Missing voice grant")
        envelope = json.loads(first)
        if not isinstance(envelope, dict) or envelope.get("type") != "auth" or not isinstance(envelope.get("token"), str):
            raise InvalidTokenError("Missing voice grant")
        claims = verify_grant(envelope["token"], secret)
    except (asyncio.TimeoutError, ValueError, InvalidTokenError, ConnectionClosed):
        await socket.close(code=1008, reason="Invalid voice session")
        return

    if _slots.locked():
        await socket.close(code=1013, reason="Voice capacity reached")
        return
    async with _slots:
        session = boto3.Session(profile_name=profile, region_name=REGION) if profile else boto3.Session(region_name=REGION)
        agent = BidiAgent(
            model=BedrockNovaSonicModel(model_id=MODEL_ID, boto_session=session, voice=VOICE),
            system_prompt=voice_prompt(claims),
        )
        try:
            await asyncio.wait_for(
                agent.run(inputs=[BrowserInput(socket, "Brief me on this opportunity and ask if I want to prepare an offer." if claims.get("role") == "carrier" else "Tell me what offers arrived, which ranked option you recommend, and why." if claims.get("role") == "shipper_offers" else None)], outputs=[BrowserOutput(socket)]),
                timeout=SESSION_SECONDS,
            )
        except asyncio.TimeoutError:
            agent.cancel()
            if socket.state.name == "OPEN":
                await socket.send(json.dumps({"type": "session_limit"}))
        except ConnectionClosed:
            agent.cancel()
        except Exception:
            # Do not log audio, identity, token, prompt or provider payload.
            if socket.state.name == "OPEN":
                await socket.send(json.dumps({"type": "error", "message": "Voice session ended. Continue by text."}))
        finally:
            if socket.state.name == "OPEN":
                await socket.close(code=1000)


def validate_network(host: str, origin: str, deploy: bool, profile: str | None) -> None:
    local = host in {"127.0.0.1", "::1", "localhost"}
    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"} or parsed.params or parsed.query or parsed.fragment:
        raise ValueError("Origin must be an exact HTTP(S) origin")
    if deploy:
        if local or parsed.scheme != "https" or profile:
            raise ValueError("Deployment requires a non-loopback bind, HTTPS origin and an IAM task role")
    elif not local:
        raise ValueError("Local mode must bind to loopback")


async def main(host: str, port: int, origin: str, profile: str | None, secret: str, deploy: bool = False) -> None:
    validate_network(host, origin, deploy, profile)

    def health(socket: ServerConnection, request: Any) -> Any:
        if request.path == "/healthz":
            return socket.respond(200, "ok\n")
        return None

    async with serve(lambda socket: handle(socket, secret, profile), host, port,
                     origins=[origin], process_request=health, max_size=MAX_AUTH_BYTES,
                     compression=None, server_header=None):
        print(f"Nova voice bridge listening on {host}:{port}; origin {origin}")
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CargoMesh Nova voice bridge")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--origin", default="http://localhost:3218")
    parser.add_argument("--profile", default=None)
    parser.add_argument("--deploy", action="store_true", help="Use an IAM task role behind an HTTPS/WSS proxy")
    args = parser.parse_args()
    secret = os.environ.get("CARGOMESH_VOICE_BRIDGE_SECRET", "")
    if len(secret.encode()) < 32:
        parser.error("Set CARGOMESH_VOICE_BRIDGE_SECRET privately (at least 32 bytes)")
    try:
        validate_network(args.host, args.origin, args.deploy, args.profile)
    except ValueError as exc:
        parser.error(str(exc))
    asyncio.run(main(args.host, args.port, args.origin, args.profile, secret, args.deploy))
