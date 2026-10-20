# HAC-54 H4 — isolated local commercial scenario

This dated recipe is separate from Jean's organization/fleet manifests. It is **not a migration, runtime fallback or hosted seed**. `seed.sql` only returns a JSON recipe inside a read-only transaction; authenticated native commands in `cargomesh/scripts/hac54-h4-local.mjs` perform all business writes.

## Prerequisites and order

1. Use the registered HAC-54 branch and the existing approved local V2 chain. Gateway must be `http://127.0.0.1:61321`, container `supabase_kong_cargomesh-v2-local`; app must run locally, normally port 3000. Other Docker stacks are not touched.
2. Existing `v2-hac54-local-access` accounts/grants and `v2-hac54-h2` published catalog/network references must be present. The runner reuses that recipe and the authorized source request; it does not modify Jean's base/fleet manifests or the H2/H3 shipment.
3. The native booking projection must include `offerId`. This local database has the existing `20261015122904_hac50_booking_offer_projection.sql` applied as documented in the H3 increment. It is not a certification that all other migrations are current. No H4 SQL/schema migration is added.
4. Supply existing local passwords through process environment or an **untracked external** credentials file with Client and Carrier `Password:` lines in that order. Never commit credentials. The independent Carrier OPERATOR issues quotes/reports; an existing Carrier ADMIN signs in through local Mailpit OTP only to configure the synthetic route limits. No new permission grant or password reset occurs in H4.

From `cargomesh/`, PowerShell:

```powershell
$env:HAC54_LOCAL_ACCESS_FILE='C:/path/outside/repository/local-access.txt'
$env:HAC54_LOCAL_AUTHORIZE_SYNTHETIC_BOOKING='1'
node --env-file=.env.local --conditions=react-server --import tsx scripts/hac54-h4-local.mjs
```

The explicit synthetic-booking switch authorizes this test scenario, not a live commercial commitment or a human consent click. Nonlocal gateways and expired recipes fail closed. A running local V2 API is required; no response is replaced by a fixture after a failure.

## Clock, replay and identities

- Package: `HAC54-H4-2026-10-20`; evidence clock October 20 00:00 UTC. Quote/hold expiry October 20 **22:00 UTC**. Resource evidence horizon October 28 00:00 UTC.
- Transport window October 20 08:00 UTC to October 21 06:00 UTC. Departure/completion use native command time, never a backdated start to animate a future transport. H3's October 23 execution remains PLANNED.
- Scenario/action idempotency keys are deterministic SHA-256-derived UUIDs. Replaying the same payload in the same database returns the same native records. Changed payloads correctly produce `409 IDEMPOTENCY_CONFLICT`.
- **Native entity UUIDs are assigned by the backend**, not supplied by these command contracts. The observed ID manifest is in `docs/v2-amazon/delivery/HAC54_H4_TRACKING_INCREMENT.md`. Identical entity UUIDs across newly bootstrapped databases are not implemented/claimed; coordinate any required portable-ID interface with the native workflow owner rather than inserting business rows or weakening guards.
- This recipe refuses writes after expiry. Existing tracking stays readable; a new dated scenario cut is required for fresh commercial mutations on October 21. Never silently shift evidence/quote dates while keeping old keys.

## Twelve selected cases

| Case | Native result |
| --- | --- |
| 01 planned | Confirmed booking/capacity, PLANNED execution; no departure or position |
| 02 transit | Native start + discrete SIMULATED position; no live GPS |
| 03 delivered | Native completion, COMPLETED execution; no invented pickup/reception events |
| 04 incident | Native OPEN CRITICAL incident on an IN_PROGRESS execution; no revised ETA |
| 05 cancellation | Native Carrier cancellation; booking cancelled and held capacity released |
| 06 rejection | Native Carrier rejects PENDING booking; no execution or hold created |
| 07 comparison | Two plans/resources and two native offers from the same authorized Carrier; backend ranking selects the USD 325 alternative over USD 350 |
| 08 refrigerated compatible | Request 2–6°C, verified synthetic capability 0–8°C, eligible native plan and confirmed booking |
| 09 refrigerated incompatible | Capability 10–20°C cannot establish 2–6°C; native result UNKNOWN / `TEMPERATURE_CAPABILITY_UNKNOWN`; selection blocked |
| 10 no coverage | Piura destination without a published service lane; serviceability INELIGIBLE; no fabricated route/offer/booking |
| 11 occupied | Reuses case 01's committed resource; native `RESOURCE_OCCUPIED`, no thermal side condition, selection blocked |
| 12 unknown | Incomplete/UNKNOWN calendar; native `RESOURCE_WINDOW_UNKNOWN`, selection blocked |

All are explicitly synthetic. There is no claim of two real Carriers, external quote receipt, border/LTL recovery or physical delivery. Exact Client/Carrier execution reads match; anonymous and foreign-tenant execution/event/incident reads are denied. Native stale-position/restart-after-delivery commands are rejected. The runner also exercises the same pure tracking assembler used by SSR against those actual records.

During runner development, three earlier composite negative requests (original case codes 10–12) retained thermal requirements because the test input mapper returned a shared nested object. The runner now clones its source and uses `_V2` keys for those isolated cases. Earlier requests remain untouched, unbooked and outside the selected twelve-case manifest. One native review invitation remains on case 09; native invitations are not eligible offers or bookings. See the H4 friction log; no data was deleted to hide these observations.

Jean still owns integration/order of the base manifest. No hosted seed activation is authorized or claimed. These local checks do not replace October 21 joint validation or human CP-L4 acceptance.
