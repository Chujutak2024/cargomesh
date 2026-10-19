# Carrier coverage and road routing — five-part plan

Date: 2026-10-17. Issues HAC-50 / HAC-48; existing registered branch `codex/unified-workspaces-demo-boundary`. Main, deployment, hosted data and the front are outside this increment.

1. **Coverage before routing (implement now).** Read the authenticated Carrier's persisted service, PICKUP/DELIVERY inclusions/exclusions, directed lanes and partner agreements. Check activity-window validity and evidence, return eligible/ineligible/unknown with record IDs and versions. Do not infer coverage from depots, registration country or truck type. Start with server-owned city references; unsupported address/postal/polygon resolution remains unknown. Bounded incomplete reads cannot authorize a paid call.
2. **Provider road calculation and comparison (implement now).** Only a positive coverage-only result permits Google Routes. Reuse the existing validated HIGH_QUALITY adapter. Preserve its ordered points, compare FASTEST / SHORTEST_RETURNED, tie-break deterministically, and pass the pickup-start departure time for traffic-aware requests; the traffic-unaware baseline sends no timestamp. Re-read the catalog after calculation; discard stale geometry. Keep budget, private credentials and no-store responses. Verify native persisted catalogs, negative cases with zero provider calls and an actual provider calculation.
3. **Operational feasibility (next delivery).** Compose vehicle/driver windows, maintenance, repositioning, depot activity and cargo/equipment constraints. A provider drive estimate alone is not the whole duty schedule or confirmed capacity.
4. **Requirements and uncertainty (next delivery).** Compose the existing border dossier with required evidence, restrictions and freshness. Border review and travel authorization remain distinct. Unknown truck access, custody or customs is never silently approved.
5. **Authorized consumer projection (coordinated delivery).** Publish a minimized Client discovery contract and a front handoff. Carrier-private endpoints remain Carrier-private. Return provenance, reasons, versions and revalidation requirements. Connect visualization last; do not infer live GPS from simulated progress.

## Verification scope

Meaningful policy tests cover exclusions, missing/expired/future evidence, partial windows, inverse lanes, unsupported geometry, registered partners without platform carrier IDs, inactive services, scope mismatches, incomplete pages, stale readback and provider failure. HTTP transport tests cover authentication, cross-origin cookies, bounded strict bodies and private cache headers. Existing routing regression, typecheck and architecture must pass. No schema changes are planned.

## Routing/vector research

Research uses official documentation for Google Routes/Roads, Waze, Mapbox, OSRM, GraphHopper, Valhalla and QGIS. Distinguish road search, vector geometry, GPS map matching and visualization. Do not install another provider or run raster tracing over a map screenshot. Keep Google geometry on the supported Google display path and review licensing before changing providers/renderers.

## Operational increment delivered — 2026-10-17

Part 3 now has a private, bounded single-asset/driver composition over the existing fleet catalogs and road alternatives. See [implementation, native checks and explicit remaining requirements](./HAC50_ROAD_OPERATION_ASSESSMENT_2026-10-17.md) and [front handoff](./HAC50_OPERATIONAL_FLEET_VISUAL_HANDOFF_2026-10-17.md). This does not complete physical readiness, jurisdictional policy, automatic depot binding, border composition or Client discovery. No migration, hosted write, main change or front modification was introduced.
