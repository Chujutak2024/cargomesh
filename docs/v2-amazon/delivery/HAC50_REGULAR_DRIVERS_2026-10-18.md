# HAC-50 — Regular drivers and natural Fleet cards

Date: 2026-10-18 (America/Lima). Existing branch: `codex/unified-workspaces-demo-boundary`. User accepted both regular-driver association and independent assignment per trip. No push, main change or deployment.

## Implementation

- Natural cards: recorded plate, readable vehicle type, regular/current driver, full record. Technical fleet IDs and recorded make/model remain in the details and stored rows.
- New `vehicle_regular_drivers` table, versioned nullable driver link, RLS, scoped indexes, receipts and audit events. An authenticated ADMIN may change/clear it. Other authorized Carrier roles may read. Same Carrier/service is enforced; resource revisions cannot silently invalidate a link.
- A regular link does not create an execution/reservation, consume duty or confirm qualification/availability. Current confirmed trip driver overrides the displayed regular driver without replacing the administrative relation.
- GET `/api/v2/carrier-portal/carriers/:carrierId/regular-drivers?offset=0`; POST `/api/v2/carrier-portal/carriers/:carrierId/assets/:assetId/regular-driver`. POST uses Idempotency-Key and expectedVersion (0 for initial relation). Every mutation stays in the shared application service/repository/RPC chain.
- Card action sets/changes regular driver using the shared dialog. Driver profile and Scheduling retain their existing flows. Missing migration yields explicit REGULAR_DRIVERS_NOT_INSTALLED and disables the editor; no fake fallback is supplied.
- Condition: visible Not assessed when absent. No synthetic mechanical score is invented.

## Local activation

CLI-created additive migration: `20261019030218_hac50_regular_vehicle_drivers.sql`, registered in the V2 manifest. Applied only to `hac50_scenario_fleet80_global_v1`, guarded by `LOCAL_ONLY:v2-carrier-fleet-80`. Optional scenario file `regular-drivers.seed.sql` adds 80 explicit pairs and fictional natural names. Original business IDs, source seed, availability and trip records remain intact. Existing edited pairs are preserved on reapplication. Hosted Supabase is unchanged.

The 8083 account still has its original three memberships (22 vehicles); this task did not expand access to all ten carriers. Six California records were read with native authentication and projected into cards; sample: QA-02-01 / Rigid truck / Alex Bennett / Regular / Condition not assessed.

## Verification and limits

See private local evidence in `C:/Users/HP/Documents/cargomesh/salida/fleet-regular-drivers-20261018/`: SQL tests, native API and concurrent-write results, actual-record presentation results, before/after scenario counts and migration log. Evidence distinguishes pure presentation checks from actual native API/database operations. No browser screenshot or interaction/responsive certification: browser disabled and existing preference against optional screen reviews.

The preceding natural-card task also corrected an outdated inspection test that required a journey on CM-401–406 despite their lack of journey. Exact pre-change model reproduces that result; baseline evidence lives in `salida/fleet-natural-cards-20261018/BASELINE_CHECK.json` in the primary workspace.

Remote activation, production driver qualifications and a measured mechanical-condition source are separate remaining work. This does not close the broader Carrier/Client integration gate.
