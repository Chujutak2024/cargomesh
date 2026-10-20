# HAC-54 — H2 opportunity, offer attribution and comparison increment

## Delivery boundary

- Owner: Luis; integrator: Cristhian Chujutalli.
- Registered branch: `codex/v2-client-commercial-operations`; incremental draft [PR #133](https://github.com/Chujutak2024/cargomesh/pull/133), target `main`.
- Parent delivery: H1 at `03903a445ef0ff090bc3e78e98047c2ad202f5d2`. The fetched main reference observed during this cut was `c7e394db3c0d2d135011ad601df161cf05b61620`; its code and existing H0/H1 commits are preserved.
- This is section 3 / H2 only. It implements the client adapter and presentation changes below. It is **not** CP-L2 acceptance, an integrated main release, or completion of HAC-54. H3 selection/retry/resources/history and H4 tracking/commercial scenario remain separate increments.
- The October 19 plan remains in force: share construction increments now; joint runtime/visual validation on October 21. No routine UI audit, screenshots, full release suite or deployment is claimed for this cut. Existing CI remains enabled.

## Implemented surfaces and contracts

| Surface | Implementation and authority |
| --- | --- |
| `/clients/requests/:id`, connected implementation | Reads the exact authorized request, workflow collections and a narrow authorized catalog projection. Existing routes/authentication and explicit preview separation are unchanged. |
| Carrier conversations | Persisted plans grouped by native Carrier/leg assignment IDs; backend eligibility and request version; existing opportunity status, deadline and offer count. An explicit confirmation can create an opportunity for a current eligible plan. |
| Quote request | Existing `POST /api/v2/freight/requests/:id/opportunities`, canonical `WorkflowInputsV2["opportunities.create"]`, same intended payload/key on retry within the mounted view, synchronous in-flight guard and correlated response validation. Native backend remains authoritative for permission, freshness, capacity and idempotency. |
| Carrier identity | Existing member-authorized catalog `GET /api/v2/carriers/:id`; `commercialName` is distinct from offer `carrierReference`. Missing/denied/unavailable identity displays its native ID and explicit unavailable state, never a guessed name. |
| Service/channel | Existing `GET /api/v2/carriers/:carrierId/services/:id`; only the intersection of active loaded services' published response channels is offered. No implicit MANUAL/API/MCP capability. Catalog reads deduplicate IDs, use concurrency four and a 128-record enrichment budget; unread entries are explicitly INCOMPLETE. This is a view budget, not a limit on supported Carriers. |
| Comparison | Native ranking order/position/score, quoted total/currency, Carrier/offer version, timing, earliest expiry and terms. Horizontal table scroll is confined to its accessible region; details wrap on narrow layouts. Current layout still requires the scheduled browser check. |
| Offer details/history | Separate commercial `offerVersion` and technical envelope `version`; quote/source/issuer/evidence, service class, breakdown, conditions, nullable timing/capacity and superseded version reference. Withdrawn/expired/superseded records remain inspectable but cannot become selectable current alternatives. |
| Commercial refresh | Request plus routes/plans/opportunities/offers/ranking/decisions/bookings; exact organization/request/kind checks, required page metadata, bounded cursor progression and duplicate-ID detection. Retains comparison only when the same plan and exact offer IDs still exist. An unsuccessful refresh labels retained data as old and blocks invitations/selection/booking until recovery. |
| Contextual explanation | Existing `buildOfferBriefing` and Juan's `NovaVoicePreview` are reused. The client passes its validated commercial context to the explanation helper. Incomplete request/plan/opportunity references never produce a recommendation. See the voice adapter limit below. |

The new `commercial-context.ts` is a **projection-integrity adapter**, not another eligibility engine. It validates the canonical CarrierOffer contract and correlates envelope/embedded request, organization, Carrier, opportunity, plan, assignments/services, request revision, ranking policy and quoted total. It does not recalculate eligibility, coverage, availability, score or rank. Native writes must still revalidate current data.

An opportunity is not a quote, an external notification delivery receipt, a hold or a booking. This increment records the native opportunity; it does not claim that an API/MCP/external delivery integration exists merely because a published channel is listed. An authorized Carrier must use the existing Carrier portal/native action to respond and issue an offer. The client never assumes Carrier identity or modifies the Carrier portal.

No automatic plan/resource inference is introduced. If there is no persisted, eligible current plan, the page explains that dependency and does not turn a serviceability candidate into an opportunity. The native route/plan operations already exist; preparing a valid plan requires real route/resource/evidence inputs, not a guessed resource assignment. The deterministic commercial scenario remains H4.

## Checks actually executed

| Check | Result and limitations |
| --- | --- |
| `pnpm test:client-operations` | **73/73 PASS** after the final feature changes. Focused H0/H1/H2 adapter tests; includes native request scope, page metadata/cursor/duplicates, catalog identities/channels/budget, complete quote chain, stale request version, future/expired/withdrawn/superseded quotes, mismatched ranking policy/price/assignments, opportunity payload/retry correlation and 401/403/409/503/network failures. |
| `pnpm typecheck` | **PASS** after final source/test changes. |
| `pnpm check:architecture` | **PASS**; import-boundary verification, not live authorization. |
| `git diff --check` | **PASS** before sharing the increment; CRLF normalization notices are not functional failures. |
| Local startup/configuration read | Existing `http://localhost:3000/clients/requests` returned **307 to login**. Configured Supabase hostname is `127.0.0.1`; anonymous key exists. Client-specific local email/password are not configured, nor were matching local QA credential settings found. No secret values were printed or changed. |

Tests inject explicitly declared contract records from `*.test-fixtures.ts`. These files are not imported by runtime components and are never automatic data fallbacks. A mocked native response proves adapter behavior, not persistence, a Carrier-visible opportunity, hosted authorization, browser interaction or voice audio. No authenticated positive transaction or CP-L2 pass is asserted.

No new dependencies, SQL/migrations/seeds, RLS, shared schemas, shared auth, shell/sidebar/filter components, Carrier wrappers/UI or Nova component files were modified. No hosted data/configuration, main push, merge or deployment was performed.

## Concrete pending integration and validation

**Local-access follow-up:** the user subsequently authorized local test provisioning. Existing Client credentials were verified and a separate local OPERATOR was created; real native HTTP/SSR reads and the expired-offer negative case now pass. The local credential blocker below is historical and **resolved**, not a current dependency on the team. See [October 20 local evidence](HAC54_LOCAL_ACCESS_2026-10-20.md). Fresh quote issuance, interactive/audio acceptance and the shared voice-context extension remain unvalidated/pending as described there.

1. **Authenticated environment:** use a real active organization member and an independently authorized Carrier operator in the intended environment. This local configuration has no configured Client test credentials, so the authenticated client/Carrier run was not executed. Do not confuse preview sessions with memberships. Obtaining valid access is an environment prerequisite, not a requirement for Juan to personally manufacture a request ID. A permitted request can be created through the existing native flow or selected from authorized persisted data.
2. **Shared integration:** HAC-52 preview/member routing and base contracts remain outside this branch. Reconcile against authorized integration; do not copy another owner's auth/Facilities or apply hosted migrations. A single-editor agreement remains required before shared SQL/schema/Carrier projection changes; H2 does not need those edits for catalog attribution or opportunity creation.
3. **Voice adapter:** `src/app/api/v2/conversation/voice/session/route.ts` currently loads only offers/ranking for `offerRequestId`. That shared route does not supply the complete request/plans/opportunities to `buildOfferBriefing`. Its legacy call now safely refuses a verified recommendation; the client explanation receives complete context. Extending the authenticated server voice context must be coordinated with Juan's surface owner. Voice audio, renewal and end-to-end recommendation are **not validated or declared complete** here. No browser-supplied facts are promoted to trusted server context.
4. **Persisted commercial data:** at least one current evidence-eligible plan/opportunity and a Carrier-issued current quote are necessary for CP-L2. Missing plan, service channel or quote is shown explicitly; the client does not create fictional alternatives. Use native authorized operations; building/loading the deterministic commercial seed is H4, not silently done in H2.

## CP-L2 script for grouped validation on October 21

1. Open `/clients/requests`, choose an authorized persisted request (or create it through the existing intake), and record its ID, organization and revision. Open the detail. Confirm request facts remain unchanged while examining commercial data.
2. With a current eligible persisted ROAD plan, review Carrier, services and native assignment IDs. Choose a published response channel and a future deadline no later than pickup end. Explicitly confirm **Send opportunity**. Reload and verify the persisted opportunity ID/version. An invalid deadline, permission error or native conflict must remain an error, not a sent state.
3. Independently sign in as the authorized Carrier operator. Open the existing commercial portal, find that exact opportunity/request/plan and issue a synthetic quote via its valid native action. Record its ID, Carrier ID, issuer, source, `offerVersion`, price and validity. Client membership alone must not permit this action.
4. Refresh the Client detail. Verify exact correlation and actual commercial name distinct from quote reference. Inspect price/breakdown/conditions/timing/provenance and native ranking policy. If ranking has not been persisted, the UI must not invent or select a recommendation. Use the existing native ranking operation with a published policy where authorized.
5. Exercise quote revision/supersession, withdrawal/expiry, absent ranking/plan, stale request version, missing catalog identity, unavailable backend and expired session. Old/unverifiable data must not become a selectable quote. Refresh recovery must use the new read. Comparison and explanation must preserve backend order/position.
6. Review desktop/mobile/keyboard: table scrolling within its region, readable versions/terms, dialog errors, explicit consent and navigation. Check request identity from both actors against persisted native records, not labels alone. Voice is a separate pending adapter/audio check above.

Record the build SHA, exact environment, scenario, actions/results and shared evidence. No manual PASS is required before independent authorized H3 construction under the updated plan; CP-L2 remains pending until actually exercised. HAC-54 stays **In Progress**.
