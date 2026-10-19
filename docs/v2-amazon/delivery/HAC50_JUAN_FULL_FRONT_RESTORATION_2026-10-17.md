# HAC-50 — Complete Juan Carrier frontend restoration

Date: 2026-10-17. Active branch: `codex/unified-workspaces-demo-boundary`.

## User decision

Copy the complete preserved Juan Carrier frontend, instead of continuing a screen-by-screen reconstruction. Keep the existing public routes, current dropdown/sidebar behavior and independent Pipeline. Correct and reconnect screens in later increments. Landing and Client are outside this Carrier restoration.

## Source and implementation

The source is the running preserved comparison checkout `v2-domain-review/cargomesh`, reference `9d5f681c8ccc9950c833fd4a62524a182c6e7613` plus its pre-existing local changes. It is the version shown on port 8082, not a claim that this is a clean historical commit.

All 66 original non-test Carrier frontend files were copied under `cargomesh/src/features/carrier-juan/` so the current backend-facing components, contracts and adapters remain intact. 58 copied files are byte-identical to the source. Eight have compatibility changes: the coordinator, route-reading/navigation consumers and same-origin draft restore. The original styling, truck and driver detail, depot/coverage, assignment, request directory, dashboard, wizard, review and Route views are reused directly. Five original model test files were also retained.

The existing Carrier entry mounts this preserved frontend. Pipeline continues to mount the existing connected commercial component. The preserved Route screen appears at the existing `/carriers/orders` destination; the original request-review wizard appears at `/carriers/offers`. These are the historical screens, not a claim of connected commercial Orders or Offers. Internal wizard steps and fleet subviews use the existing canonical route families. No redirect table or routing definition was changed. Original hash links are normalized within the same Carrier document.

`juan-navigation.ts` and `juan-route-model.ts` provide that compatibility. The retired cross-origin 8083 draft-transfer iframe was not revived: the existing same-origin draft storage adapter is retained. The copied coordinator does not query the Client request API while displaying local examples. The request editor and registration modify local state; they do not create hosted customer requests, offers, bookings or vehicles.

## Data and backend boundary

The visible Juan examples are labelled as local illustrative data with no live GPS. They do not use the authenticated Carrier's identity to claim its fleet, depots or availability. Carrier authentication and membership still apply at the existing server layout. Pipeline uses the authorized Carrier, retaining its selector when multiple memberships exist.

The backend, API routes, current connected components, SQL, environment, credentials, Landing, Client and existing 3D scenes were not overwritten. The source's 45 public Carrier assets already exist and are byte-identical, so no asset replacements were necessary. Juan's new models and multi-truck depot delivery remain separate work.

## Verification

- 49 tests passed: original fleet simulation, assignments, incidents, registration, inspection, draft steps/examples, compatibility routes and current navigation.
- Typecheck passed; architecture check passed.
- Authenticated local HTTP check: 10 screens/nested destinations returned 200 with the expected presentation marker. The original legacy redirect remains unchanged.
- Connected APIs remain available separately: authorized snapshot returned 4 opportunities, 4 offers, 4 bookings and 3 executions, plus the authorized depot and service. These are API checks, not the contents of Juan's local examples.
- SHA-256 checks confirm 242 protected backend/navigation/Landing/Client/scene files unchanged. Of the existing `carrier-portal` files, only the entry `coordinator.tsx` changed in this continuation. Pipeline implementation remains unchanged.
- The temporary HTTP test session was revoked with Supabase local scope; no commercial writes occurred.

## Evidence and review limits

Primary-checkout evidence and complete pre-change Carrier backup: `salida/juan-full-front-20261017/`, including `before/`, `source-manifest.json`, `PRESERVATION_RESULTS.json`, `NATIVE_RESULTS.json`, and verification scripts.

Browser automation is disabled in Work settings. HTTP, types and unit checks do not validate browser hydration, clicks, scrolling, responsive layout or current animation playback. Manual visual review remains necessary at `http://127.0.0.1:8080/carriers/fleet`.

No commit, push, merge, hosted migration or deployment was performed. The existing connected UI is preserved for later reconnection; it is not the active presentation except Pipeline.
