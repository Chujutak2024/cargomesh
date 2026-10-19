# HAC-50 — Independent Carrier scenario delivery

2026-10-16. Existing branch: `codex/unified-workspaces-demo-boundary`. This follows the user's separate authorization to create the scenario after defining coverage. No PR/merge to main, hosted activation or frontend integration is included.

## Delivered

[`supabase/scenarios/v2-carrier-fleet-80/`](../../../supabase/scenarios/v2-carrier-fleet-80/README.md) contains a deterministic generator, transactional seed, manifest, scoped guards, SQL/native-contract verification and local runner.

- 10 synthetic Carriers, 16 Depots, 80 ROAD vehicles and 80 drivers.
- 20 services with independent general/chilled coverage; 93 areas, 28 directed lanes and 16 operating policies.
- Resource-window cases: 44 available, 24 busy, 8 maintenance/off-duty, 4 unknown.
- The busy case uses a local repositioning block and a consumed driver duty budget. It does not pretend that a Client order, booking or execution exists.
- All known evidence is SIMULATED. Registration, license class and duty-budget values are QA input, not legal qualifications or live operational facts.
- 80 visual mappings reuse four existing poster/model families; no new model was created.
- Physical presence and route coordinates remain unknown. Depot affiliation and fixture driver/vehicle case labels do not create presence or permanent assignments.

## Verified locally

Dedicated Docker database: `hac50_scenario_fleet80_global_v1`, created from **schema only** of the existing local `hac50_depot_limits_20261015_v3`. Source data was not copied and the source was not seeded/reset.

| Check | Result |
| --- | --- |
| Exact seeded inventory and native authenticated scope/depot checks | 121 pgTAP assertions PASS |
| Native catalog projections through current Zod schemas | 539 records PASS |
| Existing availability implementation against persisted readback | 184 resource-window checks PASS |
| Existing visual poster paths | 80 mappings PASS |
| Same-input replay | Persisted rows unchanged |
| Changed-input replay | Stable conflict and complete rollback |
| Missing local flag | Rejected before writes |
| Cleanup guard and foreign sentinel | Guard preserved; all data unchanged |

The initial test expected the wrong message for foreign Carrier access; the actual native result is `PT403 FORBIDDEN_WORKFLOW`. The test was corrected to that precise existing contract. No product authorization code changed.

Production intentionally forbids driver DELETE (`42501 COMMAND_REQUIRED`). Row cleanup was therefore replaced by a rollback-only capability probe; no triggers, RLS or production functions were weakened. See the [friction record](./friction-logs/HAC50_SCENARIO_CLEANUP_2026-10-16.md).

Reproduce with `python supabase/scenarios/v2-carrier-fleet-80/run-local.py --evidence-dir <local-directory>`. The fixed clock and a fresh bank are explicit; the runner does not drop databases. See the scenario README before reclocking.

Evidence: `salida/carrier-scenario-20261016/global-verification/RESULTS.json`, `PGTAP.txt`, `CANONICAL_AND_AVAILABILITY.txt`, `SEED.txt`, `REPLAY.txt`, `CLEANUP_GUARD_PROBE.txt`. These are local artifacts, not hosted activation evidence.

## Remaining independent deliveries

Road routing remains separate: actual returned provider geometry, transit alternatives and algorithm limits have not been validated by this seed. Client C3/C6 integration remains coordinated with HAC-51. The new database is not connected to the current frontend; no login credentials, environment change or application fallback was added.

The scenario delivery is locally complete within this scope. HAC-50 as a whole remains open for its separately pending activation and integration work.


### Broader geography and optional demo identities

C02/C03 were reassigned to the US; C05/C08 to Central America. Totals remain 10/16/80/80. The revised base scenario contains 607 rows, 93 areas and 28 lanes across nine countries. Three optional real local Auth profiles have five explicitly scoped memberships. Password login, `/user`, memberships and two non-admin write denials passed. Secrets are stored outside Git. The frontend remains on its existing configuration. Auth compatibility and the readable coverage proposal are documented in HAC50_COVERAGE_PRESENTATION_AND_DEMO_ACCESS_2026-10-16.md.
