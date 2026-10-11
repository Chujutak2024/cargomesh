# FE-1 tracking redesign — evidence and limits

Branch: `codex/v2-full-shipper-flow`. This change refines the shipper-facing `/tracking` and `/tracking/[id]` views; it does not alter FE-2 routes, V2 persistence, hosted Supabase, or production configuration.

## What is implemented

- A new overview and detail composition uses the shared CargoMesh blue/cyan tokens, accessible navigation, cards, status surfaces, loading/error states and responsive layout. The mobile view has no horizontal document overflow at 390 px.
- A single pure journey projection consumes the authorized execution, its confirmed booking, its own execution events, and its incidents. The discrete truck marker follows the last **reported milestone**, never a synthetic GPS position. Preparation, pickup, checkpoints, arrival and reception remain explicitly unverified because the current V2 workflow read contract has no independent event for them.
- Booking, departure, position report/transit and delivery use persisted evidence. A critical open incident highlights the transit stage for review; it does not assert a delay or route diversion. Incidents show reported time, location where present, severity, status, description, impact caveat and a support action.
- The map and conceptual 3D view use the same route. The route is resolved through **execution → confirmed booking → decision → selected plan → route**, with matching request scope at every link. Incomplete/out-of-range coordinates or unknown provenance yield no line. The 3D option is offered only for complete ROAD geometry. It loads on demand, supports follow/side/overhead camera modes, honors reduced motion, keeps the illustrative truck static, hides the operational percentage and falls back to the map/timeline if WebGL initialization fails. Existing FE-2 callers retain default behavior because these props are opt-in.
- Tracking errors hide stale data and offer retry; loading uses an accessible status and reduced-motion-friendly skeleton.

## Browser evidence (authenticated local synthetic tenant A, 2026-10-11)

- [Desktop tracking](./delivery/evidence/fe1-tracking/tracking-desktop.jpg) — 1280 px, new overview and actual empty state.
- [Mobile tracking](./delivery/evidence/fe1-tracking/tracking-mobile.jpg) — 390 × 844 px, new overview and actual empty state; `innerWidth=390`, `document.documentElement.scrollWidth=390`.
- [FE-2 control](./delivery/evidence/fe1-tracking/carrier-regression-desktop.jpg) — carrier portal still renders its overview and truck scene. No FE-2 page or style file was edited.

The authenticated tenant currently has **zero executions**. Consequently, the browser evidence cannot claim a live in-transit, delivered, incident or 3D-detail scenario. The detail route and projection were verified by TypeScript, production build, contract-shaped unit tests and code review, not by an authenticated populated browser run. A real visual/E2E acceptance pass requires a permitted V2 dataset with a confirmed booking, linked plan/route, execution events and incident records. No synthetic GPS, booking or event was inserted merely for screenshots.

## Verification

- `pnpm test:shipper-portal`: 22/22 passed, including initial, position/transit, completion, rejected booking, cancellation, critical incident, unknown intermediate milestones, missing route and invalid coordinates.
- `pnpm test:release`: 340/340 passed; tracking tests are included in the release script.
- `pnpm typecheck`: passed.
- `pnpm check:architecture`: passed (292 modules, 73 client entry points).
- `pnpm build`: passed (Next.js 15.5.24, dynamic `/tracking` and `/tracking/[id]`).
- FE-2 visual smoke: carrier overview and its existing 3D truck rendered. The shared 3D API defaults are unchanged.

## Contract follow-ups

1. The event DTO offers only `executions.start`, `executions.position`, `executions.complete` and `executions.cancel`. It does not prove preparation, pickup, checkpoint arrival, reception or proof of delivery. Those are not shown as completed milestones.
2. The last known position is stored on the execution, while read events do not carry the historical position coordinates. The UI can show the latest label and position-report time separately, but cannot reconstruct a GPS trail or pinpoint prior event locations.
3. Workspace lists are capped at 100 records per workflow kind and 50 requests. Larger-tenant pagination needs a backend/workspace contract change.
4. Real backend-failure browser injection and a populated 3D-detail visual pass were not possible against this empty local tenant; the route error boundary and viewer failure fallback are implemented but still need a live failure/recovery smoke.

The separation between a route visualization and actual shipment position follows the distinction in [FedEx's own explanation of tracking statuses](https://images.fedex.com/en-gb/customer-support/faq/receiving/tracking-questions/fedex-tracking-status-meaning.html): an "on the way" status need not imply a vehicle currently moving, and exceptional events require their own explanation. CargoMesh implements this principle against its own V2 contract rather than copying FedEx UI or statuses.
