# HAC-48 / HAC-50 — Google road planning inside connected Control Tower

Date: 2026-10-17, America/Lima. Branch retained: `codex/unified-workspaces-demo-boundary`.
Checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`.
Application: nested `cargomesh/`.
URL retained: http://127.0.0.1:8080/carriers/control-tower

## Implemented flow

The existing Control Tower now contains an expandable **Road route planning** section. It preserves the original map/list and operational cards; it does not replace Orders, Fleet, Sites or the existing road-routing lab.

1. Opening the planner reads authorized ROAD services and the server-supported representative city references. No provider calculation is triggered on mount, refresh, field edit or alternative selection.
2. The operator selects an active service, two supported city references, explicit pickup/delivery windows, objective (FASTEST or SHORTEST_RETURNED), and traffic preference. The four timestamps require explicit Z or UTC offsets. Windows are operator planning assumptions, not recovered Customer windows. No arbitrary geographic coordinates, manual UUID or browser Routes credential is accepted.
3. An explicit **Check coverage & calculate** action calls the existing authenticated `POST /api/v2/carrier-portal/carriers/{carrierId}/road-assessments` endpoint. The existing service verifies persisted pickup/delivery coverage, exclusions, directed lane, validity and evidence before calling Google. Unsupported or unknown coverage remains blocked from provider access. Coverage/version consistency is rechecked by the existing backend after provider calculation.
4. The client validates Carrier/service/city identities, service revision, equivalent window instants, objective, traffic and departure-time basis. Incompatible responses are discarded. Edits, close, service/Carrier changes, refreshed tower context and superseded requests abort/discard obsolete results. Closing or aborting the client request cannot guarantee cancellation of a provider request already started.
5. Returned alternatives display distance, **driving estimate**, source/warnings and comparison scope. The backend recommendation remains labelled separately from the alternative the operator chooses to inspect. This is an optimum only within the returned alternatives; no global road-graph optimum is claimed.
6. Selecting an alternative switches to the map. The Google Maps renderer plots the provider's ordered points directly, with selected/other line styles, `geodesic:false`, fit-to-route and cleanup on replacement/unmount. No smoothing, manually added connectors, straight-line fallback or simulated truck motion is introduced. Changing the inspected alternative does not recalculate or create a paid request.

The planning line is visibly independent of the selected operation and any last recorded position. It is not saved to a booking/execution, does not reserve resources or imply a truck has travelled the route. Operator/customer windows, driving duration and total occupation remain different facts. Truck access, cargo/resource feasibility, legal/border permission and transit countries are not confirmed by this coverage/road-only endpoint. Border review flags and unresolved reasons remain visible.

## Additive reference endpoint

GET `/api/v2/carrier-portal/carriers/{carrierId}/road-assessments/options`

Reuses the existing Carrier authentication boundary and returns a strict `CarrierRoadOptionsV2` envelope: selected Carrier ID, feature-enabled flag, representative city IDs/names/countries and `REPRESENTATIVE_CITY_REFERENCES_ONLY` scope. It reads the same server reference collection used to resolve calculations, including the previously server-only San Diego reference. The 43 currently supported references are not a catalog of commercial facilities, service coverage or live positions. The endpoint returns no credential or private provider configuration.

No business domain schema, SQL migration, RLS rule, hosted data, key/restriction, feature flag, production setting or route URL was changed. The existing billing budget and server-only `GOOGLE_ROUTES_API_KEY` remain authoritative.

## Actual provider verification

The front was stopped when verification began. Restarted the existing `scripts/dev-local.mjs` from this checkout on 8080 in the background with IPv4-first resolution. No parallel app or production build was started.

`NATIVE_RESULTS.json` contains authenticated reads and one successful explicit coverage-first assessment through the real Next/Hono/Supabase/Google path, using the existing private local test account. The temporary HTTP session was revoked with local session scope, preserving unrelated browser sessions.

- Feature enabled; 43 supported city references; 1 authorized ROAD service; complete service catalog.
- Persisted coverage: 2 areas and 1 directed lane. Chosen pair: **Lima → Arequipa**, matched to the published lane's city references.
- Future operator planning windows, baseline without traffic, FASTEST objective.
- Coverage: **eligible**; no coverage reasons or not-calculated reason.
- Google response: **1 alternative**, **1,013,025 metres**, **60,629 seconds** (~16.84 hours driving), **27,124 points**.
- Geometry SHA-256: `9c2b66339b5c5896668ae0481dcb5b727737112184e5a0357c50e0e1b588080e`.
- Anonymous options request rejected with 401. The page returned HTTP 200.
- **0 business writes**, no orders/offers/holds/assignments changed. Provider geometry itself is not stored in the evidence file; only summary/count/hash.

The single native alternative does not demonstrate a multi-alternative result for that pair. Controlled tests cover multiple alternatives, objective comparison and selection consistency. The current Carrier catalog remains synthetic persisted test data; a successful Google route does not turn that fleet or coverage into a live commercial integration.

## Verification

- **72 tests passed**: planner/client/reference endpoint plus existing Control Tower, coverage/provider and road geometry suites. Cases include strict dates/windows; service and Carrier scope; partial/denied reads; response/time-basis mismatch; cancellation; stale coverage; inverse/excluded/expired coverage with zero provider calls; geometry rejection; no fallback; quota and objective comparison.
- **7 controlled SSR checks passed** for the actual planner: canonical form, incomplete catalog, disabled environment, denied read, unknown coverage, provider alternatives/source/warnings and provider denial. React state is supplied explicitly and CSS is stubbed. SSR does not run effects, submit/click interactions or Google canvas.
- TypeScript and architecture checks passed (545 modules / 165 client entries at verification).
- Browser inventory returned **“Local browser use is disabled in Work settings.”** No browser workaround was used. Current visual/responsive/keyboard checks, actual form submission by browser and Google polyline appearance remain unverified. Earlier Control Tower browser evidence belongs to the previous read-only increment, not this route-planning increment.

The live HTTP harness initially omitted Origin on its POST and was rejected by the existing same-origin guard. The harness was corrected to send Origin as the browser does; application authentication/CSRF protection was unchanged.

## Files

Modified:

- `cargomesh/src/features/carrier-control-tower/control-tower.tsx` — scoped planner mounting and route display state.
- `cargomesh/src/features/carrier-control-tower/google-operation-map.tsx` — provider polyline layer, fitting and legend.
- `cargomesh/src/server/hono/routes/carrier-road-routing.ts` — authenticated reference GET.
- `cargomesh/src/server/modules/carrier-road-routing/infrastructure/reference-locations.ts` — exposes the existing reference collection as safe IDs/names/countries.

Added:

- `cargomesh/src/features/carrier-control-tower/road-planner.tsx`
- `cargomesh/src/features/carrier-control-tower/road-plan-model.ts`
- `cargomesh/src/features/carrier-control-tower/road-plan-client.ts`
- `cargomesh/src/features/carrier-control-tower/road-plan.test.ts`
- `cargomesh/src/shared/schemas/v2/road-options.ts`

The existing `carrier-road-routing.ts` input/assessment schemas, coverage policy, Google provider, coordinator, routes, shared styles, Requests, Offers, Orders, Pipeline, Sites and Fleet source were not modified by this increment. Exact initial backups, staged source, native/SSR scripts and result files are in this evidence directory.

## Next work

1. Browser verification of form, selected route and map resize/return navigation when enabled.
2. Bind a chosen route to an authorized booking/execution only after the authoritative Customer-window/offer/plan projection and persistence/revalidation contract are available. This UI intentionally does not manufacture that association.
3. Use the existing operational assessment endpoint to include explicit asset/driver/handling assumptions and distinguish driving time from complete occupied time. Do not infer availability from this road result.
4. Position observations, GPS adapter and separately labelled playback remain independent work; no truck is placed or animated on this planning line automatically.

No commit, push, merge, deployment or hosted migration was performed.
