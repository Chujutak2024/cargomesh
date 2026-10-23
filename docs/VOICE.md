# Nova voice and typed replies

## Runtime contract

The Web application obtains a short-lived, one-use grant through `POST /api/v2/conversation/voice/session`. The browser connects to the configured WSS `/voice` endpoint. The gateway validates signature, expiry, replay, audience and exact Origin before running Bedrock Nova through Strands. A health response alone does not prove authentication, inference or audio playback.

Current source limits: signed authentication envelope **65,536 bytes**, individual audio frame **8,192 bytes**, typed text **4,096 characters** with bounded wire size. Sessions last at most **240 seconds**, with at most **two concurrent sessions per process**. Admission/replay state is in memory: retain the single-task deployment until shared coordination is implemented.

The `ready` response advertises `textInput: true` for gateways supporting typed turns. The browser then sends `{type:"text",text:"..."}` on the authenticated connection and plays Nova's reply without requiring microphone permission. Old gateways use the application/browser fallback; never infer new capabilities from a newer Web build alone. The voice-reply control can mute output while preserving the transcript. Microphone activation remains explicit.

Response completion waits for pending speech playback; finishing an intake step must not open a form and cut off the current reply. Reconnection uses fresh grants and a bounded recent context, not an unlimited persistent Bedrock conversation. Human acceptance must cover long replies, corrections, typed questions, mute, renewal and network failure.

## Typed-only Web acceptance

The 22 October deployment record reports revision 5 advertising textInput and a completed typed-to-audio turn **with a continuous digital-silence stream**. Nova cross-modal input needs continuous streaming even when the user types. Integrated PR #149 now supplies that stream in the Web source; without it, the accepted typed turn can wait without audio. Final production browser acceptance and the currently running AWS revision are **pending confirmation — Axel**, coordinated by Cristhian. This is separate from spoken quantity parsing. See [deployment evidence](v2-amazon/delivery/evidence/nova/GATEWAY_92EC470_2026-10-22.md), [the original friction](v2-amazon/delivery/friction-logs/NOVA_TEXT_STREAMING_2026-10-22.md) and [the integrated correction/acceptance script](v2-amazon/delivery/NOVA_TYPED_SILENT_STREAM_2026-10-22.md). No microphone permission should be required merely to type.

## Local gateway

From `cargomesh/voice-pilot/`, create a virtual environment and install `requirements-gateway.txt`. `requirements.txt` additionally supports historical standalone audio/model comparison pilots.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-gateway.txt
.\start-nova-gateway.ps1 -Origin http://localhost:3000
```

The launcher reads `CARGOMESH_VOICE_BRIDGE_SECRET` from `cargomesh/.env.local` and uses the authorized `cargomesh-bedrock` profile. Configure the same secret server-side in Next.js and `CARGOMESH_VOICE_WS_URL=ws://127.0.0.1:8765/voice`; enable the Web flag. The AWS profile needs actual Bedrock model permission. Local HTTP/WS is for loopback only; hosted uses HTTPS/WSS.

## Update the existing AWS service

Build **from the accepted main source**, including the latest carrier prompt, rather than reusing an older ZIP. Build context is `cargomesh/voice-pilot`; the Dockerfile copies `nova_voice_gateway.py`, `cargomesh_voice_prompt.py`, and `voice_transport_limits.py`. The image runs as UID 10001 and exposes port 8765.

```sh
docker build -f cargomesh/voice-pilot/Dockerfile.gateway -t cargomesh-nova:<accepted-sha> cargomesh/voice-pilot
```

Publish to the existing private ECR repository with a SHA tag; resolve its digest and update the existing ECS service image. Preserve task/execution roles, Secrets Manager reference, Origin, port, health path, endpoint and scaling. This documentation does not authorize creating infrastructure or changing IAM. Do not pass a Vercel URL as a standalone Docker command; it is the value of the gateway's `--origin` argument.

Deployment acceptance:

1. Record exact source SHA, image digest, task revision and successful ECS rollout.
2. Verify `/healthz` HTTP 200 and an authenticated context larger than 4 KiB reaching `ready` from the configured Vercel Origin.
3. Verify `ready.textInput`, typed request → audible response, microphone flow and complete long-response playback.
4. Verify invalid Origin/replay rejection and tenant-scoped context. Do not publish grants/audio/credentials.
5. Test carrier briefing and customer correction/review; no commercial write without native confirmation.

Only then enable expanded catalog context on Vercel and redeploy if needed. New Web features, a healthy old gateway and a new image in ECR are three distinct states.

## Operations

Check CloudWatch errors, ECS health, provider access and actual Billing usage. A budget alert is not a spending cap; there is no documented automatic shutdown. Fargate, ALB/networking, logs, ECR, secrets and model usage incur separate costs. Keep judge access available through the official judging window and choose shutdown explicitly. Deleting tasks alone can leave a chargeable ALB. See [status](STATUS.md) for the last observed deployment, not a promise of current uptime.
