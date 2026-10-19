# Strands voice and Alexa+ readiness — 2026-10-14

Status: Google Gemini Live selected by Axel for a local Strands voice pilot. The opt-in pilot lives in `cargomesh/voice-pilot/`; no paid Gemini session, Web voice integration or Alexa+ invocation is claimed.

## Decision boundary

Strands BidiAgent is a Python-only bidirectional voice orchestration layer, not a voice. Its documented realtime model adapters include Google Gemini Live, OpenAI Realtime and Bedrock Nova Sonic. The selected model supplies recognition and speech. The browser currently uses Web Speech with Microsoft Zira preferred. Preserve Zira as the default/fallback until a provider is configured, a female voice is compared by users, and the new path passes the same freight workflow tests. A Bedrock Mantle key for text does not authorize Google Gemini Live, OpenAI Realtime or Nova Sonic.

The Alexa+ channel is separate: Alexa+ handles its own microphone, recognition and spoken response, invoking CargoMesh over MCP. Strands web voice is not a prerequisite for Alexa+ and must not implement a parallel commercial engine.

## Recommended integration sequence

1. Select and obtain a server-side realtime voice provider credential. Axel selected Google Gemini Live for the measured pilot; the local implementation defaults to Kore. This is billed by Google, outside AWS credits, and requires a private Google AI Studio API key. It is billed by Google, outside AWS credits. Keep Zira for a controlled A/B comparison and graceful fallback.
2. Build an opt-in Python Strands BidiAgent gateway for browser audio over authenticated WebSocket. Bound session length, audio rate, concurrency and costs. Keep credentials server-only. Expose user and assistant transcripts, interruption status and provider errors to the existing chat UI. Do not make model-generated text or audio a commercial fact.
3. Let the Strands agent call a narrow, authenticated CargoMesh application adapter for reading request state and proposing changes. Domain services remain authoritative; shipper authorization and carrier confirmation remain separate. Require explicit confirmation for consequential actions. Add negative tests for wrong tenant, revoked link, stale draft, unknown availability and provider timeout.
4. Compare Web Speech/Zira with the Strands pilot on the same English scenarios: natural guidance, freight field capture, interruptions, recovery, tool correctness, p50/p95 latency and cost per session. Roll out only if quality gains justify the new latency and cost.

## Alexa+ readiness against current code/evidence

| Requirement | Current evidence | Remaining gate |
| --- | --- | --- |
| Streamable HTTP MCP (2025-11-25) | `/mcp` and local controlled MCP tests exist. | Verify exact deployed SHA and remote protocol exchange. |
| Public HTTPS MCP URL | No certified current endpoint in the integration record. | Deploy isolated preview, no production alias/root changes. |
| OAuth account linking | Earlier hosted Supabase PKCE smoke; test clients and links were later disabled. | Confirm PRM/authorization metadata, S256, resource parameter, refresh flow, redirect URIs, scopes and active consent with current SHA. |
| User and tenant authorization | V2 code has verified linking and membership checks locally. | Remote negative cases: missing, expired, revoked, wrong client and wrong tenant. |
| Performance | No Alexa+ round-trip benchmark. | Measure MCP round-trip under 500 ms with p50/p95 and error rate on remote preview. |
| Add-on onboarding | No recorded Alexa AI CLI add-on or simulator invocation. | `alexa-ai configure`, scaffold add-on, listing/compliance assets, development deploy, simulator test. |
| Alexa+ live proof | None. | Record a real Alexa+ invocation of the submitted MCP endpoint under linked test identity. If access is unavailable, label the demo simulated. |
| Bedrock | Text adapters exist; the last real probe was blocked by configuration. | Enable/test an approved model with private server configuration and provider usage evidence before claiming Bedrock. |

The official MCP QuickStart also requires 401 discovery behavior, protected-resource metadata and authorization-server metadata. Review the current implementation against the current QuickStart before onboarding; the older local runbook expects a `WWW-Authenticate` challenge whereas the newer QuickStart explicitly says 401 without that header, so this is a compatibility issue to resolve in an isolated preview rather than assuming either behavior passes.

## Adoption rule

Use Strands for the web voice pilot if it improves measured experience. Use the existing MCP and OAuth implementation for Alexa+. Add AWS services only when they solve a demonstrated problem with cost and evidence; technology count is not an acceptance criterion. Do not claim Alexa+ live, Bedrock live, or carrier integration from local mocks or documentation.

## Sources

- https://strandsagents.com/docs/user-guide/sdk/bidi/
- https://strandsagents.com/docs/user-guide/sdk/bidi/models/google/
- https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
- https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html
- Local: `docs/v2-amazon/delivery/INTEGRATION_CERTIFICATION_2026-10-09.md`, `docs/v2-amazon/delivery/ALEXA_PLUS_CONNECTION_RUNBOOK_2026-10-04.md`, `docs/v2-amazon/contracts/ALEXA_MCP_AWS.md`.
