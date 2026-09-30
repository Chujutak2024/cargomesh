# HAC-15 — React workspace and local QA

Date: 30 September 2026 (America/Lima). Branch: `feat/fe2-v2-route-map`. Integration base: `codex/v2-amazon-contracts` at `66a195207379f6f6be3eafd7ace02d254e7cf1c8`. Intended PR target: `feat/cycle-2-integration`. No push or merge is part of this local handoff.

## Scope and source

The user confirmed that the Tech Lead approved expanding HAC-15 to port the newer CargoMesh V2 web shown in the supplied screenshot to React/Next.js and adapt its scenario to the current V2 ROAD contract. This confirmation is recorded here as a user statement; it has not been independently added to Linear. The original standalone HTML/JS workspace remains untouched. The new UI is isolated at `/v2-workspace` so existing V1 and other V2 owner routes retain their behavior.

The page includes the dashboard, a five-step local request, a searchable request list, tracking, a coordinator view, help, ES/EN copy, local browser draft storage, and the HAC-15 `RoadCandidateMapView`. It uses the existing locale provider and component map adapter. It does not invoke a freight request API.

## Scenario and contract boundary

| Field | Local V2 scenario |
| --- | --- |
| Pair | Callao, Peru → Arequipa, Peru |
| Cargo | Industrial machinery, 10 units × 800 kg initially |
| Candidate | One **scenario-only** presentation candidate, not a carrier offer |
| `overallStatus` / candidate status | `unknown` / `unknown` |
| Route provenance | `SIMULATED`, `SCENARIO_SYNTHETIC_GEOMETRY` |
| Distance / transit time | `null` / `null` |
| Other city pairs | Zero candidates; origin and destination markers only |

The map draws only waypoints declared in the scenario contract. It does not infer coverage, capacity, price, booking, dispatch, a truck route, or a Google Routes result from the Google basemap. The local browser draft is not a V2 server record. `RoadCandidateMapViewProps.region` accepts `string | null` to match the HAC-14 parent contract; the map type remains a temporary type-only mirror pending integration with the HAC-12 executable schema.

## Local runtime QA

The new Next.js page was tested in the Codex integrated browser at `http://127.0.0.1:8080/v2-workspace`. Port 8080 is authorized for the existing browser Maps key. The key was copied into ignored `cargomesh/.env.local` only for local use; its value was neither printed nor added to Git. With no authorized key for a different port, the map may show its unavailable state there.

| Check | Result |
| --- | --- |
| Dashboard and role switch | PASS: client and coordinator views render; coordinator view has no invented carrier result |
| ES/EN | PASS: headings, navigation, and request flow switch language while retaining the current workspace view |
| Request steps | PASS: Context → Route → Cargo → Schedule → Review; empty dates block advancement |
| Save and reload | PASS: local `Saved for review` state and dates persist after a browser reload |
| Edit after review | PASS in model test: route changes invalidate completion and review state |
| Google Maps | PASS on authorized localhost: Google tiles, markers, declared simulated line, Google logo/attribution, and a truthful provider note were visible |
| Zero candidates | PASS: Callao → Piura shows no candidate, no route line, and a no-geometry note while retaining markers |
| Responsive | PASS: at a 390 px viewport, document width remained within the viewport (`scrollWidth` 375 px) |
| Browser console | No application error observed. Google emits its existing `google.maps.Marker` deprecation warning. |

The Google map was visually inspected in the integrated browser. This document does not claim that a new screenshot file was saved for the React page. The existing HAC-15 ADR contains separate earlier map QA evidence for the map component.

## Automated checks

- `pnpm typecheck`: PASS.
- `pnpm test:v2-road-map`: 6/6 PASS.
- `pnpm exec tsx --test src/features/v2-workspace/workspace-model.test.ts`: 4/4 PASS.
- `pnpm check:architecture`: PASS, 232 modules and 29 client entry points.
- `pnpm build`: PASS; `/v2-workspace` appears in the Next.js route table.
- `pnpm test:release`: PASS, including 42/42 Hono tests.

## Open integration limits

- This route has no server persistence, authenticated tenant data, carrier serviceability response, Google Routes call, or shipment tracking feed. Those outcomes must not be inferred from the local demo.
- HAC-14 owns the production parent state and mapper. Integration must consume the canonical HAC-12/HAC-14 types when those branches are merged by the authorized integrators.
- The synthetic waypoints illustrate the scenario and are not a verified road path. A future real route needs provider provenance and separate validation.
- The local Google key is restricted to its authorized origin. A different local port or preview origin requires its own authorized referrer before Google Maps will render there.
- The existing `google.maps.Marker` API still works but emits a deprecation warning; migration to `AdvancedMarkerElement` can be planned separately.

No PR was merged, no remote service was changed, and no key is stored in tracked files.
