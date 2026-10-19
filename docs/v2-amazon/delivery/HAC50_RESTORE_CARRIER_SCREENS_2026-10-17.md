# HAC-50 — Restore existing Carrier screen presentation

Date: 2026-10-17
Working branch: `codex/unified-workspaces-demo-boundary`
Reference HEAD: `0e6986c057c9bcec75be792e9b56f193268e182b`

## Accepted scope

Restore Juan's existing Carrier screen composition while retaining the connected backend. Keep current routes and dropdown/sidebar improvements. Pipeline remains an independent screen. Juan owns the pending 3D model and depot-orchestrator delivery; this work does not integrate that delivery.

Fleet restoration is documented separately in `HAC50_RESTORE_JUAN_FLEET_PRESENTATION_2026-10-17.md`. This continuation covers the other screens.

## Applied presentation

| Screen | Existing presentation reused | Connected responsibilities retained |
| --- | --- | --- |
| Dashboard | Original summary, selector, metrics, journey layout and reference truck | Authorized opportunities/offers/bookings and existing detail action |
| Requests | Original request directory and cards | Current opportunity version, cargo and response deadline |
| Offers | Original directory and review composition | Scoped opportunity linkage, quoted price, expiry, existing offer actions/forms |
| Orders | Original directory and review composition | Booking authorization, linked execution and recorded operation window |
| Sites & coverage | Original depot cards and selected-depot detail | Actual depots, service areas, directed lanes, exclusions, validity and operating policy/forms |
| Help | Existing two-column guidance composition | Carrier responsibilities and existing navigation |
| Pipeline | Board unchanged | Existing operational flow retained |

The implementation reuses existing CSS modules. It does not add a new visual system. New presentation adapters translate authorized records into those components. Missing values remain pending: no invented ETA, progress, cargo, route, availability or assignment. The dashboard reference truck is explicitly illustrative. The response deadline is not used as an arrival estimate.

Depot selection is synchronized with the existing operating-policy workspace. The policy editor and its authorization/version checks remain in place. No business API or database migration was changed for this restoration.

## Files

New: `commercial-presentation.tsx`, `commercial-presentation-model.ts`, `commercial-presentation-model.test.ts` under `cargomesh/src/features/carrier-portal/`.

Adapted: `connected-commercial-workspace.tsx`, `connected-carrier-network.tsx`, `depot-operations-workspace.tsx`, `connected-carrier-workspace.tsx` in that directory.

## Verification

- 40 targeted tests passed: presentation mapping, commercial model/client, permissions, workspace model and navigation.
- TypeScript `tsc --noEmit --incremental false`: passed after the final journey layout addition.
- Architecture check: passed, 452 modules and 118 client entry points.
- Five server-rendered component checks passed. CSS imports, locale, reference scene and links are stubbed; this verifies markup and pending-data behavior, not browser layout or 3D animation.
- Native HTTP authenticated read: dashboard, requests, offers, orders, sites, help and pipeline returned 200. Authorized snapshot: 4 opportunities, 4 offers, 4 bookings, 3 executions, 1 depot and 1 service; no partial catalog.
- Zero business writes. Temporary verification session signed out with Supabase `scope=local` to preserve other browser sessions.
- SHA-256 comparisons confirm routing/navigation files and the Pipeline JSX branch unchanged from the start of this continuation.

Evidence: `salida/carrier-screens-restore-20261017/` in the primary checkout, including `tests.log`, `NATIVE_RESULTS.json`, `PRESERVATION_RESULTS.json` and the server-render harness.

## Limits and pending work

Browser automation is disabled in Work settings, so visual layout, responsive behavior, clicks, hydration and animation have not been verified in a browser. The server-render harness does not replace those checks. Open the running application for manual visual review, starting at `/carriers/offers`.

The current authorized Carrier has one depot. Additional depots or models are not fabricated to populate the restored layout. Juan's multi-truck depot simulation and model updates remain a separate delivery. This work is local; no commit, push, merge, production deployment or hosted migration was performed.
