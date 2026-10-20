# HAC-54 — H1 Operations, detail and Dashboard increment

## Boundary and ownership

This follows the [H0 contract/inventory](./HAC54_CLIENT_COMMERCIAL_CONTRACT.md) on `codex/v2-client-commercial-operations`, target `main`. Starting HEAD: `bba165827983986f305b8040391e3c9b2e4d233a`; fetched `origin/main` remains `c7e394db3c0d2d135011ad601df161cf05b61620`. No cross-member branch was merged, no main push or merge performed.

This is **section 2 / H1 implementation**, not final HAC-54 delivery. H2 offer attribution/version, H3 booking/resources/recovery and H4 tracking/scenario remain separate increments. The actual request handoff from HAC-53, integrated HAC-52 identity/base data and October 21 joint validation are not replaced by unit-test fixtures or this document.

Luis owns the added Operations read/presentation adapters. The existing `workspace-server.ts`, auth/Facilities implementation, Carrier commercial wrappers, workflow schemas/SQL, shell/sidebar, Nova and shared draft state are unchanged. The pending shared-editor agreement is still required before changing commercial SQL/schema/projections. No new endpoint, business state machine, dependency, migration, seed or hosted write is introduced.

## Implemented

| Surface | Increment |
| --- | --- |
| `/clients/requests` | Native paginated request reads, explicit range/completeness, previous/next range links; filters/search/sort/UTC dates and selected request live in the URL, not a second saved data store |
| Operations navigation | Requests / Bookings / History links using the existing URLs and `WorkspaceLink` namespace handling; detail return uses an allowlisted view, retaining query state |
| Request list | Persisted status/version, origin/destination, full pickup/delivery windows, cargo totals/description; selected-row highlight and focus restoration; clear filters and honest loaded/matched counts |
| `/clients/requests/:id` | Exact authorized request read before workflow; request details show current version, both windows, cargo units/packaging/equipment/requirements and declared temperature when present |
| Partial detail reads | Explicit failed/truncated resource notice with retry. Commercial summaries/actions and draft mutations remain blocked until a complete read. Independent serviceability reads remain possible. Recovery remounts the detail from fresh server props instead of retaining the failed snapshot |
| `/clients` Dashboard | Same native collections as Operations; exact count only for complete reads, `n+` as a known lower bound for bounded reads, `—` for failed reads. Recent activity is labeled as loaded activity when incomplete |
| `/clients/bookings` / `/clients/history` | Same Operations tabs and paginated read adapter; failed reads are not empty-success states; incomplete offer/decision reads do not produce inferred booking commercial details; incomplete history does not produce a fabricated outcome summary |
| CI | Additive `test:client-operations` step; existing gates remain enabled and unchanged |

The native request/workflow/Facility services, repositories, Supabase member session, RLS and DTOs remain authoritative. A mismatch of member/request organization, record organization, workflow kind or request scope is rejected. 4xx errors and schema/invalid pagination responses are not recovered as empty collections.

### Pagination and scaling contract

`operations-collection.ts` reads native pages of 100 records, at most five pages (500 records) per collection per render. It validates page metadata, cursor progress and unique IDs. A complete read is claimed only when it started at offset zero and the native API reached its end. A later-page failure keeps only already observed records and reports an unavailable read; counts do not claim a total.

The requests view provides range navigation beyond the first 500 using the native offset contract. Filters/search/sort apply to the loaded range, **not a fabricated organization-wide search**. The banner discloses that scope. Bookings/history reference collections and Dashboard currently use a bounded initial range; their notice remains visible if truncated. Further workflow-specific pagination belongs to H3/H4. Native API offset bounds still apply. These reads are not a transactionally consistent multi-query snapshot; native freshness/version checks remain required before mutations.

### Presentation state contract for HAC-53 consumers

`features/shipper-portal/operations-query.ts` is a pure presentation adapter, not a shared business-rule replacement. Its URL fields are:

- `q` (max 200 chars), `status` (canonical request status or ALL), `sort` (UPDATED_DESC / UPDATED_ASC / PICKUP_ASC).
- `from` / `to` (valid ISO calendar dates; comparisons use UTC update dates).
- `selected` (request UUID), `offset` (native request range), `view` (requests / bookings / history only, never a free-form return URL).

Typing/filtering uses native history replacement integrated with Next navigation, without fetching the entire SSR page on every keystroke. The text input has an immediate presentation value synchronized from the URL. Unknown query parameters are retained during filter changes. Opening a record records selection in the source history entry and carries the canonical filter state into the detail/return link. The installed Next 15 router source was checked: internal `__NA`/`_N` markers must not be passed back to its patched history API because that bypasses search-parameter notification; the adapter retains application metadata and lets Next copy its own markers. Browser behavior still needs the scheduled human check; serialization tests are not browser evidence. Juan can consume this adapter or agree an integration with his published filter interface later; no shell files were edited to assume such an agreement.

Existing explicit demo consumers continue to use their own data surface and route namespace. Seeing `/clients` alone does not prove a connected member session. The HAC-52 preview-precedence fix remains in PR #132, not merged here. Do not claim the new connected server read path was tested by opening a local visual preview.

## Checks actually executed

| Check | Result / scope |
| --- | --- |
| `pnpm typecheck` | PASS after correcting an inferred union type in the new read-issue adapter; final integration check recorded with the delivery SHA |
| `pnpm check:architecture` | PASS; validates the new browser/server import boundary, not live authorization |
| `pnpm test:client-operations` | 21/21 PASS: beyond the former first page, bounded/later/empty/unavailable reads, failed later page, 400/401/403/404/409 propagation, invalid schema/page, duplicate IDs, invalid offset, native tenant rejection, query roundtrip, safe return view, dates, namespace, history metadata and filtering/sorting |
| `git diff --check` | PASS for the working increment |
| Anonymous startup check | Existing server at `http://localhost:3000/clients/requests` returned 307 to login; no authenticated session/data or visual validation claimed |

The focused tests use explicit unit-test records and injected service responses. They do not demonstrate hosted data, an actual commercial transaction, voice behavior or browser Back/Forward. No production build, broad release suite, pgTAP, routine screenshots/benchmarks or end-to-end workflow was run for this increment under the current October 19–20 plan. Added automatic CI is allowed to run normally; its results must be observed separately, not inferred here.

## How to open and validate CP-L1 on October 21

Use the registered branch and a **real authorized Client member**, not an assigned/local preview session. Reuse the running local app, or run `pnpm dev:local` from `cargomesh/` using the intended local profile. No additional migration is required by H1; this does not resolve unrelated environment/schema prerequisites.

1. Open `http://localhost:3000/clients/requests` and locate the real saved request handed off by Juan. Confirm organization, version, state, both windows and cargo values against the persisted DTO.
2. Set search/status/sort/date filters, open the request, inspect Request details, then use Back to Operations and browser Back/Forward. Confirm URL fields, selected-row focus and filters; reload and repeat.
3. Switch Requests / Bookings / History without changing route namespaces; inspect a linked request and return. Do not confuse physical events with request business history.
4. Check Dashboard against the same persisted collections. An incomplete collection must be labeled and cannot appear as a definitive zero/organization total.
5. With authorized isolated test data, exercise >100 records and a bounded >500 range; use range navigation. Inject a concrete service failure only in an explicit test environment: partial details must show unavailable resources, keep request facts readable, block selection/booking and allow retry. Successful retry must use the newly read snapshot.
6. Attempt an unauthorized/cross-organization request, expired session and invalid ID. Confirm denial/not-found/login behavior, never a fixture success. Repeat desktop/mobile/keyboard; review responsive wrapping, focus and reduced motion.

Record the tested build SHA, exact environment/scenario, observed actions/results and team-accessible screenshots. **CP-L1 has not been executed or passed by a human in this increment.** No screenshot or approval is invented. The current plan does not require waiting for that PASS to build another authorized increment; this session stops after H1 because the user requested the next section only.

## Remaining dependencies and limits

- HAC-53 has not yet published a new real saved request/component handoff in the inspected issue comments. The canonical request DTO is consumed, but acceptance against Juan's new flow is pending.
- HAC-52 PR #132 contract/identity/base scenario still requires authorized integration. This branch does not copy its auth/Facilities changes or apply its migrations.
- Hosted `cargomesh-v2` access/schema/data rollout remains unverified and separately authorized; no hosted credentials or data were changed.
- Offer Carrier name/source/version and full nested correlation remain H2; safe retry/version/concurrency, booking resources and recovery remain H3; tracking/geometry and deterministic commercial seed remain H4.
- The browser/rendered layout, production build and complete positive/negative connected flow remain unvalidated. No final HAC-54 or visual-redesign completion is claimed. HAC-54 remains In Progress.
