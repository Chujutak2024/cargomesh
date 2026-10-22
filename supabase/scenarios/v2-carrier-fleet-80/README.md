# V2 Carrier fleet scenario — 10 Carriers / 16 Depots / 80 vehicles / 80 drivers

Owner: HAC-50 / Cristhian. Version: 2026-10-16. Provenance: **SIMULATED**.

This is a local test scenario, not a production migration or a live Carrier catalog. It uses existing V2 tables and native read/availability contracts. It creates no Client Facilities, freight requests, offers, bookings, executions, driver assignments, route corridors, road polylines or GPS positions.

## Contents and counts

| Carrier label | Synthetic name | Planned zones | Depots | Vehicles | Drivers |
| --- | --- | --- | ---: | ---: | ---: |
| C01 | Lima Local | Lima | 1 | 6 | 6 |
| C02 | California Link | Los Angeles → San Diego | 1 | 6 | 6 |
| C03 | Texas Corridor | Dallas → Austin → Houston | 1 | 6 | 6 |
| C04 | Amazonas Link | Chachapoyas, Chiclayo, Lima | 2 | 10 | 10 |
| C05 | Central America North | Guatemala City → San Salvador | 2 | 10 | 10 |
| C06 | Border Link | Tacna, Arica | 2 | 8 | 8 |
| C07 | Chile Port Link | Santiago, Valparaiso | 2 | 8 | 8 |
| C08 | Central America South | San Jose → Panama City | 1 | 8 | 8 |
| C09 | Spain Corridor | Madrid, Zaragoza, Barcelona | 2 | 10 | 10 |
| C10 | Japan Corridor | Tokyo, Yokohama, Chiba | 2 | 8 | 8 |
| Total | Nine countries, partial coverage | PE / CL / US / GT / SV / CR / PA / ES / JP | **16** | **80** | **80** |

Each Carrier has GENERAL and CHILLED services: 20 services, 93 CITY area records including one temporary exclusion, 28 explicitly directed lanes, 16 operating policies and 80 capacity calendars. The full fixture contains 607 base rows, including synthetic identities and scoped test grants.

Directions follow the [coverage definition](../../../docs/PRODUCT.md). Local Lima services use distinct pickup/delivery IDs with identical geography. Reverse intercity lanes are not published. A chain of lanes is not a computed road route. Tacna→Arica retains border review; no permit is fabricated.

## Clock and resource cases

Default clock: **2026-10-16T00:00:00Z**. Horizon: 14 days. Query window: **2026-10-18T08:00:00Z–10:00:00Z**.

| Case in that window | Vehicles | Drivers | Implementation |
| --- | ---: | ---: | --- |
| Available | 44 | 44 | Explicit simulated windows and current scenario evidence |
| Busy | 24 | 24 | Vehicle calendar has a PLANNED local repositioning block; driver has consumed its simulated duty budget |
| Maintenance / off duty | 8 | 8 | Vehicle has MAINTENANCE condition and SCHEDULED maintenance; driver is OFF_DUTY, not “in maintenance” |
| Unknown | 4 | 4 | Incomplete UNKNOWN calendar / unknown driver evidence and duty policy |

Busy vehicles are mechanically AVAILABLE but unavailable in the blocked window. They become eligible for a resource-only query starting at the block's end. An operating-status label does not prove availability. Drivers and vehicles share fixture case labels for inspection; this does not create a permanent pairing or an execution assignment.

Repositioning blocks describe synthetic staging within the same locality. Their 900-second movement estimate is fixture input inside a two-hour blocked window, not a Google route or an intercity travel estimate. Geographic coordinates and physical presence remain unknown. `home_depot_id` is administrative only.

All Depots have simulated 24-hour weekly hours in their IANA zone, a shared LOAD/UNLOAD dock with one vehicle slot, parking, and one workshop slot. These are test policies, not real opening hours or staffing guarantees. The CHILLED product declares a synthetic 2–8 °C range with matching asset capabilities; it is not a universal temperature default.

## Files

- `generate.py`: readable Carrier configuration, deterministic IDs and row generation; standard library only.
- `manifest.json`: exact IDs, case labels, clock, expected counts, depot slots and visual mappings.
- `records.json`: generated row inventory for inspection.
- `seed.sql`: generated transactional insert/replay with field-by-field drift checks.
- `guard.sql`: requires an explicit local flag, a local PostgreSQL socket, postgres and a `hac50_scenario_*` database name.
- `verify.sql`: pgTAP counts, ownership, roles, lanes, synthetic provenance and depot limits using authenticated test claims.
- `verify-catalog.ts`: native catalog projections validated by current Zod schemas; current resource availability logic runs against DB readback.
- `run-local.py`: creates a dedicated schema-only database, runs seed/replay/conflict checks and records evidence. It reuses existing Node dependencies.
- `cleanup-probe.sql`: transactional capability probe proving driver DELETE stays protected; it is not a row cleanup command.

The stable UUID namespace begins with `e5`; the next six hexadecimal digits identify the entity kind. IDs are deterministic across regeneration. Existing rows are never silently revised. Same-input replay leaves rows unchanged; changed fixture values fail with `HAC50_SCENARIO_ROW_CONFLICT` and roll back.

## Reproduce locally

From the repository root, with the existing local Docker profile running:

```powershell
python supabase/scenarios/v2-carrier-fleet-80/run-local.py --evidence-dir '<local evidence directory>'
```

Defaults:

- Container: `supabase_db_hac45-carrier-local`.
- Schema source: `hac50_depot_limits_20261015_v3`, which has the HAC-50 depot/projection changes.
- New disposable bank: `hac50_scenario_fleet80_global_v1`.

The runner copies **schema only**, verifies that no source Carrier rows were copied, and marks the new database. Reuse requires its exact scenario marker. It does not reset, drop or seed the source database, modify the app's `.env.local`, or contact hosted Supabase. Verification uses the existing source schema; this is not a fresh replay certification of the entire migration chain.

The guard intentionally rejects an ordinary `postgres` database. For manual psql execution, use a dedicated local bank with the required schema and pass `-v local_only=1`; the `\ir` files resolve relative to the SQL file when used with `psql -f`.

To change the simulation clock, regenerate and select a new empty bank:

```powershell
python supabase/scenarios/v2-carrier-fleet-80/generate.py --clock '2026-10-20T00:00:00Z'
python supabase/scenarios/v2-carrier-fleet-80/run-local.py --database hac50_scenario_fleet80_reclocked --evidence-dir '<new local evidence directory>'
```

A fixed clock makes assertions reproducible. Evidence deliberately expires; re-running against an old clock must not be presented as current live availability. Generate a fresh clock/bank rather than overwriting the old scenario.

## Identity and access

Ten synthetic Auth users and ten Carrier ADMIN operators are linked to their own Carrier with explicit private catalog grants. There are no password hashes, login credentials, tokens, Client memberships or driver portal accounts. User metadata only labels fixtures; it does not authorize access. Native Carrier reads run under `authenticated` with the corresponding synthetic subject.

This bank is not connected to the current frontend. Hosted activation and any frontend login/preview wiring remain separate authorized work. No application fallback from a connected failure to this scenario is introduced.

## Visual reuse

`manifest.visuals` maps the 80 asset IDs to four existing families: rigid, articulated, curtainsider and refrigerated. Their existing poster files are checked on disk. No new model or image is generated, and no unsupported media field is added to strict catalog payloads. Juan can consume this sidecar mapping when the visual integration is coordinated.

## Cleanup limitation and friction record

During validation, production `private.guard_v2_crew` rejected driver DELETE with `42501 COMMAND_REQUIRED`, even as postgres. The attempted transaction rolled back. A successful row-by-row cleanup cannot be claimed without changing that production contract; this delivery preserves it.

The seed is therefore restricted to a disposable, marked database and is safely repeatable. `cleanup-probe.sql` confirms that the guard remains active and no scenario/foreign row changes. No trigger, RLS policy or production function is disabled or rewritten. Database disposal, if wanted later, is a separate explicitly targeted operation; the runner performs no DROP DATABASE.

## Scope of verification

Evidence includes exact counts; 121 pgTAP assertions; 539 canonical record parses; 184 resource-window decisions; 80 existing poster paths; identical replay; conflicting replay rollback; missing local-flag rejection; and preservation of the cleanup guard and a foreign sentinel row.

The resource-only positive cases do not certify complete plan eligibility, legal driver qualifications, border authorization, sensitive-cargo handling across a whole journey, costs, route algorithms, Client integration or live tracking. No hosted migration or seed was applied. Changes remain on the existing Carrier working branch, with no PR or merge to `main`.


## Optional representative demo access — 16 October update

`prepare-demo-access.py` provisions three real local password-login profiles after the base seed is verified: ADMIN for C01/C02/C05, DISPATCHER for C02, and OPERATOR for C05. Ten inert base test subjects remain for isolation tests; the 80 drivers are not login accounts.

The helper runs a separate loopback-only Auth container `cargomesh_hac50_demo_auth` on port 59731 using the existing local Auth image. It leaves the current application URL, environment, Auth container and Vercel settings unchanged. Passwords are generated privately and stored under the current user's temporary directory, outside the repositories; neither credentials nor tokens are printed or committed. The script reports the private file path after successful verification.

The schema-only source bank lacks current Auth migration metadata and the identities primary key. The optional helper compares the complete Auth DDL with the genuine local Auth database, permits only the identified primary-key/comment correction in the isolated copy, then requires exact DDL equality before copying genuine system migration versions. It refuses other drift. No hosted database or V2 migration is changed. See the Auth friction record.

Verification uses the real password grant, authenticated `/user`, native authorized Carrier memberships and denied catalog writes for the two non-admin profiles. Sessions created for the checks are logged out. This verifies local Auth and permissions; the application frontend has not been wired to this isolated environment.

Run after the base scenario verification:

```powershell
python supabase/scenarios/v2-carrier-fleet-80/prepare-demo-access.py
```

The base verification scopes its Auth/operator/grant counts to the deterministic base subjects so optional profiles can coexist. Additional business resources are still detected by exact counts. Seed replay does not change optional passwords, memberships or sessions.

## Update — connected visual profile, 18 October 2026

The same application can now read this persisted scenario using its native Auth/RPC/REST contracts on an isolated local profile at `http://127.0.0.1:8083/carriers/fleet`. Equipment/model associations use the existing 3D catalogue. The original 8080 profile and hosted Supabase remain unchanged. The representative administrator retains access to C01/C02/C05; no additional memberships were granted.

Run `prepare-demo-access.py` then `prepare-local-runtime.py` against the existing marked database, and use `cargomesh/scripts/dev-fleet-scenario.mjs` with the private configuration path. See [the current delivery and startup instructions](../../../docs/PRODUCT.md). The earlier evidence and fixed scenario windows above remain historical/versioned; this profile does not turn the depot animation into actual yard operations.

## Optional regular-driver extension — 2026-10-18

After the `hac50_regular_vehicle_drivers` structural migration, `regular-drivers.seed.sql` defines 80 explicit administrative vehicle/driver pairs with fictional names in this guarded local bank. Apply from this directory with `psql -v local_only=1 -f regular-drivers.seed.sql`. It preserves edited existing associations/names and does not create executions, trip assignments or reservations. The original seed and its historical evidence are unchanged. Driver qualifications remain QA_ONLY, not certified production licences.
