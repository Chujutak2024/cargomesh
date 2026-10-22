# Operation-bound maps and quote facts

Google authentication/referrer errors, timeouts and missing configuration show an inline SVG schematic in the existing map panel. It has no tiles or alternative provider. The label explicitly disclaims a road map and GPS. Each declared leg retains its provenance; endpoints without legs have a separately labeled dashed connection. Retry rechecks Google, including an explicit script reload after an authentication failure. This does not fix the published domain's `RefererNotAllowedMapError`.

Tracking keeps the exact execution → confirmed booking → decision → selected plan → route chain. Tenant, request, Carrier and offer/service scope violations still reject the read. Request/route endpoint differences discard the route, markers and route facts and add a partial `route` issue. A failed, malformed or foreign corridor read omits only that corridor's driving facts and adds an unavailable `corridors` issue. Geometry and other public facts remain available. Both map failures preserve operational events and milestones. `OperationsReadNotice` accepts both resources through its existing open resource type and translates their names. No tenant-wide or sibling-route fallback exists. Google bounds and SVG projection use the same operation-only points, including interior waypoints. Separate declared legs are never bridged.

The Tracking presentation contains three independent facts: the route record and declared geometry, booked offer/plan/service and corridor facts, and the offer's delivery estimate at quote time. All carry IDs/revisions and evidence validity. The public projection whitelists fields; it does not include a private calculation, wages, costs, prices or margin. Corridor driving time is shown only when the current public record matches the route's booked corridor revision; a newer revision cannot silently replace it.

Fact labels use Tracking's `t(es, en)` translator. The local map helper formats every displayed instant with explicit Lima/PET and UTC, including the UTC date on day rollover; it does not modify the shared date formatter. Retry removes any previous Maps JavaScript script before inserting its replacement, including after authentication failure.

## Contract gaps — owner: Cristhian

- Client booked DTOs do not expose paid driver seconds or a booked service revision. The execution window is displayed as an operation window, never as proof of paid time. Proposed contract: an immutable Client-readable booked operating summary with `serviceId`, `serviceVersion`, `corridorId`, `corridorVersion`, `drivingSeconds`, `commercialTransitSeconds`, `paidWindowSeconds` and evidence (`reference`, `provider`, `observedAt`, `validUntil`, `provenanceStatus`). It must exclude all private cost fields. No DDL or private snapshot read was added.
- Public corridor reads expose only the current revision. Historic driving time becomes unavailable on revision drift. The same booked summary, or a public version-addressed corridor DTO under existing RLS, should preserve the historic source.
- Route geometry is a declared published-corridor snapshot, not Google road routing or GPS. C-01 is synthetic. The targeted Client session read on 2026-10-22 confirmed route `4770fd35-08a2-44c1-a020-65d4dbd1cd7e` v1, one `SIMULATED` leg, origin `(-12, -77)` and destination `(-12.5, -77)`. It is not Lima–Arequipa.
- The Google key administrator, coordinated by Cristhian, must authorize the production and preview referrers. No key value was inspected; no Google Cloud, Vercel or environment setting was changed.

## Verification

From `cargomesh/`:

```sh
pnpm test:v2-road-map
pnpm typecheck
pnpm test:release
pnpm test:road-routing
pnpm test:hac54:h4
pnpm test:shipper-portal
pnpm check:architecture
```

`operation-map.test.ts` uses the repository's native `node --conditions=react-server --import tsx --test` runner and is explicitly included in `test:v2-road-map`, `test:road-routing` and `test:release`. It exercises the actual hook-free React element trees (only CSS imports are stubbed), safe failure labels, bilingual quote facts, explicit date zones, native mock-timer timeout/auth callbacks and script replacement on Retry. Negative scope and degraded-map cases have successful controls and verify that events/milestones survive. No external Vitest installation, new dependency or lockfile change is required. No DB is used by these map tests. The repository has no lint script or linter configuration; `npm run lint` is blocked with `Missing script: "lint"`.

Local visual evidence uses `/hac15-preview`, whose existing development-only fixtures now have C-01-shaped endpoints and declared synthetic points. This preview is explicitly not a persisted request. Check the Eligible and empty-legs options and Retry. With the key absent, the observed category is `Not configured`; auth/referrer and timeout paths are verified by unit tests. Initial screenshots and command logs are outside the repository at `salida/plan3/maps-20261022T0500Z/`; review-adjustment verification is at `salida/plan3/maps-adjustments-20261022T0910Z/`. The original C-01 reference read was GET-only through the published Client workspace session. The review adjustments make no hosted requests or writes.
