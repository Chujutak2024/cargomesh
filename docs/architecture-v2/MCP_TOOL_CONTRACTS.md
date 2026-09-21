# CargoMesh MCP tool contracts

Status: M1 local bootstrap, M2 draft creation and the M3 submit/find/get adapters are implemented on `feature/alexa/v1,0`. Local authenticated create, submit, find, persisted loading/completed get, replay and role/cross-organization denial were verified. Full M3 still requires an autonomous provider executor; the current browser continuation is manual. Initial source analysis: 2026-09-18 against application commit `d26c5e4`.

The [local guide](../../cargomesh/src/server/mcp/README.md) covers the four registered tools: create_freight_request, submit_freight_request, find_freight_options and get_freight_options. Local Next → authenticated Supabase persistence and readback are verified; the completed-offer test uses a synthetic Result Bridge fixture, not an external provider. The booking/status/recovery tools below are not registered. No OAuth, Alexa+, Bedrock, AgentCore or Strands is implemented. [Sample Alexa+ tool arguments](alexa-sample-request-payload.json) and [example utterances](alexa-sample-utterances.md) illustrate a possible future client; they are not an integration.

## Scope

Hono and MCP call the same feature services directly; no same-process MCP-to-Hono HTTP. Preserve provider runtime and TypeScript/Node.js. Verified creation scope is ROAD/FTL/BALANCED; do not advertise AIR/SEA/RAIL, LTL, CHEAPEST or FASTEST.

BALANCED retains six dimensions: cost 25%, reliability 25%, transit 20%, availability 10%, route experience 10%, organization history 10%. Canonical FR-1042 scores remain Andes 89, Inca 84, Pacific 72. Andes/Inca/Pacific are demonstrated same-origin demo providers. Polaris/Apex/Velocity are scenario/roadmap. Recommendations are separate from the five provider tools.

## Existing service inventory

| Capability | Existing source/export | Actual input/output and storage |
|---|---|---|
| Create | [draft-creation-server.ts](../../cargomesh/src/server/services/freight-requests/draft-creation-server.ts), `createFreightRequestDraftServer` | `{ fields: ManualFreightRequestIntakeFields }` -> `FreightRequestIntakeViewModel`; session INSERT freight_requests, category and intake reads |
| Creation policy | [draft-creation-policy.ts](../../cargomesh/src/server/services/freight-requests/draft-creation-policy.ts), `createFreightRequestDraftWithDependencies` | Injectable dependencies; server-derived identity; defaults and normalization; DRAFT/version 1 |
| V2 adapter | [freight-request-adapter.ts](../../cargomesh/src/server/hono/adapters/freight-request-adapter.ts), `adaptV2ToLegacyService` | Flat input -> legacy fields; direct volume omitted, per-unit weight rounded |
| Intake/intent | [intake-server.ts](../../cargomesh/src/server/services/freight-requests/intake-server.ts), `getFreightRequestIntake`; [execution-intent-server.ts](../../cargomesh/src/server/services/freight-requests/execution-intent-server.ts), `getFreightRequestExecutionIntent` | Read-only. Intent does not submit a draft |
| Edit | [manual-intake-server.ts](../../cargomesh/src/server/services/freight-requests/manual-intake-server.ts), `persistManualFreightRequestIntake` | Request UUID plus draftVersion/fields; optimistic editing in DRAFT/PENDING, not submission |
| Discovery | [get-candidate-provider-pages.ts](../../cargomesh/src/server/services/discovery/get-candidate-provider-pages.ts), `get_candidate_provider_pages` | Request ID/code -> corridor/cargo/candidates; reads requests, carriers, services/category compatibility |
| Start | [start-run.ts](../../cargomesh/src/server/services/orchestration/start-run.ts), `start_orchestration_run` | `{ freightRequestId, idempotencyKey }` -> `StartOrchestrationRunResult`; same-name RPC |
| Browser collection | [orchestration-runner.ts](../../cargomesh/src/features/webmcp-runner/orchestration-runner.ts), `runInt02aOrchestration`; [provider-runner.ts](../../cargomesh/src/features/webmcp-runner/provider-runner.ts), `runProviderCollection` | Requires navigation/runtime adapters and inputs; orchestration coordinator uses legacy HTTP APIs |
| Result persistence | [record-provider-result.ts](../../cargomesh/src/server/services/result-bridge/record-provider-result.ts), `record_provider_result` | Call record plus trusted origin -> persistence result; RPC record_provider_result, events/offers and canonical payload dedupe |
| Evaluate | [evaluate-offers.ts](../../cargomesh/src/server/services/decision-engine/evaluate-offers.ts), `evaluate_offers` | Run UUID -> BalancedDecisionEvaluation plus nullable decisionId; evaluateBalancedOffers and RPC persist_balanced_decision |
| Read options | [view-model-server.ts](../../cargomesh/src/server/services/orchestration/view-model-server.ts), `get_orchestration_view_model` | Run UUID -> OrchestrationViewModel; SELECT runs/requests/events/offers/decisions |
| Booking/recovery | [booking-bridge.ts](../../cargomesh/src/server/services/booking/booking-bridge.ts) | prepare_booking, record_provider_booking, record_provider_booking_status, get_booking_view_model, prepare_booking_recovery; separate steps |
| Browser booking | [booking-client.ts](../../cargomesh/src/features/freight-ui/booking-client.ts) | startAssistedBooking, startAssistedRecovery, refreshProviderBookingStatus; browser coordination, not a ready Node service |
| Auth | [auth.ts](../../cargomesh/src/server/auth/member.ts), `requireAuthenticatedMember`; [server.ts](../../cargomesh/src/server/db/supabase/server.ts) | Next.js cookie session, auth.getUser, ACTIVE organization membership; optional org/role restriction |

`executeIntentServer`, `getOrchestrationRunViewModel` and `getBookingStatus` from earlier docs are not the verified exports. Legacy GET execution-intent, PATCH manual-intake, booking read and run read routes exist. Hono currently mounts health and draft creation. MCP M1 adds a shared orchestration read schema alongside the existing creation schema.

## MCP -> core map

The create_freight_request, submit_freight_request, find_freight_options and get_freight_options adapters are implemented; booking/status/recovery adapters below are proposed.

| MCP tool | Adapter -> service | RPC / DB | Transition | Side effect | Human confirmation | Idempotency |
|---|---|---|---|---|---|---|
| create_freight_request | Fields adapter -> createIdempotentFreightRequestDraftServer -> existing creation policy | Session INSERT requests; receipt/category/intake SELECT | New DRAFT/version 1; replay returns current state | Draft | No commercial approval | Unique org/member/key + immutable input hash; requires migration |
| submit_freight_request | Versioned adapter -> submitFreightRequest -> persisted snapshot validation | Session SELECT and conditional UPDATE under RLS | DRAFT/version N -> PENDING/version N+1 | Submission receipt | No booking approval | Exact retry replays while PENDING; stale version rejected |
| find_freight_options | Coordinator -> start_orchestration_run; executor -> record_provider_result/evaluate_offers | start/result/decision RPCs | PENDING -> ORCHESTRATING -> AWAITING_SELECTION; NO_MATCH returns request to PENDING | Run, quotes, events, offers, decision | No | Request/key; call IDs/payload; durable dispatch missing |
| get_freight_options | Read adapter -> get_orchestration_view_model | SELECT runs/requests/events/offers/decisions | None | None | No | Read-only; values may change |
| authorize_and_book | Approval/coordinator -> prepare_booking -> WebMCP -> record_provider_booking | prepare_booking_authorization; record_provider_booking_result | Request AWAITING_SELECTION -> BOOKING; booking initially pending | Selection, authorization, reservation/event | Yes, before preparation | Booking key/bridge call ID; external reconciliation required |
| get_booking_status | Read adapter -> get_booking_view_model | SELECT bookings/events/requests/offers | None | None; no remote refresh | No | Read-only |
| recover_booking | Approval/coordinator -> prepare_booking_recovery -> WebMCP -> record_provider_booking | prepare_booking_recovery; record_provider_booking_result | Old REJECTED/EXPIRED/CANCELLED -> REBOOKED during preparation; new booking later | Replacement authorization/reservation/link | Yes, new terms | New stable key bound to old booking/new offer |

## Common proposed wire rules

TypeScript shapes below are schema specifications; runtime validators are implemented for create_freight_request, find_freight_options and get_freight_options. UUID means validated UUID string; DateTime means ISO date-time; Positive means finite number >0; NonEmpty means trimmed nonempty string. Inputs reject additional properties; output projection removes unknown fields. Optional and nullable are distinct. Implement runtime schemas covering nested types before registration.

Success: `{ ok: true, data: T }`. Domain error: `{ ok: false, error: { code, message } }` with MCP isError true. Structured output and text fallback must agree. Transport auth/protocol errors precede domain dispatch. Sanitize database details, warnings and secrets. Common errors: INVALID_ARGUMENT, UNAUTHENTICATED, FORBIDDEN, and NOT_FOUND where applicable.

All tools authenticate a principal and authorize the resource. Current services use cookie auth; remote context support is missing. No client-supplied member, role, status or organization is accepted as authority. Register tools only when dependencies are available. Read-only annotations never replace authorization.

## 1. create_freight_request

**Purpose / LLM description:** Create a ROAD/FTL/BALANCED draft from explicit route and cargo. Does not submit, quote or book. Retry an ambiguous response with the same idempotencyKey and input.

**Underlying service:** createFreightRequestDraftServer accepts `{ fields: ManualFreightRequestIntakeFields }`, including partial/empty fields. Full grammar: [manual-intake-contracts.ts](../../cargomesh/src/features/freight-requests/manual-intake-contracts.ts). Output is [FreightRequestIntakeViewModel](../../cargomesh/src/features/freight-requests/intake-contracts.ts), including organization/operator, normalized cargo/route/execution.

**Implemented service:** `createIdempotentFreightRequestDraftServer` wraps the same creation policy/normalizer, session-based INSERT and intake reader. Hono's existing creation route remains unchanged; it can adopt this shared service when its contract accepts a key.

**Implemented input schema:** strict subset of the existing field grammar, requiring explicit dimensions/schedule rather than inheriting demo values:

```typescript
type CreateInput = {
  idempotencyKey: UUID;
  fields: {
    cargoCategoryCode: "MACHINERY" | "GENERAL" | "AGRICULTURAL" | "CONSTRUCTION";
    originCountry: "PE" | "CL" | "CO" | "BO" | "AR" | "EC";
    originCity: NonEmpty;
    originRegion: string | null;
    destinationCountry: "PE" | "CL" | "CO" | "BO" | "AR" | "EC";
    destinationCity: NonEmpty;
    destinationRegion: string | null;
    cargoEntryMethod: "PALLETS";
    entryQuantity: Positive; // integer in this MCP subset
    entryUnitWeightKg: Positive;
    unitsPerEntry: 1;
    entryLengthCm: Positive;
    entryWidthCm: Positive;
    entryHeightCm: Positive;
    pickupMode: "SCHEDULED";
    pickupWindowStart: DateTime;
    pickupWindowEnd: DateTime;
    deliveryDeadline: DateTime | null;
    budgetMax: Positive | null;
    availableDocuments: NonEmpty[];
    cargoDescription?: NonEmpty | null;
    requiresRefrigeration?: boolean;
    temperatureMinC?: number | null;
    temperatureMaxC?: number | null;
    isHazardous?: boolean;
    isFragile?: boolean;
    isOversized?: boolean;
  };
};
```

This first subset does not claim PALLETS/SCHEDULED are the only core modes. Validate ordered windows/deadline and finite temperature range through existing normalization; refrigeration requires both temperatures. Accepted countries do not guarantee provider coverage. Forward fields without reimplementing calculations.

**Output schema:** `{ freightRequestId: UUID, requestCode: NonEmpty, status: FreightRequestIntakeStatus, draftVersion: number, replayed: boolean }`, positive integer version, projected from actual intake. A new request is DRAFT/version 1. Replay returns the existing request's current status/version; it never resets an edited or booked request.

**Authentication / authorization:** active OWNER/SUPERVISOR via cookie session today; server assigns organization/requester.

**Effects / transitions:** INSERT freight_requests as DRAFT/version 1, category/intake SELECTs. No RPC/provider. **Human confirmation:** no commercial approval.

**Idempotency:** required UUID scoped to organization/member. A partial unique database index arbitrates concurrent INSERTs. SHA-256 of schema-ordered validated fields rejects key reuse with different input (`IDEMPOTENCY_CONFLICT`). Replays are checked before time-dependent normalization; a retry after its pickup date still finds the original request. Lost INSERT responses and failed intake reads can be retried with the same key. Metadata and its organization/member/code binding are immutable. The restrictive INSERT policy prevents an authenticated caller from claiming another member's receipt. No service-role bypass or in-memory lock is used.

Receipt retention follows the request row: administrative deletion removes the key protection. An omitted optional field and an explicit false/null value are different accepted inputs; retain the exact accepted fields for retries. This is creation idempotency, not booking authorization or submission. The migration must be applied before live use; missing schema fails closed with a sanitized error.

**Errors:** SDK input-validation errors, INVALID_INPUT, INVALID_DRAFT, IDEMPOTENCY_CONFLICT, REQUEST_CODE_COLLISION, DRAFT_CREATION_UNAVAILABLE, auth/read failures. Raw database diagnostics are never returned.

**Completeness / adapter / risks:** shared service, MCP adapter, migration and tests implemented; migration and authenticated MCP-to-local-database readback passed. Hono's flat adapter ignores direct volume and rounds unit weight; MCP forwards the explicit fields directly. Submission is an explicit separate MCP action.

## 2. submit_freight_request

**Purpose:** Confirm a complete persisted DRAFT for option discovery without implicitly booking or contacting providers.

**Input:** `{ freightRequestId: UUID, draftVersion: positive integer }` from the latest creation/edit receipt. The service checks the authenticated active OWNER/SUPERVISOR, RLS visibility, stored cargo/route/schedule, and DRAFT/version preconditions. A conditional update advances status to PENDING and increments draftVersion. An exact retry while still PENDING returns the same receipt with `replayed: true`; conflicting status/version returns `STALE_DRAFT`. Errors are sanitized. Local integration verifies role denial, tenant isolation and replay.

## 3. find_freight_options

**Purpose / LLM description:** Start/resume an initial quote search for a PENDING request with a stable key; return run identity and poll get_freight_options. Run creation does not mean offers exist.

**Input schema:** `{ freightRequestId: UUID, idempotencyKey: NonEmpty }`, key length 1..200; existing start-service shape.

**Output schema:** existing [StartOrchestrationRunResult](../../cargomesh/src/features/orchestration/contracts.ts):

```typescript
type FindOutput = {
  runId: UUID; freightRequestId: UUID;
  status: "RUNNING" | "OPTIONS_READY" | "NO_MATCH" | "FAILED" | "CANCELLED";
  deduplicated: boolean;
  candidates: Array<{
    carrierId: UUID; carrierCode: string; displayName: string;
    providerUrl: string; matchingServiceId: UUID;
  }>;
};
```

**Underlying services:** start_orchestration_run/get_candidate_provider_pages; subsequent browser collection, record_provider_result and evaluate_offers. Start does not launch a browser.

**Authentication / authorization:** session/RLS plus active request-organization membership before admin RPC. No additional role gate in current start service. **Human confirmation:** none for quoting.

**Effects / transitions:** run/snapshot persisted; request PENDING -> ORCHESTRATING. Later quotes/evaluation yield run OPTIONS_READY and request AWAITING_SELECTION, or run NO_MATCH and request PENDING. Distinguish request/run enums.

**Idempotency:** request/key uniqueness and locking prevent competing initial runs; replay returns snapshot/current run status. Result Bridge dedupes call identity/canonical payload. TypeScript evaluation requires RUNNING; coordinator must read completed state before re-evaluation, even where RPC has replay logic.

**Errors:** SDK input-validation errors, NOT_FOUND, FORBIDDEN, FREIGHT_REQUEST_NOT_READY, ORCHESTRATION_START_FAILED; downstream result/evaluation errors. No EXECUTION_UNAVAILABLE preflight exists; a RUNNING run can wait for browser continuation.

**Completeness / adapter / risks:** MCP adapter and existing start service persist a run; `/dispatch/<runId>` now offers explicit browser continuation through the existing WebMCP runner, Result Bridge and evaluation. Local integration verified start/replay, loading read and a synthetic persisted offer/ranking; runner tests verify browser handoff with injected navigation. Real browser execution still needs manual verification. Remote coordinator and autonomous dispatch remain missing. No fire-and-forget work occurs after HTTP completion and no provider handler is imported to impersonate browser execution.

## 4. get_freight_options

**Purpose / LLM description:** Read persisted progress and ranked options. Does not call providers or recalculate scores. Eligibility/expiry must be rechecked at booking.

**Input schema:** `{ runId: UUID }` -> get_orchestration_view_model(runId).

**Output schema:** exact [OrchestrationViewModel](../../cargomesh/src/features/orchestration/contracts.ts). Base: schemaVersion "1.0", runId, freightRequestId, requestCode, startedAt, nullable completedAt, candidateCount, completedCandidateCount, attempts/warnings. Branches:

| status | Payload |
|---|---|
| loading | ranking null, offers empty |
| error | error `{ code, message, retryable }`, ranking null, offers empty |
| NO_MATCH | reason, FreightRanking, offers empty |
| success | FreightRanking, RankedOfferView[] |

Nested types in that file and [decision contracts](../../cargomesh/src/features/decision-engine/contracts.ts) are normative schema references, not arbitrary JSON. RankedOfferView includes identity, price/currency, transit, rank/score, eligibility/reasons/recommendation and optional capacity/estimates/reliability/six subscores. Do not invent per-offer confidence, recovery availability or Bedrock explanation. Implement validators for every referenced nested type.

**Authentication / authorization:** session/RLS and organization check. **Human confirmation:** none. **Effects / transitions:** none; SELECT runs/requests/events/offers/decisions. No RPC. **Idempotency:** read-only, values may change.

**Errors:** INVALID_ARGUMENT, NOT_FOUND, ORCHESTRATION_VIEW_MODEL_FAILED, auth errors. A persisted `error` branch differs from a failed tool read.

**Completeness / adapter / risks:** service, local MCP adapter and shared runtime schema implemented. View discriminants are preserved. Technical warning codes/messages and error diagnostics are replaced with safe values; ranking/offers are preserved. Local authenticated reads of both a RUNNING run and a persisted synthetic quote/ranking passed. Disabled by default and always disabled in production pending real remote auth.

## Shared human approval requirement

Proposed, not implemented: a trusted flow issues confirmationReference bound to actor/member, organization, action, request, offer/carrier, accepted terms including amount/currency, expiry, idempotency key and previous booking for recovery. The LLM cannot mint this evidence. A boolean alone is not proof.

Verify evidence in shared services before either preparation RPC, which already mutates commercial state. Recheck membership/terms/validity. Same-operation retries reconcile the original action; changed terms require new approval. Existing authorizationReference is an execution credential, not proof of human consent. MCP initially forces ASSISTED; SMART_AUTO is not an exemption.

Current ASSISTED permits active membership; any stricter enterprise role policy is a proposed shared policy, not existing enforcement. Authentication itself does not authorize commercial consent.

## 5. authorize_and_book

**Purpose / LLM description:** Book exactly the offer explicitly approved by a person. Never infer approval from a recommendation or approval of different terms.

**Input schema (proposed):** `{ freightRequestId: UUID, offerId: UUID, bookingIdempotencyKey: NonEmpty, confirmed_by_human: true, confirmationReference: NonEmpty }`.

**Underlying service contracts:** prepare_booking accepts `{ freightRequestId, offerId, selectionMode, bookingIdempotencyKey }` and returns PreparedBookingAuthorization: authorization/decision/request/offer/carrier/service/provider-offer references, context, mode, key, expiresAt, deduplicated. It does not return bookingId. record_provider_booking takes RecordProviderBookingInput plus trusted origin, returns `{ bookingId, status: "INSERTED" | "DEDUPLICATED", deduplicated }`. Full types: [booking contracts](../../cargomesh/src/features/booking/contracts.ts).

**Success output schema (proposed):** `{ bookingId: UUID, freightRequestId: UUID, offerId: UUID, providerBookingStatus: ProviderBookingStatus, deduplicated: boolean }`. Initial successful record is PENDING_PROVIDER_CONFIRMATION. A later replay reads actual current provider status; never downgrade confirmed to pending. ProviderBookingStatus is the existing pending/CONFIRMED/REJECTED/EXPIRED/IN_TRANSIT/DELIVERED/CANCELLED enum. Success requires a persisted booking, not just authorization.

**Authentication / authorization:** active request membership/RLS, verified approval, eligible unexpired offer belonging to request and valid decision. Force ASSISTED. Origin/provider identity from trusted config/discovery, never caller URLs. **Human confirmation:** mandatory before preparation.

**Effects / transitions:** prepare_booking_authorization selects decision offer, writes authorization and changes request AWAITING_SELECTION -> BOOKING. WebMCP book_freight reserves; record_provider_booking_result inserts booking/event and updates decision/request. Separate record_provider_booking_status persists confirmation and advances request to BOOKED. Reads do not refresh providers.

**Idempotency:** stable booking key and bridge call ID/canonical payload. Authorization key uniqueness is currently global, not organization-scoped; design namespacing/binding. No distributed transaction with provider. Provider success/DB failure must reconcile with the same identity; test expiry and concurrent different keys.

**Errors:** BOOKING_REJECTED, BOOKING_ALREADY_EXISTS, BOOKING_AUTHORIZATION_EXPIRED, IDEMPOTENCY_CONFLICT, PROVIDER_BOOKING_FAILED, CANDIDATE_MISMATCH, CORRELATION_ERROR, BOOKING_BRIDGE_UNAVAILABLE, auth errors. Proposed: HUMAN_APPROVAL_REQUIRED, CONFIRMATION_INVALID, EXECUTION_UNAVAILABLE.

**Completeness / adapter / risks:** primitives/browser coordinator exist; remote coordinator/approval evidence missing. Durable operation lookup and a structured uncertain-outcome response must be finalized before registration. Ambiguous timeout never means retry with a fresh key.

## 6. get_booking_status

**Purpose / LLM description:** Read last persisted booking/payment state, events and recovery candidates. No provider contact or freshness guarantee.

**Input schema:** `{ bookingId: UUID }` -> get_booking_view_model.

**Output schema:** [BookingViewModel](../../cargomesh/src/features/booking/contracts.ts): schemaVersion, bookingId, freightRequestId, offerId, carrierId, providerReference, status, providerBookingStatus, providerResponseDeadline, paymentStatus, nullable paymentUrl, selectionMode, canRecover, recoveryOfferIds, events. Event: providerEventId, eventType, nullable providerBookingStatus, occurredAt, nullable location/description. No top-level carrier name or ETA is returned by this service.

Current typed status: PENDING_PROVIDER_CONFIRMATION, CONFIRMED, REJECTED, EXPIRED, IN_TRANSIT, COMPLETED, CANCELLED. SQL recovery also writes REBOOKED, absent from this type. Reconcile DB/type/validator before exposing recovered bookings; do not cast away or silently remap it. This is an unresolved release gate.

**Authentication / authorization:** session/RLS/request membership. **Human confirmation:** none. **Effects / transitions:** none; SELECT bookings/events/requests and unexpired eligible alternate offers. **Idempotency:** read-only.

**Errors:** INVALID_ARGUMENT, NOT_FOUND, BOOKING_LOOKUP_FAILED, BOOKING_EVENTS_LOOKUP_FAILED, RECOVERY_LOOKUP_FAILED, auth errors.

**Completeness / adapter / risks:** read service exists; adapter and state reconciliation needed. canRecover derives from old status, not assurance of replacement success. Offer read filters by request/eligibility/expiry/excluding previous offer; it does not explicitly restrict to original run. Remote refresh is a separate workflow with writes.

## 7. recover_booking

**Purpose / LLM description:** Reserve a human-approved replacement after rejection, expiry or cancellation. Ask for new approval of replacement terms; never automatically select/book a fallback.

**Input schema (proposed):** `{ freightRequestId: UUID, replacesBookingId: UUID, replacementOfferId: UUID, bookingIdempotencyKey: NonEmpty, confirmed_by_human: true, confirmationReference: NonEmpty }`.

**Underlying service:** map replacementOfferId to offerId; prepare_booking_recovery takes PrepareBookingInput plus replacesBookingId and returns PreparedBookingAuthorization. Provider call and record_provider_booking are subsequent steps. Same trusted provider identity/correlation as booking.

**Success output schema (proposed):** tool 4 output plus `{ replacesBookingId: UUID }`; initial pending/later replay semantics identical. No success until replacement persisted.

**Authentication / authorization:** active same-org membership/RLS, old booking belongs to request and is REJECTED/EXPIRED/CANCELLED, replacement eligible/unexpired, new approval bound to old booking/new terms; ASSISTED only. **Human confirmation:** mandatory before preparation.

**Effects / transitions:** prepare_booking_recovery delegates authorization, links replaces_booking_id and immediately marks old booking REBOOKED. Provider booking and result/event persistence happen later via record_provider_booking_result. Preparation is neither read-only nor atomic with provider reservation.

**Idempotency:** new stable replacement key reused on retries, bound to old booking/replacement offer. Reconcile partial execution including old REBOOKED with no new booking yet.

**Errors:** booking errors above. SQL BOOKING_NOT_RECOVERABLE currently falls through generic BOOKING_BRIDGE_UNAVAILABLE mapping; a specific public mapping is proposed, not implemented. Do not invent INVALID_OFFER as an existing bridge code.

**Completeness / adapter / risks:** preparation/browser recovery exist; remote execution/approval absent. Resolve early REBOOKED semantics and durable partial recovery before public enablement. Demo reset is not commercial compensation.

## Auth spike: design only

```text
Linked external identity -> token intended for CargoMesh MCP
 -> CargoMesh user -> explicit ACTIVE organization membership
 -> action permission + resource access -> shared service context
```

- Cookie helper is not bearer middleware. Services repeatedly resolve cookies; introduce a request-scoped verified-context seam without removing service-level authorization or breaking browser callers.
- Membership lookup without organization uses limit(1). Define explicit verified multi-org selection; model-supplied IDs are not authority.
- Define issuer/subject linkage, unlinking/revocation, token expiry/audience, scopes and approver identity. Alexa device/account identity is not automatically an enterprise approver.
- Decide delegated Supabase access preserving RLS. Do not replace session reads wholesale with service_role; admin RPCs remain behind resource/membership checks.
- Permission matrix: reads/search currently active authorized membership; creation OWNER/SUPERVISOR; ASSISTED booking active membership plus proposed trusted consent. Agree stricter policies explicitly.
- Separate authentication from approval issuance/audit. No OAuth or external configuration in this phase.

Reference: [MCP authorization](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/basic/authorization.mdx) requires tokens intended for MCP and disallows passing the incoming token indiscriminately upstream. Do not assume Alexa sends the existing Supabase JWT. Pin a compatible SDK/protocol at bootstrap, not an unspecified later version.

Spike deliverable: decision on identity mapping, org selection, RLS strategy, permissions, trusted approval issuance, negative tests and client compatibility.

## Incremental milestones

Paths below are proposed relative to cargomesh/src unless specified. Focused tests plus relevant existing regression suites are required. M1-M6 are restricted local development with authenticated access or explicitly labeled test doubles; real auth M7 precedes remote M8. Browser evidence is required for M3/M5/M6, not just mocks.

| Milestone | Expected files | Dependencies | Tests | Risk / Definition of Done |
|---|---|---|---|---|
| 1 Bootstrap | app/mcp/route.ts, server/mcp/server.ts, server/mcp/errors.ts, server/mcp/tools/get-freight-options.ts | Pinned SDK/protocol; local authenticated context | initialize/list/call, invalid input, auth rejection, no writes | One real persisted read via service; no Hono HTTP; no public unauthenticated endpoint |
| 2 Create | mcp creation tool; shared schema/adapter as needed | Explicit field mapping/retry policy | Roles, preserved fields, unsupported modes, insert/read failure | Real DRAFT/version without implicit demo data; no false retry guarantee |
| 3 Find/get | mcp tools; shared submission/execution coordinator; schema | DRAFT->PENDING, browser executor, durable dispatch | OCC/concurrency/replay, no executor, NO_MATCH, real browser | New request reaches persisted offers; RUNNING row alone insufficient |
| 4 Status | mcp status tool; shared/schemas/booking.ts | DB/type reconciliation | Tenant isolation, REBOOKED, events, no remote refresh | Faithful persisted read across supported lifecycle |
| 5 Booking | mcp tool; shared approval/booking coordinator | Trusted consent, executor, durable operation lookup | False/expired approval, changed terms, provider-success/DB-failure, duplicate calls | No unapproved commercial action; retries do not duplicate reservations |
| 6 Recovery | mcp tool; coordinator extension | M5; early REBOOKED handling | Recoverable states, new consent, concurrent recovery, partial failure | Linked replacement and recoverable partial state |
| 7 Real auth | server/mcp/auth/context.ts; shared auth seam; OAuth metadata after design | Auth spike/identity provider | Audience/issuer/expiry, revocation, scopes, multi-org/RLS | Verified remote identity without accidental cookies or leaked credentials |
| 8 Remote | Minimal hosting config/runbook/smoke tests | M7, durable executor, approved external config | Restarts/timeouts/concurrency/reconciliation | Authenticated endpoint with recoverable execution, no developer browser dependency |
| 9 Alexa+ | Client/account-linking config/docs, exact artifacts TBD | Verified compatibility and M8 | Linking/org selection/voice consent/refusal/repeats | Measured client flow; later scope |
| 10 Bedrock | Explanation module/tests, location TBD | Persisted ranking, authorized AWS setup | Fallback/factual grounding/score immutability | Optional explanation only; no ranking changes; later scope |

New dispatch/state support may need additive DDL and local pgTAP tests. Synthetic data belongs in supabase/scenarios, never migrations. No remote DB operations, secrets, provider invocation, push or merge are part of this documentation delivery.

## Handoff and acceptance

Core owner: submission, creation idempotency, auth seam, booking states/errors. WebMCP owner: executor trigger/lifetime, result correlation and retry strategy preserving actual provider boundary. Agent Platform: transport adapters after dependencies are ready.

M1/M2/M3 adapters and local tests are implemented. MCP can now submit a DRAFT to PENDING, then start a run; provider execution still requires manual continuation in the signed-in browser. Local integration drives the full create → submit → find → synthetic Result Bridge → evaluate → get sequence without manual action, but it does not prove unattended provider execution or external provider availability. No remote DB or provider operations are part of this verification.
