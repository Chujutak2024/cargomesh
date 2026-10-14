# Strands + Gemini Live voice comparison

This is an opt-in **local voice pilot**, separate from the CargoMesh Web chat and Alexa+ MCP channel. It does not read an account, call business tools, save requests, quote carriers or book transport. The existing Web chat keeps Microsoft Zira as its preferred voice until a measured comparison justifies a change.

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
