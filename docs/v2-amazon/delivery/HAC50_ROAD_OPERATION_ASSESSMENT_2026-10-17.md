# HAC-50 — road operation assessment

Date: 2026-10-17. Branch: `codex/unified-workspaces-demo-boundary`. This is an additive Carrier backend increment. Main, hosted Supabase, deployment and the front are unchanged by this delivery.

## Implemented

`POST /api/v2/carrier-portal/carriers/:carrierId/road-operation-assessments`

The authenticated Carrier supplies an existing service, asset and driver, a supported origin/destination reference pair, pickup/delivery windows and explicit cargo/planning assumptions. The response contains persisted references/versions, coverage, the original Google alternatives, compatibility checks, per-alternative timelines and resource-window assessments. It never creates an order, offer, booking, hold, assignment or final Client decision.

The endpoint uses the existing `CARGOMESH_CARRIER_ROAD_ENABLED=true` server gate and the same process-local provider budget as `road-assessments`. Bodies are strict JSON, at most 16 KiB. It retains Carrier identity, same-origin cookie protection and private/no-store responses. There is no public Client read or anonymous demo bypass.

### Evaluation sequence

1. Read the Carrier-owned asset, driver, service, capability definitions and asset capabilities through the existing authorized catalog RPC. Fleet RPC reads use `serviceId:null`; verify/filter the service after the Carrier-scoped read. Reject foreign Carrier/service/value scope or stale expected versions.
2. Check ROAD/load-bearing status, current operational condition, required equipment, weight, volume, largest-piece dimensions (cm), service admission, temperature and certifications. Use persisted attributes; brand/model/body labels and 3D assets are not eligibility evidence. Known hard failures avoid a billable provider call. Missing capability evidence remains unknown. A piece fitting only after rotation requires review; no packing or stacking optimizer is claimed.
3. Reuse the coverage-before-provider service: published pickup/delivery areas, directed lane, exclusions and validity. Preserve the provider's geometry and returned alternatives. Add a server-only San Diego city reference for the already-published C02 scenario. It is a representative downtown point, not a customer facility or depot.
4. Build each alternative from pickup start: pre-pickup repositioning → loading → driving plus explicitly estimated rest/border time → wait until delivery opens → unloading → post-delivery repositioning. Loading must finish in the pickup window and unloading in the delivery window. Both resources occupy the complete interval, including waits/rest. Unknown durations produce a labelled lower bound; they are not silently confirmed zero. Periods beyond 14 days are outside resource-assessment scope.
5. Reuse the existing fleet/depot application services for each modeled interval. Existing holds, assignments, maintenance, repositioning blocks, calendar evidence, license-date timezone and recorded duty budget still apply. Optional depot demands are checked exactly as supplied, not inferred from a home depot. A longer route can be rejected even when the shortest driving estimate exists. Recheck asset/driver/service/capability versions; discard stale estimates with `409 STALE_OPERATION`.
6. Pick an alternative **for review**, first from modeled `eligible` candidates, then unknown candidates, using FASTEST or SHORTEST_RETURNED with stable ID ties. Ineligible candidates cannot win. `road.routing.selectedId` remains the provider objective's original selection; `selectedForReviewId` is the operation-aware selection. Display the latter and use its matching original geometry. Selection is only over returned alternatives, not a global optimum.

## Inputs and interpretation

| Field | Meaning |
|---|---|
| `road` | Existing `CarrierRoadInputV2`: service, city reference IDs, pickup/delivery windows, objective, traffic and optional expected service version |
| `assetId`, `driverId` | Explicit persisted resources belonging to this service and Carrier; no automatic choice from 80 trucks |
| `expectedAssetVersion`, `expectedDriverVersion` | Optional optimistic snapshot guards |
| `cargo` | Operator assessment assumptions: category UUID, total kg/m³, required equipment or null, largest piece in cm or null, temperature range or null, certifications and hazardous/fragile/oversized flags |
| `planning` | Required reference and ESTIMATED/SIMULATED provenance; six nullable seconds values: loading, unloading, rest, border, reposition before and reposition after |
| `depots` | Zero to six explicit existing depot-resource demands; zero means no depot check, not unlimited dock capacity |

Planning inputs cannot assert VERIFIED provenance. Explicit zero and unknown/null are different. These inputs are **not** an authoritative Client request or a persisted operational policy. Traffic-aware routing still estimates departure at pickup start; loading changes the modeled departure and the result explicitly includes `TRAFFIC_DEPARTURE_APPROXIMATED`. The traffic-unaware baseline sends no timestamp.

## Remaining requirements, deliberately visible

The top-level status is `ineligible` or `unknown`; it cannot claim fully confirmed eligibility. Individual modeled checks may be eligible, with their SIMULATED/VERIFIED provenance retained. Known conflicts dominate unknowns.

- Current physical readiness and repositioning from a verified current position are not established by `homeDepotId` or an operator's duration. `physicalReadiness:UNKNOWN`.
- A recorded duty budget is not a verified jurisdictional driving/break policy. Rest is aggregated and all time conservatively occupies the driver. No multi-day shift, relay driver, overnight rest or legal maximum is invented. The existing availability service's aggregate duty/commitment semantics are reused; reconciling actual duty logs with historic assignments remains a separate policy task.
- Google car routing is not truck access authorization. `truckAccess:UNVERIFIED`, `travelAuthorization:UNKNOWN`.
- Optional depot checks do not prove location-to-pickup/delivery binding, and no facility appointment is inferred. Automated handling/depot binding remains pending.
- Special-cargo permits, complete multi-piece packing and arbitrary capability requirement strings need dedicated evidence/validators.
- The existing border dossier is not composed into this endpoint yet. A cross-border review remains pending; zero estimated border time does not authorize a crossing.
- No Client request version/window projection is consumed. `clientRequestValidated:false`.
- Reads are not atomic. Versions are rechecked, but concurrent agenda/coverage changes can still occur. `requiresCommitRevalidation:true`, `capacityReserved:false`.
- This endpoint evaluates **one asset and one driver**. It is not a fleet optimizer, dynamic task dispatcher or multi-resource reservation transaction.

## Verification

- **104 tests passed**, including 18 new operation tests and the existing coverage/provider, availability, explicit operation and fleet assignment suites.
- TypeScript and architecture checks passed; no production build was run against the concurrent front's shared dev output.
- Native local scenario: **6 checks**, **2 real Google calls**, no writes. Controlled Postgres `authenticated` claims plus native identity/catalog/workflow RPCs; this is not browser JWT or hosted Supabase E2E.
- C02 Los Angeles → San Diego: returned drive estimates 7,002 / 7,920 / 8,100 seconds; modeled total occupancy 16,200 seconds (4.5 h), including handling/wait/repositioning. Both resource windows fit the scenario; the top-level result remains unknown pending readiness/access/policy evidence.
- C04 Chiclayo → Lima: 44,855 seconds driving, 91,800 seconds modeled occupancy; driver fails recorded duty-window/budget checks. No alternative selected for review.
- Busy resources fail in both scenarios using an explicitly labelled memory-only replay of the same Google result; no extra billable queries. Overweight fails before provider access. Local row counts unchanged.
- Evidence keeps metrics, versions and geometry hashes, not provider polyline payloads or credentials. `NATIVE_RESULTS.json` is local under `salida/road-operation-20261017/native/`.

## Reproduce

Run from the active checkout's `cargomesh/` directory:

```powershell
node --conditions=react-server --import tsx --test src/server/modules/carrier-road-routing/application/road-operation-service.test.ts src/server/modules/carrier-road-routing/application/carrier-road-service.test.ts src/server/modules/fleet/application/availability-service.test.ts src/server/modules/fleet/application/operational-assessment-service.test.ts src/server/modules/fleet/domain/assignment-policy.test.ts src/server/maps/road-routing.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
# Requires the owned local scenario bank, Docker and private server credential. Makes two real Google calls:
node --dns-result-order=ipv4first --conditions=react-server --import tsx scripts/qa/road-operation-native.ts <private-evidence-directory>
```

The IP-restricted local Routes credential needs IPv4 egress here. No credential, Cloud restriction or Supabase environment was replaced. No new migration/seed is necessary for this composition; existing catalog/RLS/RPCs remain authoritative.

## Primary reference for the added city point

[City-published San Diego downtown coordinates](https://www.sandiego.gov/sites/default/files/appendicies_f.pdf), rounded city reference at 32.7158, -117.1649; not a commercial service location. Existing [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) remains applicable; no policy or privilege change is introduced.
