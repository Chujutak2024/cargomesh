# Plan 3 demo catalog — PROPOSED / NOT APPLIED

These are reproducible offline proposals derived from D-FICHAS on 2026-10-22 and the `v2-c01-sim-v1` manifest pattern. Nothing was applied to any database. There is no activation runner, SQL seed, migration, API request, started trip or delivered shipment in this package. Cristhian and the Carrier administrator must approve before any activation package is prepared.

| Dataset | Proposed cases | Dedicated resources | Proposed operation window (America/Lima) |
| --- | --- | --- | --- |
| D-01 | One indivisible 1,000 kg crate, 120×100×100 cm, 1.2 m³ | D01 service, truck, calendar and driver | 3-Nov 08:00–14:30 |
| D-03 | Same-resource fit control; negative crate 600×100×100 cm, 6 m³ exceeds the 500 cm truck envelope | D03 service, truck, calendar and driver | 3-Nov 08:00–14:30 |
| D-04 | Free-window control; negative maintenance overlap | D04 service, truck, calendar and driver | Negative 3-Nov 08:00–14:30; control 14:45–18:15 |

D-02 is the existing C-01 operation on 2-Nov and is deliberately absent. Each new proposal uses its own logical resources; none reuses C-01 trucks, drivers, calendars or service. Shared existing actor, synthetic Facility, corridor and route-policy references are snapshots requiring fresh reads and native admission checks before use. No users or grants are created. The catalog has one attributable Carrier, not three competing offers.

The shared A→B corridor is synthetic: (-12,-77) → (-12.5,-77), 100 km, 60 minutes declared driving, 120 minutes lane transit. It is neither Lima–Arequipa nor a verified road map. Its evidence expires 4-Nov 00:00 UTC (3-Nov 19:00 Lima). All proposed windows and resource calendars end before expiry. D-04 uses a synthetic SCHEDULED maintenance block, never a fake booking or assumed return trip. Its control's accepted delivery is 17:45–18:15 so the proposed 18:15 operation end can accommodate unloading.

`D-01-v1.json`, `D-03-v1.json`, `D-04-v1.json` contain closed native payload templates, explicit source hashes and unexecuted cases. New IDs remain logical `$ref` values. Idempotency keys remain null until exact payloads and fresh versions are approved; validation-only deterministic UUIDs are never persisted. Quote policies are dedicated inactive proposals with auto-issue and auto-confirm disabled. The schema-required future `acknowledgeAuthority: true` literal is not a recorded Carrier approval; both approval flags remain false. Synthetic cost inputs are inherited as a documented proposal, not a fixed C-01 quote price or an approved policy.

Only D-01 describes future offer/booking/reservation/assignment counts after actual native consent and confirmation, with an execution remaining PLANNED and no actual start. D-03/D-04 cases forbid offers, bookings and reservations. Offline `eligible` means only that the existing pure ROAD policy accepts the proposed inputs. Native outcomes, live availability, RLS, commercial consent and HTTP receipts remain unverified until a separately approved activation. A failed positive control blocks its negative case.

## Reproduce without any database

With the application's lockfile dependencies installed, run from the repository root:

```sh
node supabase/scenarios/v2-plan3-demo-catalog/build-proposals.mjs
node --import ./cargomesh/node_modules/tsx/dist/loader.mjs supabase/scenarios/v2-plan3-demo-catalog/validate-proposals.mjs
node --import ./cargomesh/node_modules/tsx/dist/loader.mjs --test supabase/scenarios/v2-plan3-demo-catalog/validate-proposals.test.mjs
```

The validator imports existing input schemas and the pure ROAD evaluator only. It checks hashes/rebuild drift, exact logical references, dedicated resources, quantities/weight/volume/dimensions, complete calendars, duty/evidence windows, no C-01 overlap, disabled automation, no persisted outcomes and positive/negative controls. For the policy assessment it narrows accepted pickup/delivery windows to the proposed operation slot, as native dispatch does; this is not an executed dispatch. `SHA256SUMS` and the source manifest hash use UTF-8/LF, independent of Windows checkout line endings.

Activation requires a new reviewed native-command package: reread exact identity/RLS, versions, references, serviceability, documents, calendars, maintenance and repositioning; resolve real IDs from receipts, freeze payloads and idempotency keys, preview every command, obtain approval, then stop on any conflict/difference. No authorization to activate is carried by this catalog. The driver↔truck correspondence remains documentary because driver assignments do not expose an asset/reservation link; contract owner: Cristhian.
