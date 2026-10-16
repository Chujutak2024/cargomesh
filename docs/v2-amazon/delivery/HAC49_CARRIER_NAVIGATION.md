# HAC-49 — Carrier navigation and scrolling follow-up

Date: 2026-10-14. Existing branch: codex/unified-workspaces-demo-boundary.
Local implementation, pending independent review/publication. Main and deployment unchanged.

## Structure

The authenticated /v2-workspace document owns its persistent CarrierNavigation shell. Fleet, request coordination, Control tower and road routing lab change views through fragments in that document. No full-page navigation is required between these sections. This is a bounded consolidation of the existing fragment router, not a migration to a new Next router/layout.

| Destination | Canonical URL |
| --- | --- |
| Fleet | /v2-workspace#/fleet |
| Route planning | /v2-workspace#/tracking |
| Control tower preview | /v2-workspace#/tower |
| Calculated road routes preview | /v2-workspace#/route-lab |

The old /carrier-control-tower and /carrier-route-lab entries return 307 to the matching canonical URL after their existing demo guard. The destination retains the existing authenticated workspace guard. Previews require CM_ENABLE_DEMO; disabled previews are omitted from navigation and not mounted by fragment parsing. Existing nested fleet/service/vehicle, sites, register and desk/review links are preserved.

Preview components mount inside the shared shell without creating another sidebar. Their CSS modules are imported with the workspace so internal navigation consistently renders styled content. Google Maps initialization remains tied to mounting the map; it is not started on the Fleet screen. Coordinator request reads are suspended for previews.

## Scrolling

Before changes, desktop document scrolling worked in the observed session; the exact user-reported stuck state could not be reproduced. A concrete lifecycle risk was found: the drawer and two truck dialogs saved and restored body overflow independently. Overlapping owners closing out of order could restore hidden permanently.

The workspace now has a viewport-sized content scroll area with its own stable gutter, independent from the sidebar scroll area. The shared reference-counted browser lock coordinates the drawer, truck dialogs and shared Dialog. Cleanup is idempotent, restores prior state and prevents a hidden background from scrolling while an overlay is open. Navigating sections returns the content pane to the top; heading focus remains available for assistive technology. Interactive controls keep their focus rings.

## Verification

- 17/17 targeted tests: internal destinations, demo gating, nested fleet links, overlapping locks in either closing order, idempotent cleanup, previous-owner restoration and existing login/return-path permission regression.
- TypeScript passed. Architecture passed: 368 modules, 95 client entries (observed count).
- Real browser at 1366x768: one sidebar; collapsed sidebar remains collapsed across Fleet → Control tower → lab; lab returns to Control tower; styles remain grid-based after Fleet round trip.
- Desktop scrollbar dragged to the bottom: content scrollTop 652/max 652. Wheel scrolling Fleet advances content while document stays at 0.
- Real browser at 390x844: drawer locks background; selecting Fleet closes drawer and removes lock; wheel scrolling advances to 844; Fleet and Route planning have no horizontal overflow; Route planning heading matches navigation.
- Shared exception dialog locks background and removes lock on close; content can scroll immediately afterward.
- HTTP legacy redirects: both 307 to canonical fragments. Cookie-free /v2-workspace shows Oops access guard.

## Limits

Control tower remains an explicit simulated, read-only scenario. This change does not create calculated road geometry, GPS, carrier capacity or verified truck permissions. Road routing lab still needs the separate server Routes credential for live city-to-city calculations. Existing per-screen state lifetime is preserved; the persistent sidebar does not imply keeping every 3D scene or screen mounted in the background.

## Local tooling friction

pnpm attempted automatic dependency reconciliation through a node_modules junction pointing to another checkout and refused unsafe removal. No reinstall/removal was performed. Checks were run directly using installed Node/TypeScript/tsx and the repository architecture script. See evidence notes under salida/carrier-navigation-20261014 in the primary workspace. Do not rerun the one-shot apply scripts.

## Publication verification — 2026-10-14

User authorized pull and push on the existing branch. Pull from origin/codex/unified-workspaces-demo-boundary was already up to date. Publication selects functional login/navigation/road-lab work and necessary shared UI dependencies. Independent landing, app-shell and Fleet/request styling edits remain unstaged in the working checkout.

An exact source export of the Git index passed 65 targeted tests, architecture (368 modules/95 client entries) and a clean TypeScript check with incremental disabled. No private environment file is selected; .env.local remains ignored. Credential pattern scan found no embedded Google key, JWT or private key. The first snapshot typecheck had restricted access to transitive dependencies behind the existing junction; it passed with full read access, with no dependency reinstall or changes. This publication does not certify live Routes API calls, complete backend integration or deployment.
