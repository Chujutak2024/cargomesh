"""Opt-in local voice comparison for CargoMesh; it cannot mutate freight data."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

DEFAULT_MODEL = "gemini-3.8-live"
DEFAULT_VOICE = "Kore"
MAX_SECONDS = 180

SYSTEM_PROMPT = """You are the CargoMesh voice comparison assistant. Speak in natural,
concise English. Help a business user understand how to describe a freight request,
one detail at a time. You can explain what CargoMesh is intended to do, but you
have no connection to a user's account or live carrier inventory in this pilot.
Never claim that a request was saved, a carrier is available, a quote is confirmed,
or a booking was made. If asked for an action, explain that this voice comparison
cannot perform it and direct the user to the existing CargoMesh chat or request form.
Ask a useful follow-up question instead of repeating a fixed fallback sentence.
"""


def configuration_error() -> str | None:
    if not os.environ.get("GOOGLE_API_KEY", "").strip():
        return "GOOGLE_API_KEY is missing. Set it privately in this terminal before starting the pilot."
    return None


async def run_pilot(seconds: int, model_id: str, voice: str) -> None:
    # Import only for a real session so --check never needs paid SDK dependencies.
    from strands.bidi import BidiAgent
    from strands.bidi.io import AudioIO
    from strands.bidi.models import GoogleGeminiLiveModel

    agent = BidiAgent(
        model=GoogleGeminiLiveModel(model_id=model_id, voice=voice),
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
    parser = argparse.ArgumentParser(description="Compare Strands + Gemini Live voice locally")
    parser.add_argument("--check", action="store_true", help="Check configuration without invoking Gemini")
    parser.add_argument("--seconds", type=int, default=90, help="Maximum paid session duration, 1-180 seconds")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    args = parser.parse_args(argv)
    if not 1 <= args.seconds <= MAX_SECONDS:
        parser.error(f"--seconds must be between 1 and {MAX_SECONDS}")
    error = configuration_error()
    if error:
        print(error, file=sys.stderr)
        return 2
    if args.check:
        print(f"Ready to test {args.model} with voice {args.voice}; no provider call was made.")
        return 0
    try:
        asyncio.run(run_pilot(args.seconds, args.model, args.voice))
    except ImportError:
        print("Strands audio dependencies are missing. Install the packages in requirements.txt.", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Pilot stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
