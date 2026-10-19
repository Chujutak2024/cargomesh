# HAC-50 — Control Tower: first connected read increment

Date: 2026-10-17, America/Lima. Branch: `codex/unified-workspaces-demo-boundary`.
Active checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`.
URL retained: http://127.0.0.1:8080/carriers/control-tower

## Implemented

Control Tower now reads authorized Carrier executions, bookings, offers, opportunities, assets, drivers, vehicle assignments, driver assignments and depots through existing scoped APIs. It shares the selected Carrier/operator with the current Requests/Offers/Orders/Pipeline coordinator. The tower's composition, map/list controls, cards, styles and public route remain. Product copy is English.

The accessible directory includes operations and road vehicles without a linked confirmed operation. These are different row kinds, not a shipment count. Catalog operating condition is not represented as date-specific availability. Resource links require matching service/execution and a confirmed assignment whose recorded window overlaps the execution's planned window. Multiple resources remain visible. This is a recorded plan association, not proof of current physical assignment, commitment validity or availability.

Booking/offer/opportunity correlations require non-null organization/request scope and matching identifiers, selected offer service and plan. Missing relationships are shown explicitly. Historical bookings in this environment do not supply the selected offer reference; route/cargo context therefore stays unknown instead of being joined by city or request alone. The order link opens the existing `/carriers/orders/details/<booking-id>` destination.

Operation coordinates require a valid recorded location and non-future `lastObservedAt`. Evidence provenance is retained as VERIFIED/ESTIMATED/SIMULATED/UNKNOWN; a record is never labelled live GPS. Observation time is displayed explicitly in UTC. No observation timestamp is substituted with a technical updatedAt, no accuracy is invented, and stale reports remain last recorded reports without extrapolation. Site coordinates are independent: homeDepotId never supplies a vehicle position.

Google Maps uses the existing loader, browser key and vector map configuration. The connected renderer plots only validated operation/site coordinates, keeps a world view when no coordinates exist, supports fit/focus/zoom controls and preserves the list if the provider is unavailable. It no longer imports the visual demo or draws manual route polylines. The original `demo-model.ts` remains as historical scenario source but is not mounted as an automatic fallback.

Incidents are loaded only for the selected execution, with bounded pagination, scope validation, partial/error states and Open/All filters. This avoids querying incidents for every operation on initial load. A later 401/403 invalidates the tower snapshot; it does not retain another authorized record set as a fallback.

All reads are abortable and Carrier-scoped. Empty catalogs remain empty. Dependent failures and truncated reads are explicit and counts describe loaded records. No new backend endpoint, auth bypass, database write, migration, automatic polling, route-provider calculation or telemetry ingest was introduced.

## Actual environment

`NATIVE_RESULTS.json` records authenticated HTTP reads using the existing configured test identity, with a temporary session revoked using local session scope:

- 3 executions, 4 bookings, 4 offers, 4 opportunities.
- 7 assets, 5 drivers, 3 vehicle assignments, 3 driver assignments, 1 depot.
- Complete catalog reads: no partial metadata or dependent read errors.
- 10 directory rows: 3 operations and 7 road vehicle records without a confirmed operation link.
- **0 recorded operation positions; 0 sites with coordinates.** Thus no native markers can be verified with this data.
- 0 incidents in the three operation-scoped reads.
- Foreign Carrier rejected with 403; anonymous execution read rejected with 401.
- Connected page returns HTTP 200.
- 0 business writes and 0 Google Routes calculation calls.

These are persisted synthetic test records, not a live fleet or the proposed 10-Carrier scenario.

## Verification

- 52 targeted tests passed: 17 tower checks plus existing Orders, commercial correlation and connected Fleet presentation regressions.
- TypeScript passed; architecture passed (541 modules / 164 client entries at the check).
- Browser became available through the user's existing Chrome tab and existing session. Verified: loaded counters, Google Maps ready controls, Map/List switching, operation selection, empty incident read, no-match search, clear search, OUT_OF_SERVICE filter, all-record restoration, linked booking detail in Orders, and navigation back to Control Tower.
- A real development-navigation issue appeared: the dynamically loaded tower lost its CSS after navigating away/back and produced generated-ID hydration warnings. Changed only its coordinator import to a regular component import; Google SDK loading remains deferred to the mounted map. Subsequent reload recorded zero new console/hydration errors and navigation back retained the styled accessibility composition. No shared navigation/styles were rewritten.
- Browser was disabled again in Work settings during final verification. A final styled screenshot, mobile/responsive, keyboard, active-marker interactions, provider-error interaction and multi-Carrier switching were not completed. Earlier desktop screenshots were inspected; `tower-list-desktop.png` is a **diagnostic capture of the transient unstyled state**, not final visual evidence. Do not present it as the delivered UI.

Initial HTTP verification failed inside restricted execution; rerunning the same read harness with approved network access passed. No environment or credentials were changed to get that result.

## Files and scope

Modified existing files:

- `cargomesh/src/features/carrier-control-tower/control-tower.tsx`
- `cargomesh/src/features/carrier-control-tower/google-operation-map.tsx`
- `cargomesh/src/features/carrier-juan/coordinator.tsx` — tower import/mount, existing Carrier selector/source and exclusion from local/Client request hooks.

New files in `carrier-control-tower/`: `tower-model.ts`, `tower-client.ts`, `use-connected-tower.ts`, `tower-model.test.ts`.

The coordinator changed concurrently during Orders work. The first attempt detected a hash change and stopped before writing it. `before/coordinator.latest.tsx` retains the newer Orders version used for the subsequent minimal tower patch; those Orders improvements were preserved. Other screen code, map loader, routes, CSS, models/Three.js, shared schemas, backend and migrations were not changed by this increment. Staging files and the native read harness are retained beside this document.

## Next increment

Connect the coverage-first Carrier road assessment API to a deliberate route calculation/review action and render its original Google geometry. The existing local routing lab remains a separate preview. No geometry is attached to a booking/execution by this increment. Authoritative customer windows and booking-offer projections remain backend dependencies; do not fill them from technical deadlines or resource windows.

To verify actual markers later, supply isolated, clearly synthetic position observations and site coordinates through authorized commands, or use a controlled renderer harness. Do not relabel arbitrary depot coordinates as vehicle positions. Telemetry adapters, freshness policy, GPS, real-time subscription and simulated playback are separate work.

No commit, push, merge, deployment, credential change or hosted migration was performed.
