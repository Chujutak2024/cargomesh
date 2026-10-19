# HAC-50 / HAC-48 — Coverage before real road calculation

Date: 2026-10-17. Owner: Cristhian. Existing branch: `codex/unified-workspaces-demo-boundary`.
Parent source: `0e6986c057c9bcec75be792e9b56f193268e182b`; this increment remains a local working diff. Main, hosted migrations/seeds, deployment and frontend implementation are outside scope.

## Five-part plan

| Part | Work | State in this increment |
| --- | --- | --- |
| 1 | Validate Carrier/service pickup and delivery zones, exclusions, directed connection, evidence and activity-window validity before calling a map provider | Implemented and verified for server-owned city references and the supported administrative subset |
| 2 | Calculate road geometry with Google and compare returned alternatives by time/distance | Implemented, real provider calls verified, geometry unchanged |
| 3 | Compose vehicle/driver availability, agenda, maintenance, repositioning, depot operations and cargo/equipment constraints | Separate next delivery; existing operational services are not automatically promoted to full route feasibility |
| 4 | Compose border and other requirements, evidence freshness and uncertainty | Separate next delivery; current border dossier exists but route authorization remains UNKNOWN |
| 5 | Publish an authorized minimized Client projection and connect the front/visualization | Coordinate with Client/front owners; the endpoint below is Carrier-private |

## Implemented API

`POST /api/v2/carrier-portal/carriers/:carrierId/road-assessments`

Feature gate: `CARGOMESH_CARRIER_ROAD_ENABLED=true`. The gate defaults off. It does not bypass authentication. Same-origin cookies or the existing verified Carrier bearer identity path are required. The existing role/grant/RLS catalog checks are reused. Responses use `Cache-Control: no-store, private` and vary on Cookie/Authorization. Payload is strict JSON, at most 4096 bytes; no supplied polyline, free coordinates, address assertions or client-selected coverage status are accepted.

Example city-reference request (synthetic service ID only):

```json
{
  "schemaVersion": "2.0",
  "serviceId": "e5000005-0000-4000-8000-000000000041",
  "originReferenceId": "chiclayo",
  "destinationReferenceId": "lima",
  "pickupWindow": {"startsAt": "2026-10-18T08:00:00Z", "endsAt": "2026-10-18T10:00:00Z"},
  "deliveryWindow": {"startsAt": "2026-10-19T08:00:00Z", "endsAt": "2026-10-19T10:00:00Z"},
  "objective": "FASTEST",
  "traffic": "TRAFFIC_UNAWARE"
}
```

Optional `expectedServiceVersion` returns `409 STALE_COVERAGE` on mismatch. Pickup must be future at evaluation; activity windows are ordered and bounded to a 31-day planning interval in this cut. Supported reference IDs come from the existing server-owned `features/v2-workspace/road-locations.ts`. That file's `region` is a UI continent grouping, **not** an administrative region; the new service does not use it as one.

## Coverage and evidence behavior

- The service reads the authenticated Carrier, its selected service, service-scoped areas/lanes and relevant registered partners through `CatalogServiceV2`. It does not consult depots as a substitute for coverage.
- Pickup is checked over the pickup window, delivery over the delivery window, lane validity over the full pickup-start → delivery-end interval.
- A verified matching exclusion with any activity-window overlap blocks coverage. Possible postal, regional or polygon exclusions that cannot be resolved from a city reference stay UNKNOWN and prevent Google calls.
- Missing, future or expired evidence cannot establish a positive decision. Exact canonical administrative values are used; no nearest-city guess, arbitrary radius or inferred country-wide coverage is introduced.
- A registered partner is identified by its persisted partner ID and a current evidenced agreement. `partnerCarrierRef` is optional and not required for a partner outside the platform. This Carrier-only policy does not change Jean's Client evaluator or its SQL parity work.
- Each service needs an explicit active directed ROAD lane. Reverse lanes and composite A→B→C plans are not inferred. A published border prohibition blocks the matching lane; international review remains separate from geographic coverage.
- Collection reads are bounded to 1000 records per kind. A truncated set stays incomplete and cannot authorize routing. Returned evidence includes record IDs/versions, source references, validity and a SHA-256 snapshot fingerprint.
- An eligible result means `PUBLISHED_CITY_REFERENCE_COVERAGE_ONLY` under the Carrier's published catalog. It is not complete shipment eligibility or independently verified physical coverage. Synthetic evidence remains explicitly labelled in the source references.

## Road calculation and timing

Only eligible endpoint coverage permits a provider call. A same-city reference pair cannot define a meaningful intra-city route; it returns `SAME_CITY_REFERENCE` with no fabricated geometry. Disconnected land networks return `DISCONNECTED_NETWORKS` without a Google request.

The provider reuses `server/maps/road-routing.ts`: high-quality encoded geometry, all-leg DRIVE/maneuver validation, ferry/restriction rejection, endpoint sanity checks, deterministic selection and no invented fallback. Scope remains `RETURNED_ALTERNATIVES_ONLY`; truck access remains `UNVERIFIED`.

- With `TRAFFIC_AWARE_OPTIMAL`, the requested departure is explicitly the pickup-window start. This is a single departure estimate, not an SLA for the full window.
- With `TRAFFIC_UNAWARE`, Google rejects a `departureTime`. The adapter omits it and the response exposes `requestedDepartureTime: null` / `timeBasis: TRAFFIC_UNAWARE_BASELINE`. This boundary was observed in a real 400 response, corrected, and covered by regression tests.
- The accepted route is parsed with a strict output schema and correlated to the requested objective/traffic mode. The catalog is read again before returning accepted geometry. Changed records produce `409 STALE_COVERAGE`; the geometry is discarded. Reads are not an atomic database snapshot and commitment still requires revalidation.
- Process-local budget: 10 calls per Carrier per minute, 30 total per process per minute. These counters do not implement a distributed production quota.
- No polylines/coordinate arrays are stored in PostgreSQL or the evidence. Provider geometry is used transiently; safe evidence retains only metrics, counts and hashes.

The endpoint marks `fullEligibilityEvaluated`, `availabilityEvaluated`, `cargoCompatibilityEvaluated`, `transitCountriesEvaluated` and `capacityReserved` false. `travelAuthorization` stays UNKNOWN. Endpoint countries do not prove that every transit country/road is permitted. No prices, arrival confirmation, customs clearance or vehicle positions are invented.

## Measured verification

- **70 Node tests pass:** 31 new coverage/service/HTTP/budget/time-context tests plus 39 routing regressions.
- TypeScript passes; architecture passes (408 modules / 108 client entries observed).
- The native local verifier uses the existing owned bank `hac50_scenario_fleet80_global_v1`, the real Carrier identity/catalog RPCs under PostgreSQL `authenticated`, and read-only transactions. No database contents or schema were changed.
- Default native run: **9 checks**, including two successful Google queries (FASTEST and SHORTEST_RETURNED), reverse lane rejection, outside-city rejection, stale evidence, undeclared composite connection, time-specific exclusion, unauthenticated HTTP and native foreign-Carrier denial. Negative/unknown cases made zero provider calls.
- Separate targeted traffic-aware run: **1 check**, **1** actual provider call with pickup-start departure. No already-passed cases were repeated in that run.

Real C04 Chiclayo → Lima outcomes:

| Objective / model | Coverage | Distance | Provider time | Geometry points |
| --- | --- | ---: | ---: | ---: |
| FASTEST / TRAFFIC_UNAWARE | eligible | 763.193 km | 45,032 s | 16,780 |
| SHORTEST_RETURNED / TRAFFIC_UNAWARE | eligible | 763.193 km | 45,032 s | 16,780 |
| FASTEST / future TRAFFIC_AWARE_OPTIMAL | eligible | 763.193 km | 43,316 s | 16,780 |

Google returned one accepted alternative in these cases, so both baseline objectives correctly chose the same route. This is not evidence that fastest and shortest always coincide. The earlier [five-city live smoke](./HAC48_LIVE_ROAD_VALIDATION_2026-10-17.md) includes a Madrid → Barcelona set with different fastest/shortest candidates; synthetic regression tests also verify objective-dependent selection and ties independently of provider order.

## Reproduction and evidence limits

From `cargomesh/`, reuse existing dependencies and keep the server key in ignored `.env.local`. The test bank must already exist and have its ownership marker. Commands do not apply a migration or seed:

```powershell
node --conditions=react-server --import tsx --test src/server/modules/carrier-road-routing/application/carrier-road-service.test.ts src/server/maps/road-routing.test.ts src/server/maps/local-road-preview.test.ts src/features/v2-workspace/road-locations.test.ts src/features/v2-road-map/road-map-model.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
node --dns-result-order=ipv4first --conditions=react-server --import tsx scripts/qa/carrier-road-native.ts <private-evidence-directory>
node --dns-result-order=ipv4first --conditions=react-server --import tsx scripts/qa/carrier-road-native.ts <different-private-evidence-directory> --aware-only
```

The native verifier supplies a controlled synthetic subject through PostgreSQL claims and calls the real identity/RPC boundary; HTTP authentication is injected for that harness. It **does not** validate a browser-issued JWT signature, a hosted session or the end-to-end Client UI. The transport/unit tests and native catalog checks are separate evidence, not substitutes for that future E2E.

Safe local evidence: coordinator `salida/carrier-routing-20261017/{native-verification,native-aware-verification}`. The initial timestamp failure is retained explicitly; it is not represented as a successful run. No frontend files, Client schemas/shared SQL functions, keys/restrictions, migrations, main or deployment were changed.

## Front / Client handoff

The front can later render `data.coverage`, its reasons/references and the selected `data.routing.alternatives[].points` directly on the supported Google display path. Preserve estimated/source/time/scope labels. Do not call this endpoint as a Client user or fabricate Carrier membership; Client needs its own authorized minimized discovery case (plan part 5). Coordinate any reuse/parity with HAC-51 before treating this bounded Carrier policy as universal discovery.

Research and provider decisions: [Routing/vector tools](./HAC50_ROUTING_VECTOR_TOOLS_RESEARCH_2026-10-17.md). Existing coverage definition: [HAC-50 coverage](./HAC50_CARRIER_COVERAGE_DEFINITION_2026-10-16.md).
