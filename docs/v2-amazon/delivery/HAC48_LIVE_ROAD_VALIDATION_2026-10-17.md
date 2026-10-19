# HAC-48 — Local Google Routes validation, 2026-10-17

## Scope and source

Existing issue: HAC-48. Working branch: `codex/unified-workspaces-demo-boundary`.
Source SHA: `0e6986c057c9bcec75be792e9b56f193268e182b`. Local endpoint: `http://127.0.0.1:8080/api/local/route-lab`.
Checks ran on 17 October 2026 at approximately 10:15 America/Lima (15:15 UTC).
This verifies the existing backend adapter against the provider. The Carrier/Client front is owned by another chat and was not edited in this increment.

## Credential import and local transport

- Imported only `GOOGLE_ROUTES_API_KEY` from the privately supplied ZIP to the active app's Git-ignored `.env.local`. Other variables, including the browser Maps key and Supabase settings, were preserved. A private backup remains outside the repository. No secret values appear in this document or evidence.
- Package fingerprint (SHA-256): `00fc65f79a5b42b9be920b07b6678c2b651ddf3de8be0c6bbfd8b12ec5df45a6`.
- The package reports IPv4 `181.66.127.175` authorized. Google's initial 403 response identified an IPv6 source and `API_KEY_IP_ADDRESS_BLOCKED`.
- Launching Node with process-scoped `--dns-result-order=ipv4first` produced a successful direct access probe, then five successful calls through the application endpoint. No Cloud settings, API restrictions, OS networking, global Node settings or production deployment were changed.
- Nine provider requests were made in this validation session: three denied IPv6 attempts, one successful IPv4 access probe, and five successful application scenarios. Negative boundary tests did not send valid upstream requests.

## Real city-pair results

All five application requests used `DRIVE`, `TRAFFIC_AWARE_OPTIMAL`, `computeAlternativeRoutes: true`, high-quality encoded geometry and `avoidFerries: true`. Metrics are provider estimates at the recorded calculation time, not truck operating schedules.

| Origin → destination (catalog IDs) | HTTP | Accepted alternatives | Selected distance (km) | Estimated driving time (h) | Selected geometry points |
| --- | ---: | ---: | ---: | ---: | ---: |
| `lima` → `arequipa` | 200 | 1 | 1,008.2 | 18.01 | 26,913 |
| `lima` → `huancayo` | 200 | 3 | 306.7 | 7.47 | 14,640 |
| `cl-santiago` → `buenos-aires` | 200 | 3 | 1,389.0 | 17.99 | 24,739 |
| `madrid` → `barcelona` | 200 | 3 | 627.4 | 5.95 | 24,654 |
| `los-angeles` → `las-vegas` | 200 | 3 | 435.2 | 3.93 | 18,792 |

All accepted alternatives passed the existing adapter's mode/step/maneuver, geometry and endpoint sanity checks. No rejected candidates were observed in these five responses. This is a bounded smoke, not validation of every possible road or restriction.

### Selection policy

The HTTP-selected `FASTEST` result matched an independent minimum calculation over each accepted returned set. Ties use distance and original provider index. The existing 39-test routing suite passed, including shortest-distance selection, ties, malformed alternatives, ferries, missing evidence, geographic boundaries, concurrency and rate limits.

Madrid → Barcelona illustrates the distinction in the same real returned set:

- Fastest: 627.352 km / 21,404 s (5 h 56 min 44 s).
- Shortest candidate in that set: 622.429 km / 21,784 s (6 h 3 min 4 s).
- Difference: 4.923 km saved at 380 s additional estimated driving time.

The five real HTTP requests exercised `FASTEST`. The shortest candidate above was independently identified from the same response; it is not an additional live `SHORTEST_RETURNED` request. Synthetic tests separately cover the native shortest-selection function.

CargoMesh selects the minimum among accepted alternatives returned by Google. It does not claim a global shortest path over Google's private road graph. One returned candidate is valid; multiple alternatives are not guaranteed.

## Boundary checks through the running application

Five checks passed: foreign Origin → 403; identical cities → 400; unknown city → 400; unknown payload field → 400; Bogotá → Houston → HTTP 200 with `blocked / DISCONNECTED_NETWORKS`. No geometry was returned for these checks.

## Local restart and UI handoff

Run from the active `cargomesh/` application directory, with the private server credential already in ignored local settings:

```powershell
$env:CM_ENABLE_DEMO='1'
$env:CARGOMESH_LOCAL_ROUTES_ENABLED='true'
$env:CARGOMESH_LOCAL_ROUTES_ORIGIN='http://127.0.0.1:8080'
node --dns-result-order=ipv4first scripts/dev-local.mjs
```

Reuse a running server, or coordinate its restart first. An existing process must be restarted to pick up this Node transport option. This option is local to the process and depends on the current IPv4 remaining authorized; it is not a Vercel egress solution.

Current portal route: `/v2-workspace#/route-lab`, behind the existing Carrier session gate. The legacy `/carrier-route-lab` URL redirects into the workspace. The old `scripts/road-routing-http-smoke.mjs` incorrectly expects the lab title in an unauthenticated legacy-page response; it stopped at that assertion before provider calls. The backend was verified with a separate HTTP smoke; do not count that old page assertion as passed. Updating the UI smoke and an authenticated visual pass remain pending with the front work.

The front should consume `selectedId`, `alternatives[].points`, `distanceMeters`, `durationSeconds`, `source`, `calculatedAt`, `policyVersion`, `scope` and `truckAccess` from the application response. Draw the provided ordered points on Google Maps directly; do not append city-center connectors, invent intermediate roads or substitute illustrative tower traces. Keep failure states empty and visible.

## Evidence and limits

Local safe evidence folder: `salida/routes-live-20261017/` in the coordinator workspace. It contains `LIVE_RESULTS.json`, `BOUNDARY_RESULTS.json`, `IPV6_BLOCK_DIAGNOSTIC.json`, `ACCESS_DIAGNOSTIC.json` and reproducible validation scripts. Summaries retain metrics, counts and SHA-256 geometry fingerprints, not encoded polylines or coordinate arrays. The private ZIP and environment are outside published evidence.

Not verified by this increment: authenticated browser rendering, road/truck legal access, height/weight restrictions, actual border clearance, customs queues, Carrier serviceability, facility access, crew breaks, commercial pricing or GPS. Santiago → Buenos Aires succeeding as a driving estimate does not change border authorization from unknown/pending. No database writes or migrations were made. No main push/merge/deployment was made.

References: [Google key restrictions](https://developers.google.com/maps/api-security-best-practices), [computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), [original routing design](./HAC48_GOOGLE_ROAD_ROUTING.md).
