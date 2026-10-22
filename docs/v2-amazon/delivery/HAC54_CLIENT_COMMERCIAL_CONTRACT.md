# HAC-54 — Client commercial operations: H0 contract and inventory

Implementation reference for current V2 services. Use [API/MCP](../../API.md), [setup](../../SETUP.md) and [status](../../STATUS.md) for the maintained operational guides. `main` is the active base.


## Sections and implementation order

| Section | Scope | Completion evidence required |
| --- | --- | --- |
| 1 / H0 | Inventory, canonical DTOs/endpoints/IDs, ownership seams | Published source-backed matrix; unresolved agreements explicitly recorded |
| 2 / H1 | Operations/list/detail and Dashboard | Real persisted request read; preserved filters/back navigation; explicit pagination/partial reads |
| 3 / H2 | Opportunity, attributable offer/version, comparison/ranking | Same request and offer chain visible to the authorized client and Carrier |
| 4 / H3 | Explicit selection, booking, resources and history | Persisted correlated records; conflict/expiry/retry handling without duplicates |
| 5 / H4 | Tracking, separate commercial scenario and closure | Booking/execution/events/route chain; positive and negative connected cases |

The first usable functional increment should combine the necessary H1 read surface with the H2 offer attribution/version read. Do not wait for finished tracking to publish it. The user's current instruction stops this work session at section 1; this is not a dependency on a human PASS before implementing section 2.

## Source inventory

All paths below are repository-relative and inspected at the starting SHA unless an external commit is explicitly named.

| Concern | Existing implementation to reuse |
| --- | --- |
| Client entry points | `cargomesh/src/app/clients/{page.tsx,requests/page.tsx,requests/[id]/page.tsx,bookings/page.tsx,history/page.tsx,tracking/page.tsx,tracking/[id]/page.tsx}` |
| Connected page implementations | Corresponding routes under `cargomesh/src/app/(cargomesh)/`; client `/clients` delegates to `dashboard/page.tsx` |
| SSR reads | `cargomesh/src/server/services/v2-workspace/workspace-server.ts` |
| Operations/detail | `cargomesh/src/features/shipper-portal/{request-list.tsx,request-workspace.tsx,shipper-model.ts}` |
| Client commercial adapters | `cargomesh/src/features/shipper-portal/{shipper-api.ts,shipper-commercial-client.ts,commercial-view.ts,commercial-panel.tsx}` |
| Tracking reads/presentation | `cargomesh/src/features/shipper-portal/{tracking-read-model.ts,tracking-model.ts,tracking-presentation.ts,tracking-journey.ts}` |
| Carrier consumer | `cargomesh/src/features/carrier-portal/{commercial-client.ts,commercial-model.ts}` |
| Request HTTP routes | `cargomesh/src/server/hono/routes/freight/requests.ts` |
| Workflow HTTP routes | `cargomesh/src/server/hono/routes/{workflow.ts,carrier-workflow.ts}` |
| Workflow service/repository | `cargomesh/src/server/modules/workflow/{application/workflow-service.ts,infrastructure/supabase-workflow-repository.ts}` |
| Canonical schemas | `cargomesh/src/shared/schemas/v2/{freight-request.ts,workflow.ts,commercial.ts,identity.ts,facilities.ts}` |
| Existing MCP tools / confirmation adapter | `cargomesh/src/server/mcp/tools/{v2-workflow.ts,v2-workflow-services.ts}`; `shared/schemas/v2/{mcp-workflow.ts,mcp-workflow-catalog.ts}` under `cargomesh/src/` |
| Member and Carrier authority | `cargomesh/src/server/auth/{member.ts,carrier.ts,route-guard.ts}`; `cargomesh/src/server/hono/middleware/v2-auth.ts` |
| Explicit preview separation | `cargomesh/src/server/auth/local-client-preview.ts`; `cargomesh/src/features/workspace-mode/workspace-fetch.ts` |
| Existing domain/API documentation | `docs/v2-amazon/contracts/{DOMAIN_CONTRACTS.md,IDENTITY_AND_MCP_CHANNELS.md,HAC40_WORKFLOW_API.md}` |

SSR currently calls application services directly with the authenticated actor. The HTTP equivalents below are contracts for browser/API consumers, **not** a proposal to introduce server-to-server loopback HTTP. The member repository uses `read_v2_workflow` / `command_v2_workflow`; Carrier uses its separate `read_v2_carrier_workflow` / `command_v2_carrier_workflow`. Retain their database authorization and business rules.

## Screen/action → endpoint → reference → permissions → current gap

All HTTP paths in this table have prefix `/api/v2`. `R` means an authenticated active member reading its authorized organization; `W` means a server-authorized workflow writer (current workflow SQL: OWNER/SUPERVISOR). Carrier actions require the independent verified operator identity and action-specific Carrier grant; client membership or a supplied UUID never grants Carrier authority. Existing source is not equivalent to runtime verification: every row below is **source-inspected, not newly exercised** in H0.

| Screen / action | Existing endpoint or service | Entity / correlation | Permission | Present in source / remaining work |
| --- | --- | --- | --- | --- |
| `/clients`: Dashboard | SSR `listWorkspaceRequests`, `listWorkspaceWorkflow`, `listWorkspaceFacilities`; HTTP request/bookings/executions/facilities collections | Organization-scoped persisted records | R | Counts derive from records, not a second local state machine. SSR first-page limits make them loaded counts, not verified organization totals. H1 must expose completeness. |
| `/clients/requests`: list/filter/back | GET `/freight/requests?limit&offset`; SSR lifecycle service | Request `id`, `organizationId`, `draftVersion`, `status`, windows/cargo | R | List exists; SSR keeps only 50 items and drops page metadata. Query/status/date/sort are local component state; only initial `q` is read from URL. H1 must preserve filters/selection and explicit partial reads. |
| `/clients/requests/:id`: detail | GET `/freight/requests/:id`; SSR `readWorkspaceRequestFlow` | Exact request plus request-scoped workflow kinds | R | Real DTO read and UUID/404 handling exist. Nine parallel collection reads fail the whole operation if one fails; completeness is not represented. H1 needs a documented, honest loading/error/partial model. |
| Detail: edit/evaluate/submit | POST `/:id/revisions`, GET `/:id/serviceability?expectedDraftVersion`, POST `/:id/submissions` under `/freight/requests` | Same request; `expectedDraftVersion` | Native request permissions; server actor | Existing revision, evaluation and submission clients are reusable. Intake/Nova and shared state remain Juan's surface. Do not implement a competing request editor. |
| Detail: route/plan/opportunity | GET/POST `/freight/requests/:requestId/{routes,plans,opportunities}` | Plan `routeId`/`requestVersion`; opportunity `planId`/`carrierId`/assignment IDs | R / W | Native operations exist. Need a connected, evidence-eligible request→plan→opportunity increment, not auto-created offers. C6 snapshot additions belong to HAC-51 coordination. |
| Detail: offers | GET `/freight/requests/:requestId/offers`; GET `/offers/:id` | Offer request/plan/opportunity/Carrier IDs and versions | R | Paginated browser refresh exists. `OfferDetails` currently labels `carrierReference` as the Carrier; this is a quote reference, not a verified commercial name. H2 must show attributable identity, offer version and missing identity honestly. |
| Detail: compare/ranking | GET `/freight/requests/:requestId/ranking`; native POST available | Ranked option `planId`, `offerIds`, policy version/explanation | R / W | Price, breakdown, validity, conditions and backend ranking are rendered. H2 must verify the complete same-request opportunity/offer/plan/Carrier chain; never calculate a replacement ranking locally. |
| Carrier receives/responds/quotes | GET `/carriers/:carrierId/opportunities`; POST `.../opportunities/:id/responses`; POST `.../opportunities/:parentId/offers` | Same opportunity/request/plan; Carrier-issued offer | Verified Carrier grant | Reuse Carrier portal and its commercial adapters. Client must not impersonate the Carrier or issue its quote. Shared-record scenario remains to be built/checked. |
| Detail: explicit selection | POST `/freight/requests/:requestId/decisions` | `planId`, `selectedOfferIds`, `consideredOfferIds`, policy/evidence | W | Confirmation UI/native command exist. Client generates a new idempotency key per invocation: H3 must check safe retries beyond the in-flight guard. No invented `expectedVersion` field on creation. |
| Detail: authorize booking | POST `/bookings` | `decisionId`, exact `offerId`, explicit authorization/evidence | W | Consent and per-offer retained keys/in-flight guard exist. Authorization is not Carrier confirmation. H3 must verify stale offer, concurrency, re-read and replay paths. |
| `/clients/bookings` | GET `/bookings`, request/offers/decisions reads; SSR kind reads | Booking `requestId`, `decisionId`, optional legacy `offerId`, `carrierId`, `version` | R | Persisted list and distinct confirmation states exist. Direct-ID `resolveBookingOffer` path does not explicitly check Carrier equality; legacy fallback cannot establish an ambiguous offer. H3 must strengthen correlation and expose resources. |
| Resources/execution | GET `/bookings/:parentId/{reservations,execution}`; GET `/executions/:id` | Hold/execution → booking → decision → offer | R; native commands W / Carrier as applicable | Native reads exist; no complete client resources/action experience verified. Do not treat a booking as reserved physical resources automatically. |
| Carrier booking decision/operation | POST `/carriers/:carrierId/bookings/:id/confirmations`; native execution start/completion/position actions | Same booking/execution; Carrier confirmation status | Action-specific Carrier grant | Existing native commands, no new wrappers needed. Client selection must not silently confirm, start, deliver or rebook. |
| `/clients/history` | SSR request, booking, offer, incident and `execution-events` reads | Business request snapshot vs physical execution events | R | Separate physical chronology exists; durable request business-event history and reusable-request action are not established by this page. H3 must expose only supported actions and revalidate current data. |
| `/clients/tracking` | GET `/executions`, `/bookings`, requests; event/incident children | Execution `bookingId` and `requestId` | R | Tenant reads and batched event loading exist. Collection caps/completeness can hide older records. H4 must preserve real unknown/error states. |
| `/clients/tracking/:id` | GET `/executions/:id`, `/executions/:parentId/{events,incidents}` and linked request/route/plan/decision reads | Execution→booking→decision→plan→route; reported positions separate | R | Current SSR locates the execution in a capped collection, despite a native direct lookup existing. H4 should use targeted reads, keep provenance and not present conceptual animation as GPS. |

`WorkflowServiceV2.read` can list an authorized kind directly in SSR; this does **not** imply global HTTP `/offers`, `/ranking` or `/incidents` collection endpoints. Reuse the actual scoped HTTP routes.

### MCP / assistant adapter inventory

The existing MCP registration exposes `list_v2_freight_requests`, `revise_v2_freight_request`, `submit_v2_freight_request`, `read_v2_workflow`, `build_v2_transport_plan` and `rank_v2_offers`. Commercial mutations use **`prepare_v2_commercial_action` → explicit human review → `confirm_v2_commercial_action`**, not an assistant-generated direct booking. Preparation retains action/context/proposed value, payload hash, expiry and the UUID retry key; confirmation references the stored `confirmationId`. Reuse the same confirmation for an identical retry, rather than inventing consent or another proposal.

`v2-workflow-services.ts` reuses the native lifecycle/workflow/planner/confirmation services and calls `check_v2_mcp_actor`; an active user principal with `mcp:tools` is required. Carrier-scoped reads separately call `requireAuthenticatedCarrier`; stored commercial proposals enforce their own operator/scope checks. `ConfirmedWorkflowServiceV2` validates action/context/value and result correlation. Do not bypass these controls or build another web/MCP command implementation. Juan owns the assistant integration; H2 supplies authorized commercial context through this existing seam. Registration/source presence is not an H0 runtime MCP/voice validation.

## Canonical handoff; no parallel DTO or business state machine

### Jean → Juan / Luis: identity and Facilities

- Consume `AuthenticatedMemberContext` server-side: `userId`, `userEmail`, `memberId`, `organizationId`, `role`, `status`. Resolve from Supabase Auth plus active membership; never accept organization IDs as authorization.
- Read organization/Facilities/profiles through the existing native APIs. Facility/profile writes require OWNER/SUPERVISOR; organization/preferences writes require OWNER. Preserve server enforcement and tenant isolation.
- The intake selector is a summary, not complete address/contact/hours/timezone/restriction evidence. Fetch the authorized detail when required. Unknown hours are not 24/7 availability.
- Jean's [published contract](https://github.com/Chujutak2024/cargomesh/blob/0b75904bbb899912dca7a87b17584cc5024b0452/docs/v2-amazon/delivery/HAC52_CLIENT_IDENTITY_CONTRACT.md) is in [PR #132](https://github.com/Chujutak2024/cargomesh/pull/132), observed head `0b75904bbb899912dca7a87b17584cc5024b0452`, not in this baseline. Its `/client-context` read/prepare/confirm surface and real-member-over-preview routing fix are dependency contracts, **not claimed available in this checkout**. Do not merge that branch or reimplement its auth/context work here.

### Juan → Luis: persisted request

- Reuse `FreightRequestV2ResponseSchema` from `shared/schemas/v2/freight-request.ts`, not a new frontend approximation. Consume response `data.id` as `requestId`, `data.organizationId`, `data.draftVersion` and `data.status`; re-read by that ID using the active member.
- Juan owns intake/Nova, shell/sidebar/filters and the shared assistant. Luis consumes the saved result and the same request read service. No second draft, new intake route or assistant-only commercial state.
- A draft saved by the client must remain owned by that organization. Serviceability is evidence, not an offer, booking or confirmed delivery.
- No new HAC-53 request handoff/sample ID was published in the issue/comments inspected for H0. Accept the current canonical contract now; request Juan's real saved ID and component/filter interface when published. Do not manufacture a request UUID as evidence.

### Client ↔ Carrier: offer, selection and execution

Use `WorkflowRecordV2Schema` for the record envelope and `CarrierOfferV2Schema` for offer contents. Validate the envelope and embedded IDs, not just a matching UI label.

| Resource | References/versions to retain |
| --- | --- |
| Plan | Envelope `id`, `requestId`, `organizationId`, `version`; data `routeId`, `requestVersion`, assignments and eligibility evidence |
| Opportunity | Envelope request/org/Carrier; data `planId`, assignments, deadline, response state and available snapshots |
| Offer | Data `id`, `requestId`, `planCandidateId`, `opportunityId`, `carrierId`, `coveredServiceIds`, `coveredAssignmentIds`, `offerVersion`, `supersedesOfferId`; envelope `version` is distinct |
| Commercial evidence | Quote `carrierReference`, `source.channel`/`issuerId`/evidence, status, issued/validity dates, price/currency/breakdown/terms and nullable timing/capacity |
| Ranking/decision | Server policy/version/explanation; selected `planId` and exact `selectedOfferIds`; human selection evidence |
| Booking | Envelope IDs/status/version; data `decisionId`, `offerId` when present, authorization and Carrier confirmation states; legacy missing offer ID is not permission to guess |
| Execution/events | `bookingId`, `serviceId`, planned/actual windows; event timestamps and actor/source; recorded position and incident status |

Every join must preserve the same authorized request and organization, the intended plan/opportunity and exact Carrier identity. A source/quote reference is not the Carrier's verified display name. The current offer DTO does not promise a commercial-name field: use only an authorized existing identity read, otherwise show a truthful identifier/unavailable label until an additive projection is agreed.

Mutations retain `Idempotency-Key` for the same intended action through retry. Native request revisions/submissions use `expectedDraftVersion`; versioned workflow revisions use their actual schema. Decision/booking **creation** currently has no `expectedVersion` input: immutable referenced IDs plus native freshness checks are authoritative. A stale/withdrawn/superseded/expired offer, forbidden action, conflicting version or unavailable resource must not yield a success UI. Re-read after authorized commands; no fixture on 401/403/409/5xx.

The Carrier commercial model already checks envelope/data correlation and scopes offer matching to request/plan/opportunity. Reuse that contract, not its UI pipeline as another client business state machine. Changes to shared schemas, SQL projections or command wrappers require an agreed single editor first.

## Shared scenario IDs and environment

Jean's [base scenario manifest](https://github.com/Chujutak2024/cargomesh/blob/0b75904bbb899912dca7a87b17584cc5024b0452/supabase/scenarios/v2-client-base/manifest.json), blob `8183a9260db89562706f4557e80343b5e7ebe235`, is the published source for these **synthetic scenario IDs**, not a claim that records are loaded here.

| Base entity | Published ID / organization |
| --- | --- |
| Pacific Produce / PE | `52000000-0000-4000-8000-000000000001` |
| Altiplano Supply / BO | `52000000-0000-4000-8000-000000000002` |
| Southern Distribution / CL | `52000000-0000-4000-8000-000000000003` |
| PE Lima / Arequipa / Tacna Facilities | `52010000-0000-4000-8000-000000000001`, `...000002`, `...000003`; organization PE |
| BO La Paz / Oruro / Santa Cruz Facilities | `52010000-0000-4000-8000-000000000004`, `...000005`, `...000006`; organization BO |
| CL Arica / Iquique Facilities | `52010000-0000-4000-8000-000000000007`, `...000008`; organization CL |
| Members / cargo profiles / preferences | Manifest prefixes `52020000` / `52040000` / `52050000`, suffixes 1–3 mapped by organization; never use these IDs as credentials |

The base manifest points to `v2-carrier-fleet-80`; it expressly excludes HAC-54 commercial data. Its clock is `2026-10-19T12:00:00Z` with a November 2 horizon. The current Carrier manifest has an October 16 clock, an October 30 horizon and an October 18 sample query window. H4 must choose valid overlapping windows and disclose its clock; do not replay stale examples and call them available now. Select Carriers/services from eligible evidence, not a fixed Carrier for every lane.

HAC-54 will own a separate commercial scenario file under `supabase/scenarios/v2-*/`, with deterministic transaction IDs, rerun safety and the proposed 12 supported cases. No commercial IDs or data are allocated/loaded in H0. Jean owns base manifest/order integration. Do not edit his seed simultaneously or insert demo rows in migrations.

The inspected `.env.local` points to Supabase host **127.0.0.1**. No secret values are recorded. Hosted `cargomesh-v2` access, migration inventory and scenario rollout were **not verified** in this increment and need explicit technical authorization before any hosted writes. A local result cannot establish hosted readiness.

`/clients` can currently resolve to an explicit preview through the assigned-demo policy/local signed cookie. Preview reads use the separate demo surface and reject mutations; they do not establish a Supabase organization member. Connected validation must confirm the real member and API surface, not merely the URL or a successful page render. Consume Jean's pending precedence fix rather than changing his auth files.

## Ownership agreements and actionable gaps

These are published consumer requirements, not evidence that another owner has accepted a request. H0 inventory is ready; the cross-owner acknowledgements below remain open and do not prevent independent H1 work.

| Seam / gap | Owner / next action | Status at H0 |
| --- | --- | --- |
| Actor/Facilities and preview precedence | Jean, HAC-52 / PR #132; consume published contract after integration | Published dependency; not merged or runtime-verified here |
| Saved request and shared filter/component interface | Juan, HAC-53; provide actual `requestId`/version/status and shared component contract | Current canonical DTO reusable; new handoff/sample pending |
| Commercial SQL/schema/wrappers | Luis coordinates a single editor with Cristhian before edits; reuse current Carrier surface | Agreement requested in HAC-54; no shared edits made |
| C6 opportunity request/window snapshot; C3 assessment; recovery/alternate dates | HAC-51 owner; consume additive approved contract, never fork feasibility/recovery rules | Not integrated in this baseline; acceptance dependency where needed |
| SSR page metadata and durable filters | Luis H1; coordinate any change to shared `workspace-server.ts` with Jean and filters/shell with Juan | Concrete source gaps, not yet fixed |
| Correct offer attribution/version and nested correlation | Luis H2; resolve verified name source with Carrier owner | Existing reads reusable; presentation/contract adaptation pending |
| Safe selection retries, legacy booking correlation and resources | Luis H3; retain native rules, version/idempotency evidence | Existing guarded mutations reusable; negative/replay behavior unverified |
| Targeted tracking reads, route/progress/error states | Luis H4 | Existing chain reusable; capped lookup and completeness gap |
| Commercial scenario / hosted access | Luis owns separate transaction file; Jean integrates order; project owner authorizes hosted access/rollout | Not implemented or authorized by this H0 document |

No runtime files, shared schemas, migrations, seed manifests, credentials, infrastructure, Carrier UI or dependencies are changed by this increment. Luis retains responsibility for implementing and correcting the later commercial gaps; integration ownership does not transfer that work to Cristhian.

## Verification and joint-validation script

H0 evidence: clean baseline/fetched SHA and actual sources above inspected; HAC-52/53/51 issue handoffs reviewed; PR #132 contract/manifest inspected at its pinned SHA. `git diff --check` is the documentation integrity check. No build, full suite, database mutation, browser screenshot or end-to-end claim belongs to this source-only cut. PR CI, if triggered automatically, is separate evidence and must not be inferred as already passing.

The real scripts discovered in `cargomesh/package.json` include `typecheck`, `check:architecture`, `test:auth`, `test:shipper-portal`, `test:carrier-commercial`, `test:workspace-modes`, `test:hac40:workflow-http` and `build`. Select focused checks when a concrete implementation/build/integration issue needs them on October 19–20; group the complete validation on October 21. HTTP tests require an explicitly identified environment and authorized scenario. Do not relaunch `release:verify` routinely or copy historical test totals.

| Checkpoint | Build SHA / URL / environment | Steps for October 21 | Human result / shared evidence / correction |
| --- | --- | --- | --- |
| CP-L1 | Not yet assigned to a functional cut | Real client member → Juan's saved request → filter/open/back/reload; verify tenant, windows/cargo, version/status and preserved filters; test empty/partial/error/403 | Not run; no PASS or screenshot claimed |
| CP-L2 | Not yet assigned | Authorized Carrier sees the same opportunity, issues a valid synthetic offer through native action; client re-reads exact Carrier/offer/version; test cross-ID, expired/withdrawn/no-offer/unknown | Not run |
| CP-L3 | Not yet assigned | Explicit selection and booking consent → persisted re-read in both portals; retry same action/key, conflict/stale offer, rejection and missing resources; never authorize automatically | Not run |
| CP-L4 | Not yet assigned | Linked booking/execution/events/route; reported vs conceptual progress, no geometry/events, provider/network failure and retry; positive/negative scenario, mobile/desktop/keyboard/reduced motion | Not run |

Record exact SHA, environment, reproducible steps, observed result and team-accessible evidence with no secrets when these checks are actually executed. New runtime evidence must not be attached to this documentation-only SHA as if it validated later code. Keep HAC-54 In Progress: H0 publication is not a functional delivery, In Review or Done.
