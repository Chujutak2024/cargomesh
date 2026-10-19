# Orders and Pipeline — local connected delivery

Date: 2026-10-17 America/Lima (native evidence timestamps use UTC).

Checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`; application: `cargomesh/`; branch verified as `codex/unified-workspaces-demo-boundary`.

URLs:

- http://127.0.0.1:8080/carriers/orders
- http://127.0.0.1:8080/carriers/pipeline

## Result and current limits

Orders now mounts a dedicated connected workspace inside Juan's existing shell and card/detail composition. The public URL and the legacy `tracking` alias remain unchanged. Orders and Pipeline disable local draft restoration/examples and skip the old private Customer request collection. No Route scenes were removed. Existing sidebar, CSS, dropdown primitives and navigation remain in use.

The directory searches only loaded bookings, filters their derived stage and identifies partial counts. The detail separates Customer authorization, Carrier confirmation, recorded capacity and execution state. It retains incomplete/unproven relationships and orphan operations/reservations with explicit explanations. Customer windows are never reconstructed from resource windows. Dates display UTC explicitly. Price is read from the exact selected offer only.

The nine-column Pipeline board remains. Cards link to connected Requests/Offers and linked Orders; inspection uses the connected Orders detail. No old request editing or offer creation form is rendered in Pipeline. Search, stage filter and selection survive navigation within the mounted Juan coordinator, scoped to operator and Carrier. This is in-memory state, not persistence across a full page reload. Confirmed commands trigger new reads before derived stages change.

### Connected actions

Implemented clients/forms target only the seven existing Carrier command routes: booking confirmation/rejection, booking cancellation, capacity reservation confirmation/release, and operation start/completion/cancellation. Each requires an explicit reason/evidence review and confirmation, current role/state, expected version and a stable idempotency receipt. The backend remains authoritative. DISPATCHER cannot perform commercial booking or hold commands. Partial reads disable commands. Denials hide cached records/forms; aborted or incompatible responses are discarded.

The UI does not allocate vehicles/drivers, create Customer bookings, create capacity reservations or create operations. Creation controls remain disabled with the missing Carrier endpoint explained. Managing assets, combinations, pools, drivers and their assignments stays in Fleet. The frontend sends one requested workflow command; it sends no implicit booking cancellation or hold release. A subsequent read displays any related-record effects performed by the existing backend command.

In the current environment all four booking projections omit `data.offerId`. As a result, selected-offer price, service/assignment proof and full capacity cannot be correlated. Existing records and histories remain visible. Commands requiring those proofs stay disabled. An authorized pending booking can still expose rejection/cancellation when the existing contract and complete read allow them; these were not submitted against business records.

## Files changed

All paths below are relative to the application directory.

| File | Purpose |
| --- | --- |
| `src/features/carrier-juan/connected-orders.tsx` | Juan directory/detail, states and command mounting |
| `src/features/carrier-juan/orders-model.ts` | Strict scope/references, resource/capacity proof and action guards |
| `src/features/carrier-juan/orders-client.ts` | Bounded reads, event history and validated command responses |
| `src/features/carrier-juan/use-connected-orders.ts` | Abortable Carrier/operator reads and refresh |
| `src/features/carrier-juan/order-action-form.tsx` | Evidence review, expected version and idempotency |
| `src/features/carrier-juan/order-records.tsx` | Holds, execution resources and lazy event history |
| `src/features/carrier-juan/pipeline-connections.tsx` | Existing board's related records and Orders inspection |
| `src/features/carrier-juan/orders-model.test.ts` | 17 focused Orders/client regression tests |
| `src/features/carrier-juan/coordinator.tsx` | Correct Orders mount, shared Carrier, return state and local/Customer read exclusions |
| `src/features/carrier-juan/use-local-draft.ts` | Optional activation guard; default behavior retained for existing consumers |
| `src/features/carrier-juan/connected-offers.tsx` | Exact offer ID accepted when mounting an existing detail link |
| `src/features/carrier-juan/juan-route-model.test.ts` | Name clarifies that Orders retains the legacy internal alias |
| `src/features/carrier-portal/connected-commercial-workspace.tsx` | Preserve Pipeline board; filter, links, detail integration and refresh |

`juan-route-model.ts` itself is unchanged. No CSS, server code, contracts, migrations, dependencies, ports or credentials changed. No Git commit, branch change, push, merge, PR or deployment was performed.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed. The flag avoids writing the checkout's incremental cache. `pnpm` attempted to resolve its version from an unavailable registry; installed local executables were used instead, without installing anything.
- Architecture: `node scripts/check-architecture.mjs` passed: 538 modules, 163 client entry points.
- Unit/regression: 107 tests passed, zero failures. Suites cover Orders, Juan route aliases, Offers, local draft regression, navigation, commercial presentation/model/client, API, permissions and workflow/commercial server services. See `TEST_RESULTS.txt`.
- Controlled SSR: 13 checks passed. Includes correct coordinator mount, local hook disabled, preserved board, deep links, missing relationships, partial/empty/denied states, Dispatcher restrictions and explicit command review. See `SSR_RESULTS.json` and its documented adapters.
- Real authenticated HTTP reads: both URLs returned 200; 4 bookings, 4 offers, 4 opportunities, 3 holds, 3 executions; 7 assets, 5 drivers, 3 vehicle assignments and 3 driver assignments. Each inspected execution returned 2 history events. Foreign Carrier booking access returned 403. Zero private Customer request reads and zero business mutations. See `NATIVE_RESULTS.json`.
- Controlled command tests verify stable receipts, expected version/conflict handling, response scope/immutable references, no unauthorized request, no automatic extra commands and stage changes only after a fresh read. These do not certify actual database writes, SQL replay or deployed-role transitions.
- Browser unavailable: `Local browser use is disabled in Work settings`. SSR/HTTP do not validate hydration, actual clicks, focus, responsive behavior, browser Back/Forward state or real persistence. These remain unverified.
- Preservation: 767 files outside this task match their saved hashes. Six pre-edit files are backed up under `before/` (including the unchanged route model). Thirteen source files belong to this task; no unexpected changes or trailing whitespace were found. See `PRESERVATION.json`, `FILES.json` and `SOURCE_DIFF.patch`.

## Evidence and follow-up

Evidence root: `C:/Users/HP/Documents/cargomesh/salida/juan-orders-pipeline-connected-20261017/`.

Read `HAC50_JUAN_ORDERS_PIPELINE_BACKEND_GAPS_2026-10-17.md` for the existing booking projection migration and the minimal separate Carrier creation extension. Read `friction-logs/HAC50_JUAN_ORDERS_PIPELINE_PENDING_2026-10-17.md` for the environment blockers. No pending operation that depends on those capabilities is presented as completed.

All raw test, native read, SSR, backup and hash evidence referenced above is located in the absolute evidence root, not alongside this repository copy.
