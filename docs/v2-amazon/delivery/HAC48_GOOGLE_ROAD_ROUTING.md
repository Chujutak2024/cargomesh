# HAC-48 — Calculated road geometry and bounded route selection

> Update, 2026-10-17: the local server credential is now configured and five real application city-pair queries passed. See [live validation and IPv4 restart instructions](./HAC48_LIVE_ROAD_VALIDATION_2026-10-17.md). Missing-key statements below describe the historical 2026-10-14 cut; authenticated visual and truck-access checks remain pending.

Research and implementation: 2026-10-14. Issue: HAC-48. Existing working branch: `codex/unified-workspaces-demo-boundary`, dependent on HAC-47 @ `5729571`. No main merge, production deployment, schema migration or operational record changes.

## Decision

Use Google Routes `computeRoutes` to obtain the street-following geometry. Apply a deterministic selection policy to complete, accepted alternatives. Display the provider's points on a Google map. Do not create street geometry by joining city coordinates, smoothing sample vehicle positions, or constructing a guessed graph from a polyline.

**Implemented:** an English local routing lab at `/carrier-route-lab`, linked from the control tower. **Not certified:** live route calculations until the separate server credential is configured and the live smoke passes. The current control-tower shipment traces remain explicitly illustrative; this increment does not connect its sample trucks to calculated routes.

## What the existing implementation actually did

| Layer | Finding | Consequence |
| --- | --- | --- |
| `features/carrier-control-tower/google-operation-map.tsx` | Draws `Shipment.route` arrays from `demo-model.ts` | Those lines do not prove a route along roads. |
| `server/maps/local-road-preview.ts` | Already calls Google, requests high-quality geometry and rejects ferry steps; takes only the first route | Reuse its polyline decoder; add comparison in a separate lab without changing existing callers. |
| `server/modules/workflow/application/route-planner-service.ts` and HAC-40 SQL planner | Searches persisted commercial corridors with bounded paths and versioned policy | This is a commercial network planner, not Google's street network. Do not replace its rules with a map estimate. |
| Browser Maps key | Present in the inspected private local configuration | Authorizes map display according to key restrictions; does not provide the server Routes credential. |
| `GOOGLE_ROUTES_API_KEY` | Absent from the inspected file, shell and supplied `CargoMesh-mapa-misma-clave.zip` | Real city-pair geometry/ETA validation is blocked; never substitute the browser key automatically. The package LEEME explicitly limits its key to Maps JavaScript. |

## Official research and implications

### Route geometry is already vector data

Google returns an encoded polyline or GeoJSON LineString. `HIGH_QUALITY` requests a more detailed path than `OVERVIEW`. Decoding the compressed polyline restores the ordered coordinates; it does not calculate a new road. Draw the returned coordinates directly, without adding a straight connector from city center to the snapped road endpoint. A base map being raster or vector is a different concern from the route being vector geometry. [Polyline documentation](https://developers.google.com/maps/documentation/routes/polylines), [computeRoutes reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes).

### Road access is an estimate, not logistics authorization

`DRIVE` requests a driving route based on Google's known network. A successful response does not establish carrier coverage, permits, border clearance, facility access, current fleet availability or truck suitability. The city's reference coordinate may snap to a nearby road. Lane direction, pickup/delivery permissions, capacity, cargo requirements and commercial policy remain CargoMesh domain checks. Current road closures, private access and restrictions still require suitable authoritative data and operational validation.

Avoidance parameters bias the calculation; they are not absolute prohibitions. The lab requests `avoidFerries` and then inspects every step in every leg, rejecting ferries, ferry trains and non-driving segments. Missing step/maneuver metadata fails closed. Tolls/highways are not excluded by this policy, and costs remain unknown. [Route modifiers](https://developers.google.com/maps/documentation/routes/route-modifiers).

### What “optimal” means here

Google can supply a default route and up to three alternatives; sometimes it supplies only one. Traffic-aware optimal uses a more exhaustive provider search with higher latency. CargoMesh does not have the provider's entire graph or a proof of its global optimum. All returned durations remain estimates tied to the calculation time. [Alternatives](https://developers.google.com/maps/documentation/routes/alternative-routes), [traffic preferences](https://developers.google.com/maps/documentation/routes/config_trade_offs).

The implemented `returned-road-alternatives/v1` policy:

1. Validate each returned candidate independently: positive finite metrics, complete steps, accepted mode, decodable coordinates, no flagged partially ignored restrictions.
2. Reject geometry whose beginning/end lies more than 5 km from the requested city references. This is a lab sanity bound, not proof of road access or a production facility tolerance.
3. For `FASTEST`, sort lexicographically by `(durationSeconds, distanceMeters, providerIndex)`.
4. For `SHORTEST_RETURNED`, sort by `(distanceMeters, durationSeconds, providerIndex)`.
5. Select the first candidate; preserve all accepted alternatives and rejection reasons. No candidate means no geometry.

For the fixed input candidates and metrics, sorting proves the minimum under that tuple: every accepted candidate is compared, ties resolve deterministically by original index. Complexity is `O(n log n)` with `n <= 4`, plus linear geometry validation. This is **optimal among accepted returned alternatives only**, not every possible road, and does not optimize fleet assignments or commercial offers.

Synthetic comparison used by the tests: A = 1000 m / 100 s, B = 1200 m / 80 s, C = 900 m / 110 s. FASTEST selects B; SHORTEST_RETURNED selects C. These numbers and test geometries are invented contract fixtures and are never displayed as real routes.

Google also documents experimental `SHORTER_DISTANCE` reference routes. They may favor dirt/local roads or parking lots. The lab deliberately does not request that feature as a truck recommendation; its distance option compares the normal alternatives already returned. [Shorter-distance routing](https://developers.google.com/maps/documentation/routes/shorter-distance-routes).

### Truck routing: a separate integration

Google now documents Large Vehicle Routing with `TRUCK`, vehicle dimensions/weight and restriction flags. Access must be provisioned for the Cloud project. Documented availability is the contiguous 48 US states and experimental Japan, not Peru. Even this service can return best-effort routes with restrictions ignored; those must not be treated as confirmed safe/legal access. This increment keeps `DRIVE` and `truckAccess: UNVERIFIED`; it does not send arbitrary truck parameters to a project without access. [Large Vehicle Routing](https://developers.google.com/maps/documentation/routes/lvr-routes-etas).

### APIs that solve different problems

| API / technique | Appropriate purpose | Why it is not substituted here |
| --- | --- | --- |
| Routes `computeRoutes` | City A → city B, optional intermediate stops, route geometry | Used by this lab. |
| Routes `computeRouteMatrix` | Travel times/distances for many OD pairs | Does not return the route polyline; fetch chosen route geometry separately. |
| Roads Snap to Roads | Match an observed GPS trace to likely streets | Requires sampled trace points; it is not an endpoint-only route planner. |
| Waypoint optimization | Reorder supplied stops | Different objective from drawing A → B, and has option compatibility requirements. |
| Dijkstra / A* on an owned graph | Find a path with declared directed edges, weights and constraints | No complete licensed street graph is present. Running it on scattered city/vehicle points would invent connectivity. |

[Matrix documentation](https://developers.google.com/maps/documentation/routes/compute_route_matrix), [Roads Snap to Roads](https://developers.google.com/maps/documentation/roads/snap), [waypoint optimization](https://developers.google.com/maps/documentation/routes/opt-way).

Future own-graph optimization requires authoritative directed topology, turn restrictions, access permissions, closures, costs and version/time validity. Dijkstra is applicable to nonnegative fixed costs; A* additionally needs an admissible heuristic. That would prove an optimum on that declared graph only. Google's encoded route is not a downloadable adjacency graph. Do not infer an edge between roads merely because their shapes cross: grade-separated intersections may not connect.

### Display and retention

Google route results shown on a map must use a Google map and retain attribution. Most content is subject to caching restrictions; place IDs have a specific exception. The new lab holds only its current result in memory, clears it on input changes, uses `no-store`, and does not save provider geometry to fixtures, localStorage, a database or a new street dataset. Verify the applicable agreement before future exports, persistence or rendering provider geography in a standalone Three.js map. [Routes policies](https://developers.google.com/maps/documentation/routes/policies).

## Implementation boundaries

- `features/road-route-lab/contract.ts`: explicit provenance, selection scope, objective and unverified truck access.
- `server/maps/road-routing.ts`: fixed Google endpoint, schema validation, decoder reuse and selection.
- `server/maps/road-routing-http.ts`: local-only handler, strict body schema, 512-byte limit, same-origin/Host checks, enabled flag, ten calls per minute per process and in-flight identical-query deduplication. This is a local budget, not a distributed production quota.
- `app/api/local/route-lab/route.ts`: disabled unless both `CM_ENABLE_DEMO=1` and `CARGOMESH_LOCAL_ROUTES_ENABLED=true`. Optional local origin is limited to approved `127.0.0.1:8080` or `:3090`.
- `features/road-route-lab/route-lab.tsx`: explicit Calculate action, cancel/stale-response guard, no automatic paid calls on city changes, no cache of old geometry.
- `features/road-route-lab/route-map.tsx`: only accepted provider coordinates, `geodesic:false`, no smoothing or fabricated connectors. City inputs and sample shipment positions are not turned into a road trace.
- Existing commercial APIs, migrations, truck animations and sample markers are unchanged.

## Simulation and acceptance matrix

| Scenario | Automated simulation | Live / human status |
| --- | --- | --- |
| Lima → Arequipa | Catalog coordinates and provider boundary checked | Blocked: server Routes key absent. |
| Lima → Huancayo | Same, mountain case input | Blocked: road geometry/access not verified. |
| Santiago → Buenos Aires | International case input | Blocked: route and border permissions not verified. |
| Madrid → Barcelona | European input pair | Blocked: no live calculation. |
| Los Angeles → Las Vegas | US input pair | Blocked: no live calculation or truck entitlement. |
| Bogotá → Houston | Disconnected land-network prefilter; zero upstream calls | Browser/HTTP blocked state verified. |
| Missing key/provider failure/no routes | No geometry and stable reason | Missing-key state verified in browser/HTTP. |
| Fastest vs shortest/ties/bad first route | Deterministic selection and independent rejection | Synthetic metric fixtures only. |
| Ferry/later-leg mismatch/reversed geometry | Rejected without replacement line | Provider stub failures, not observed real trips. |
| Concurrent requests/budget/origin/oversize body | Dedup isolation, rate window and fail-closed boundary | Unit tests. |

## Reproduction

Run from `cargomesh/`. Private environment variables belong in ignored local settings or launcher memory. Never commit their values. Existing browser key is reused; the server credential remains separate.

```text
CM_ENABLE_DEMO=1
CARGOMESH_LOCAL_ROUTES_ENABLED=true
CARGOMESH_LOCAL_ROUTES_ORIGIN=http://127.0.0.1:3090
NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY=<existing browser key>
GOOGLE_ROUTES_API_KEY=<private server credential, if available>
```

Commands (do not reinstall through the shared node_modules junction):

```powershell
node --conditions=react-server --import tsx --test src/server/maps/road-routing.test.ts src/server/maps/local-road-preview.test.ts src/features/v2-workspace/road-locations.test.ts src/features/v2-road-map/road-map-model.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-architecture.mjs
node scripts/road-routing-http-smoke.mjs --expect-missing-key
# After configuring Routes, explicit live validation makes at most five paid calls:
node scripts/road-routing-http-smoke.mjs --live
```

Results for this increment: **39/39 tests, typecheck and architecture pass**. Actual Google Maps basemap loaded in the local browser at 3090. Missing server key and disconnected-network states verified; no synthetic roads drawn. A successful live smoke, visual comparison of returned polylines to roads, independent human review and truck-access validation are **pending**. No claim of end-to-end real routing, global optimality or driver navigation readiness.

Human validation card: actor = Carrier operator; environment = local lab; choose each city preset, Calculate, compare alternatives and displayed road line, switch objective, test a disconnected pair. Expected = correct labels/provenance, no stale geometry, no invented fallback. Independent observer result = pending, blocked for real routes by missing server key.

## Next integration step

After live city-pair validation, supply the selected accepted geometry to the control-tower route layer, retain provenance/time and define simulated progress separately from observed GPS. Then validate truck markers, orientation, loading animations and licensing of any non-Google 3D display. Keep carrier serviceability and commercial ranking as independent checks.
