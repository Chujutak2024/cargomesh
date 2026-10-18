# HAC-43 — eighteen vehicles in the local fleet

## User correction and actual result

The user expected additional vehicle cards at `http://127.0.0.1:8080/v2-workspace#/fleet`. The separate catalog of 18 visual assemblies had not increased the 12 records displayed there.

Six explicit demo records were added **through the existing New truck form in the user's actual in-app-browser tab**, without replacing its runtime, changing authentication or modifying browser storage outside the application. The form uses its existing local registration/validation/commit flow. The original twelve cards and assignments remain; the visible total is now **18**, including after a reload.

| Code | Model | Existing equipment family |
| --- | --- | --- |
| CM-401 | CargoMesh City Box | rigid |
| CM-402 | CargoMesh Aero Linehaul | articulated |
| CM-403 | CargoMesh Cold Guard | refrigerated |
| CM-404 | CargoMesh Platform Rack | flatbed |
| CM-405 | CargoMesh Aero Curtainsider | curtainsider |
| CM-406 | CargoMesh Timber Reinforced | logging |

These are local presentation records, not real assets or backend reservations. Each is described as a local demo and has no assigned driver or shipment. No Supabase data, credentials, authentication, API or deployment changed. Browser origin is the exact `127.0.0.1:8080` supplied by the user, not the separate test browser or another port.

## Reproducible source change

- `fleet-local-additions.ts` supplies six fixture records to `exampleFleet()` for fresh local demos, with no invented journeys, GPS, driver identities or maintenance history.
- `useOperations` merges new defaults with saved registrations by ID, code and normalized plate. Saved records take precedence and retain their identity/data. This prevents duplicate CM-401..406 entries when the newer code reads registrations already created in the older local runtime.
- `serviceFleet` and connected readers are unchanged; an empty connected fleet remains empty. No local fixture is a service fallback.
- Existing tests now reflect eighteen local units, twelve known regular drivers and six unassigned units. Migration tests verify six-/twelve-unit saves, preservation of assignment dates, saved registration precedence, plate conflicts and repeatability. Missing maintenance history stays unknown.

## Evidence and boundaries

- Actual user-tab UI: 18 total; search `CM-40` returns 6 of 18 and displays all six codes. Reload preserves them. User tab left open on that filtered view so the additions are immediately visible.
- Screenshot: local `.planning/2026-10-17-depot-fleet-threejs/flota-18-en-8080.png` (not a shared download URL).
- Targeted fleet/demo/operations/inspection tests: 38 PASS. Full logistics: **136/136 PASS**; TypeScript PASS; architecture PASS (410 modules /112 client entries). No new production build or runtime replacement was required for these existing-form registrations; the prior 3D build evidence belongs to the preceding increment.
- The 8080 JavaScript/build is still the stable `9d5f681` runtime; its **local data** is now expanded. The source expansion, newer 3D assemblies and template changes remain in the uncommitted feature branch. Do not claim the newer 3D code or connected backend has been deployed to8080.
- Delivery branch/base/PR target remain `codex/v2-full-carrier-operations` / `0e6986c` / `codex/unified-workspaces-demo-boundary`, never main. No push, PR or merge executed. HAC-43's integral connected-operation DoD remains open.
