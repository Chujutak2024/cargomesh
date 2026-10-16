"""Opt-in local Nova 2.5 Sonic voice comparison; no CargoMesh mutations."""

from __future__ import annotations

import argparse
import asyncio
import sys

import boto3

from strands_gemini_live import SYSTEM_PROMPT

MODEL_ID = "amazon.nova-2-5-sonic"
DEFAULT_VOICE = "tiffany"
DEFAULT_PROFILE = "cargomesh-bedrock"
REGION = "us-east-1"
MAX_SECONDS = 180


async def run_pilot(seconds: int, voice: str, profile: str) -> None:
    from strands.bidi import BidiAgent
    from strands.bidi.io import AudioIO
    from strands.bidi.models import BedrockNovaSonicModel

    session = boto3.Session(profile_name=profile, region_name=REGION)
    agent = BidiAgent(
        model=BedrockNovaSonicModel(
            model_id=MODEL_ID,
            boto_session=session,
            voice=voice,
        ),
        system_prompt=SYSTEM_PROMPT,
    )
    audio_io = AudioIO(audio_processor=True)
    try:
        await asyncio.wait_for(
            agent.run(inputs=[audio_io.input()], outputs=[audio_io.output()]),
            timeout=seconds,
        )
    except asyncio.TimeoutError:
        agent.cancel()
        print("Pilot time limit reached.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compare Strands + Nova 2.5 Sonic voice locally")
    parser.add_argument("--check", action="store_true", help="Check local setup without invoking Bedrock")
    parser.add_argument("--seconds", type=int, default=90, help="Session cap, 1-180 seconds")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--profile", default=DEFAULT_PROFILE)
    args = parser.parse_args(argv)
    if not 1 <= args.seconds <= MAX_SECONDS:
        parser.error(f"--seconds must be between 1 and {MAX_SECONDS}")
    try:
        session = boto3.Session(profile_name=args.profile, region_name=REGION)
        if session.get_credentials() is None:
            raise RuntimeError("AWS profile has no credentials")
        if args.check:
            from strands.bidi.models import BedrockNovaSonicModel

            print(f"Ready to test {MODEL_ID} in {REGION} with voice {args.voice}; no model call was made.")
            return 0
        asyncio.run(run_pilot(args.seconds, args.voice, args.profile))
    except (ImportError, RuntimeError, ValueError) as exc:
        print(f"Nova pilot setup failed: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Pilot stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
