# CargoMesh V2 conversational journey — implementation status (9 October 2026)

This note records what the `chatbotv1` branch can demonstrate. API route presence and local SQL tests do not prove that the hosted Supabase V2 schema, carrier operations, or Alexa+ channel are live. The current chat is a shipper-facing Web assistant; browser speech recognition and speech synthesis use the same text path.

| Journey step | Present in this branch | Truthful limit / owner |
| --- | --- | --- |
| Understand a free-text shipment and ask for missing fields | Bedrock interpretation when configured, bounded deterministic fallback, validated facility and cargo fields | The model proposes data only. Client and API validate; ambiguous places need confirmation. |
| Create and recover a shipper request | Authenticated V2 intake POST/GET, idempotency and session recovery | The current chat creates a draft, not a final shipment. Hosted V2 persistence needs HAC-44 evidence. |
| Evaluate ROAD | Authenticated serviceability response with evidence | Preliminary eligibility is not a carrier offer, route guarantee or capacity reservation. |
| Compare alternatives and carrier offers | The chat now reads current carrier-authored offers for the saved request through the V2 workflow API, excluding withdrawn/superseded/expired offers | No plan/route comparison card or verified selection action in chat yet. HAC-42 owns the shipper commercial UI and HAC-40 the authoritative workflow. |
| Shipper decision and booking authorization | Workflow contracts and endpoints exist | Not exposed as a chat command: exact offer, version, terms, total, expiry and decision must be re-read and explicitly confirmed before a write. HAC-42/HAC-40. |
| Carrier confirmation and resource commitment | The chat reads persisted booking states and distinguishes shipper authorization from carrier confirmation | Carrier mutation/hold workflow belongs to HAC-43/HAC-40. No confirmation is inferred. |
| Tracking and incidents | The chat reads persisted execution status for the request | No live GPS or proactive incident feed. Carrier operation and map belong to HAC-43; hosted end-to-end QA to HAC-44. |
| Carrier opportunity, offer and execution chat | Workflow endpoints exist | No carrier-facing chat surface or authorized carrier conversational writes in this branch. HAC-43 owns the portal and HAC-41 owns identity/MCP parity. |

The read-only chat queries use same-origin authenticated V2 APIs. They validate the V2 envelope, page through results, filter by the current request, and fail visibly on authorization, malformed responses or incomplete pagination. The backend service and SQL remain authoritative for tenant scope. The chat never sends business mutations to Bedrock or claims an offer/booking was created merely because the model said so.

## Reproducible checks

Run `pnpm typecheck`, `pnpm test:v2-conversation`, `node --conditions=react-server --import tsx --test src/features/v2-intake/workflow-chat-summary.test.ts`, `pnpm check:architecture`, and `pnpm build` from `cargomesh/`. In an authenticated V2 environment with the HAC-40 migration and authorized dataset applied, save a request, then ask “show offers”, “is it booked?”, and “track this shipment”. Verify that the returned states match the persisted records; repeat with a different organization and with an expired offer. In a synthetic preview, these queries must not claim commercial records. A local unit test is not hosted round-trip evidence.

## Hackathon alignment

The [official Devpost rules](https://amazonappdev2026.devpost.com/rules) (checked 9 October 2026) set the submission deadline at 23 October 2026, 12:00 pm PDT. The Alexa+ track accepts a working Alexa+ Agent Skill/MCP path or an explicitly labeled simulated Alexa+ Web experience using an AI/agentic tool. This Web chat is **not** Alexa+ live; a simulation claim needs a clearly labeled demo and source evidence. The AWS Builder track requires a qualifying primary-track project and documented AWS-service or Kiro Crew integration. This branch contains an optional Bedrock conversational adapter, but source code/configuration alone do not prove a successful AWS invocation. The submission still needs a reproducible judge-accessible demo, source/setup instructions, a public video within the rules' limit, and any category-specific evidence.

| Evidence needed before a stronger claim | Owner / gate |
| --- | --- |
| Hosted V2 migration, authorized dataset, cross-tenant negatives and Web API round trip | HAC-44 with HAC-40/HAC-41 |
| Shipper offer comparison, version-bound decision and booking confirmation UX | HAC-42 with HAC-40 |
| Carrier opportunity, authored offer, resource confirmation and execution/incidents | HAC-43 with HAC-40 |
| Direct MCP service parity, identity and revocation proof | HAC-41 |
| Bedrock invocation trace with redacted telemetry and no keys | Chatbot demo QA |
| Explicit Alexa+ simulation or another eligible primary-track artifact, three-minute video and submission | Team submission owner |

Do not use this note to claim a complete end-to-end product. It is a reviewable capability matrix and test script for the current branch.
