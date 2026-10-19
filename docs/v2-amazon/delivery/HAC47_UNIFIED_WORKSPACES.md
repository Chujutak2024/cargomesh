# HAC-47 — Unified workspace entry and demo boundary

Scope authorized by Cristhian on 13 October 2026: gather the frontend, use relative routes and separate demo from connected behavior. Visual reconciliation and end-to-end backend completion are deferred. This branch does not merge or deploy production.

## Sources and branch

- Branch: `codex/unified-workspaces-demo-boundary`, based on `origin/main` at `9d5f681c8ccc9950c833fd4a62524a182c6e7613`.
- Original Luis frontend: `origin/codex/v2-full-shipper-flow` at `7b8038abaa1a05f4489b361f4a41fe5e1ecfd598` (PR122). Its connected services and pages are retained.
- Existing Carrier workspace, local sign-in/Ups/motion and entry-latency corrections from the verified local checkout. No credentials or private launchers are included.
- Landing planet loop and Control Tower preview from the local review copy. No HyperFrames runtime is added to the web app.
- Linear: https://linear.app/hackatonteamcargomesh/issue/HAC-47

## Routes — one application and origin

| Purpose | Path |
|---|---|
| Public landing | `/` |
| Carrier workspace | `/v2-workspace#/fleet` |
| Retired basic Carrier entry | `/carrier-portal` redirects to the workspace |
| Connected Shipper | `/dashboard` and existing Shipper routes |
| Explicit Shipper demo | `/demo/shipper/dashboard` and its sibling routes |
| Connected API | `/api/v2/*` — original Hono adapter and authorization |
| Read-only demo API | `/api/demo/v2/*` — fixtures only, never forwards to Supabase |
| Control Tower experiment | `/carrier-control-tower` — simulated, demo flag required |

## Modes

The default is connected: do not set `CM_ENABLE_DEMO`. Shipper pages require real organization membership; Carrier uses its existing server access guard. Selecting a landing card does not grant a role.

Set `CM_ENABLE_DEMO=1` explicitly in local environment and restart to expose the public read-only demo. The Shipper landing entry then opens `/demo/shipper/dashboard`; connected Shipper routes remain available and protected. Demo pages use separate fixture loaders and a visible banner. They do not replace the connected workspace service. Demo writes return `409 VISUAL_DEMO_READ_ONLY`; unavailable fixture reads return 404. Turning the flag off hides both demo pages and endpoints.

The browser API wrapper sends calls originating from the Shipper demo path to its separate transport. Real API authorization is not delegated to this browser distinction. The demo identity is only presentation data and is never a server API principal.

## Running

From `cargomesh/`, use the installed project dependencies and your private environment. For a local demo set `CM_ENABLE_DEMO=1`, then `pnpm dev --hostname 127.0.0.1 --port 8080`. Do not commit `.env.local`. Google Maps referrer authorization and the separate server Routes key remain operator configuration.

Use `pnpm typecheck`, `pnpm check:architecture`, `pnpm test:workspace-modes` and the relevant Shipper/logistics suites. This work does not claim the entire release gate or connected commercial journey is complete.

## Deliberately preserved differences

Carrier uses its existing `logistics-3d` scenes. Shipper's differing route viewer is preserved under `shipper-route-3d` with shared models, instead of silently overwriting either implementation. Global style reconciliation, residual Spanish scene copy, shared UI harmonization and connected map-to-operation mapping remain follow-up work.

Control Tower uses simulated points and illustrative Peru routes; globe, international scenarios and road-calculated geometry remain pending. Existing Carrier demo assignments and registered examples remain browser-local; they are not migrated into Supabase.

## DoD and integration limits

This increment supplies a single source tree, relative navigation and independent demo/connected surfaces. No schema migration, hosted data write, new permissions, main push/merge or deployment configuration change is included. Evidence and exact verification results will be appended before publication. Remaining project-wide gates belong to the subsequent tasks requested by the user.

## Verification evidence — local

- Typecheck: PASS. Architecture: PASS (354 modules, 91 client entry points at the first unified check).
- Mode/auth tests: initially 25 passed; browser transport boundary tests added before final verification.
- Original Shipper suite: 35 passed. Logistics suite: 124 passed, including logging timber loading, route continuity and geometry disposal.
- HTTP: 15 checks passed on one application origin: landing, both entries, separate demo dashboard/requests/organization/tracking, demo reads and rejected writes, connected API 401, retired entry redirect and Carrier access-required screen.
- Connected dashboard returns a Next streaming redirect to login (HTTP 200 plus NEXT_REDIRECT/refresh), with no demo records or demo banner. The initial HTTP assertion expected a traditional 307; it was corrected to verify the actual redirect semantics.
- Real Hono adapter matches origin/main byte-for-byte. Original connected workspace service is from Luis's source, not the preview replacement.
- Verification server used a separate local port; application links contain no 8080/3090 cross-origin dependency. No private environment values are included.
- Visual reconciliation, production build, complete authenticated commercial flow and final human gate remain deferred as requested. No deployment was executed.

### Friction log

A test initially imported Next page guards through the demo fixture module under react-server conditions. Pure fixtures were separated from the page guard, then the mode tests passed. No auth behavior was weakened. Browser validation of this final combined tree was not claimed; HTTP routing and code tests provide the evidence for this limited increment.

Final mode/auth transport suite: 28 passed, including string/URL/Request demo writes making zero backend calls.
