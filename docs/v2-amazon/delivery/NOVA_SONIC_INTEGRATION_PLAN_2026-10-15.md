# Nova 2.5 Sonic integration plan — 2026-10-15

## Decision and present evidence

Axel preferred the naturalness and CargoMesh context of Nova 2.5 Sonic over the browser voice and the local Gemini comparison. The Bedrock Playground produced a spoken conversation. The isolated Strands pilot in `cargomesh/voice-pilot/strands_nova_sonic.py` passed local setup and an 8-second audio-path smoke after the IAM change. This does **not** certify a browser conversation, a backend tool call, a measured price, or Alexa+.

Use `amazon.nova-2-5-sonic` in `us-east-1` with the female `tiffany` voice for the first web experiment. Keep the existing browser voice as fallback until the new path passes the gates below. The AWS profile is for local development only; deployed credentials must be server-side temporary IAM credentials. Bedrock API keys cannot authorize bidirectional streaming.

## Existing boundaries to reuse

- `src/features/v2-conversation-prep/voice-controls.tsx`: browser speech input and playback; keep as fallback.
- `src/features/v2-intake/conversation-chat.tsx`: visible turns, structured draft, confirmation and request workflow; remain authoritative for user actions.
- `/api/v2/conversation/interpret`: authenticated interpretation. A model proposal alone never mutates freight data.
- `readRequestWorkflow()`: authenticated read of persisted offers/bookings/executions; the response must distinguish shipper authorization from carrier confirmation.
- `src/server/modules/*`: application services and authorization. Do not copy commercial logic into a Python prompt or voice tool.

## Implementation slices

1. **Authenticated voice session.** Add a Node-issued, short-lived, one-use session grant bound to the current member, organization and request context. A separate Python WebSocket gateway validates it before opening Strands `BidiAgent`. Accept only the configured web origin; enforce session TTL, maximum duration, concurrent sessions, audio size/rate and an idle timeout. Neither AWS credentials nor model secrets reach the browser. Localhost and deployed HTTPS/WSS use explicit configurations.
2. **Browser audio and visible transcript.** Add an opt-in “Nova voice” control beside the existing voice selector. Stream microphone PCM to the gateway and play returned audio. Surface user and assistant transcripts in the same chat history, including interruptions, reconnects and provider errors. Closing the panel must close the stream and stop playback. If the gateway is unavailable, offer the existing browser voice and text.
3. **Business adapter.** Expose narrow, authenticated read-only tools through existing CargoMesh application services: product capabilities, current draft summary and persisted workflow state for the request that the user may access. Each tool receives a server-verified actor and organization; the model cannot supply identity or tenant IDs. Validate inputs and outputs. Unknown availability, price, offer and booking are reported as unknown.
4. **Draft changes.** Voice can propose field changes through the same validated chat pathway. It cannot save a request, authorize booking or accept an offer without the current explicit confirmation UI and expected version/idempotency checks. Keep carrier-authored offers and shipper authorization distinct.
5. **Measurement and rollout.** Run the same English cases through Nova and the current browser voice: explain CargoMesh, incomplete request, correction, unavailable service, wrong tenant, current booking status and interruption. Capture transcript accuracy, tool correctness, p50/p95 time to first audio, total turn latency, error rate, input/output usage and USD per session. Start with opt-in local preview; do not switch the default or deploy production until gates pass.

## Acceptance gates

- No response claims a saved request, confirmed quote, capacity or booking without persisted evidence.
- Wrong-tenant, expired/reused grant, revoked membership and stale-draft tests reject access or mutation.
- Spoken correction updates the visible draft proposal; saving still requires explicit confirmation.
- A request-state question reads persisted records and says whether the shipper authorized and whether the carrier confirmed.
- The browser shows transcripts and recovers to text/browser voice on model or network failure.
- A bounded A/B dataset has reproducible latency and cost measurements; quality is reviewed by Axel.
- Alexa+ remains a separate MCP channel; this web voice implementation alone is not Alexa+ certification.

## First coding target

The local gateway and browser audio transport now exist on `codex/chatbot-v2-unified`. Nova 2.5 Sonic with `tiffany` is the default spoken path when the local feature flag is enabled; the old browser microphone and Zira controls are hidden. Spoken transcripts enter the visible chat history. A development-only localhost grant lets the synthetic preview exercise audio without a CargoMesh account; authenticated operational pages still require active membership. No production credential, business tool integration or Alexa+ certification is claimed. The next slices are authenticated read-only tools, validated draft proposals, a human browser-audio test, and measured latency/cost. Avoid attaching a raw browser WebSocket directly to Bedrock.

Sources: [Strands bidirectional models](https://strandsagents.com/docs/user-guide/sdk/bidi/models/), [Nova Sonic provider](https://strandsagents.com/docs/user-guide/sdk/bidi/models/bedrock/), [Bedrock API compatibility](https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html).

## Shared staging packaging

The gateway now has a non-root container image, a health endpoint and an explicit deployment mode that requires an HTTPS web origin and an IAM task role. These files prepare a shared staging deployment; no AWS or hosting resource was provisioned by this change. Configuration, limits, validation and remaining rollout decisions are in [NOVA_VOICE_STAGING_DEPLOYMENT.md](./NOVA_VOICE_STAGING_DEPLOYMENT.md). The authenticated web page and the voice host must both be reachable over HTTPS/WSS before teammates can test outside the developer machine.
