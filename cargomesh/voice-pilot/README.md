# Strands + Gemini Live voice comparison

For a shared, authenticated Nova staging site, see [the Nova voice deployment recipe](../../../docs/v2-amazon/delivery/NOVA_VOICE_STAGING_DEPLOYMENT.md). The gateway container uses an IAM task role and HTTPS/WSS; the local PowerShell pilot still uses the developer's AWS profile.

This is a local voice comparison and browser pilot, separate from the Alexa+ MCP channel. It does not read an account, call business tools, save requests, quote carriers or book transport. When the local Nova flag is enabled, Nova is the Web chat's default **spoken** path; typed messages still use the existing structured chat.

Strands `BidiAgent` orchestrates the session; Google Gemini Live supplies recognition and a selectable spoken voice. The default is `Kore` for a first female-voice comparison. Google usage is billed separately from AWS credits. The pilot stops after 90 seconds by default and never exceeds 180 seconds per run.

From this directory, use a private Python environment:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:GOOGLE_API_KEY = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
.\.venv\Scripts\python.exe strands_gemini_live.py --check
.\.venv\Scripts\python.exe strands_gemini_live.py --seconds 90
```

The key is read from the terminal environment and is never committed or printed. Clear the session variable after testing with `Remove-Item Env:GOOGLE_API_KEY`. The repository ignores `.venv/`; do not place a key in `NEXT_PUBLIC_*` or browser code. Use headphones if acoustic echo interrupts the agent. Assess English pronunciation, interruptions, transcript accuracy, natural follow-up and cost against the browser/Zira baseline.

This pilot is **not** the production voice path. Before enabling it in the Web chat, add an authenticated browser-to-Python audio bridge, keep existing chat/application services authoritative, require confirmation before freight mutations, and test tenant boundaries, error recovery and cost limits. Alexa+ speaks through its own client and calls the CargoMesh MCP server; this local pilot cannot certify Alexa+.

Sources: [Strands Bidi Quickstart](https://strandsagents.com/docs/user-guide/sdk/bidi/quickstart/), [Google Gemini Live model](https://strandsagents.com/docs/user-guide/sdk/bidi/models/google/), [Strands I/O](https://strandsagents.com/docs/user-guide/sdk/bidi/io/).

## Compare Amazon Nova 2.5 Sonic

The optional `strands_nova_sonic.py` uses the **same CargoMesh pilot prompt** as Gemini, but runs through Amazon Bedrock using the local `cargomesh-bedrock` AWS profile. It does not use a Bedrock API key, access an account, read carrier inventory or mutate orders. Nova's default comparison voice is the female voice `tiffany`. The browser/Zira path remains available when the Nova flag is disabled.

From this directory:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe strands_nova_sonic.py --check
.\.venv\Scripts\python.exe strands_nova_sonic.py --seconds 90
```

The real session may incur Bedrock charges. Speak the same cases you used with Gemini: ask what CargoMesh does, describe an incomplete freight request, correct a detail, ask about unavailable service, and ask whether a booking was made. Record transcript accuracy, natural follow-up, interruption handling, perceived response delay and actual usage. The pilot has no business tools, so a claim that it booked or queried an order is a failure, not evidence of integration.

The profile needs `bedrock:InvokeModel` on `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-5-sonic`. The model uses Bedrock bidirectional streaming and standard AWS credentials. A Playground session under a different console identity does not establish CLI access. Do not place AWS secrets or API keys in this folder.

Sources: [Strands Nova Sonic](https://strandsagents.com/docs/user-guide/sdk/bidi/models/bedrock/), [Bedrock bidirectional API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModelWithBidirectionalStream.html).

## Local browser bridge (first transport slice)

The local Web voice is gated by `NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW=true`. On authenticated freight pages it requires an active CargoMesh membership. On the synthetic `/hac37-preview` page, `CARGOMESH_NOVA_DEMO_VOICE=true` allows a voice-only grant on localhost in development; it is disabled in production and on LAN hosts. The browser calls `POST /api/v2/conversation/voice/session`; that route issues a 45-second, one-use signed grant. The local Python gateway accepts only the configured origin and loopback host, caps each voice session at 90 seconds and runs at most two at once. It has **no business tools**. Spoken turns appear in the same chat history but do not update or save a freight request.

Set these values only in the ignored `cargomesh/.env.local` of this worktree:

```text
CARGOMESH_VOICE_BRIDGE_SECRET=<random value of at least 32 bytes>
CARGOMESH_VOICE_WS_URL=ws://127.0.0.1:8765
NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW=true
CARGOMESH_NOVA_DEMO_VOICE=true
```

Use a unique random secret; the web app and gateway must read the same value. The existing Supabase URL and anon key must also be configured for the authenticated web session. Restart Next.js after changing `.env.local`. Start the gateway separately from `cargomesh/voice-pilot` with `.\start-nova-gateway.ps1 -Origin http://localhost:3218`. Do not publish a plain `ws://` gateway on a network interface. Deployment requires HTTPS/WSS, server-side temporary IAM credentials, and separate security validation.

With the flag enabled, **Talk with Nova** replaces the browser microphone and Zira controls. The browser streams microphone audio directly to the same Nova model and `tiffany` voice used in PowerShell; Nova performs its own speech recognition, conversation and speech synthesis. The text/chat pathway remains the only way to edit, save or inspect persisted workflow. Browser capture and playback differ from the PowerShell audio devices and still require a human listening test. Connecting read-only backend tools and validated draft proposals is the next implementation slice. A successful voice session does not certify those operations or Alexa+.

The gateway forwards Nova's transcript deltas as they arrive, and the chat replaces each provisional turn with its final transcript. This reduces the visible delay caused by waiting for a complete transcript block; it cannot remove Nova's own recognition/turn-finalization time or network latency. The browser fallback remains in the code for deployments without the Nova flag, so its voice files and tests are not unused dependencies. The separate `requirements-gateway.txt` installs only the Python packages needed by the web bridge; `requirements.txt` also supports the PowerShell audio and Gemini comparison pilots.

Run `.\.venv\Scripts\python.exe -m unittest -v test_nova_voice_gateway.py` for grant replay, expiration, audience and secret checks.
