# HAC-43 — truck catalog and configurable depots

## Delivery boundary

Continuation of Juan's adopted Three.js handoff and the five-vehicle increment. Branch `codex/v2-full-carrier-operations`, base `0e6986c` from `origin/codex/unified-workspaces-demo-boundary`; PR target remains `codex/unified-workspaces-demo-boundary`, **never main**. Working tree only; no push, PR, deployment, credentials, dependencies, schema or business data changes.

## Implemented

- **18 truck assemblies / 10 existing families.** `visual-catalog.ts` defines original liveries and geometric fittings: raised roof, roof deflector, side guards/skirts, folded tail lift, headboard, front guard and beacons. `truck-model.ts` batches them with existing materials and preserves its original default exports. Color does not create an equipment class or capacity.
- **Five physical depot templates:** compact base, distribution centre, cold storage, yard/workshop and transfer terminal. Warehouse depth, roof, facade, dock count and equipment change; no appearance establishes facility capabilities or permissions. Original yard coordinates and Bay 02 loading path remain separate from geography.
- **Usable catalog:** search, family filter, empty state and one selected 3D viewer. No canvas per catalog entry. Original-family posters remain fallback illustrations, explicitly distinguished from the selected assembly.
- **State retained above views:** depot template, same-family truck design, selection, interior, pause, clock and events survive Yard/Designs/Scenic trip changes within the studio. Existing inspection retains its own coordinator within that dialog.
- **Scenic continuity:** the selected yard asset retains `assetId`, `siteId`, `tripId` and design. An original closed circuit reuses the existing scenic road/environment assets and machine-time lighting, without any provider geography. The visual cursor is independent of depot/business events and survives view remounts. No assigned trip, maintenance or unknown location produces no moving preview. Outgoing pallets remain aboard.
- **Integration:** FleetWorkspace and TruckInspection link to `/vehicle-designs` in a new tab, preserving the original record/form view. Public studio contains only original presentation assets and explicit synthetic scene identities, with no carrier API calls. `/depot-preview` remains development-only QA.

## Preview and actual local runtime

- Current work: `http://127.0.0.1:8091/vehicle-designs`.
- Development-only inspection QA: `http://127.0.0.1:8091/depot-preview`.
- `8080`/`8083` still run the earlier stable `9d5f681` artifact. These processes do **not** contain the new catalog or integration links. They were not silently replaced by an authenticated V2 build.
- This environment lacks `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; connected `/v2-workspace` cannot be certified here. Existing `.env.local` has Maps/Routes configuration only. No auth bypass or fabricated connected catalog was added.

## Verification

- Logistics suite: **134/134 PASS**, including four new catalog/template/state/circuit tests and the six existing coordinator tests. All 18 assemblies have distinct finite geometry; all remain under 50,000 triangles and 12 material batches per truck in the CPU inventory. Five depot layouts have distinct physical geometry and disposable ownership.
- TypeScript and architecture checks pass (409 modules / 112 client entry points). Next production build passes; see local command logs and final build evidence.
- Browser: 1440×1100 and 390×844, no horizontal overflow; ten representative family variants render, search/filter/empty state works; one visible canvas. All five depot templates selectable.
- Yard → trip → yard retains clock **631 ms**, template, interior and truck assembly; selected scene identity remains stable across views. Scenic trip → yard → trip retains visual distance **1.05 units** and asset/site/trip/design IDs. Maintenance selection shows no trip and **zero canvases**.
- Reduced motion starts the scenes paused; explicit play/pause works. Previous five-vehicle error/retry and controller tests remain part of this increment's baseline.
- Fixed a GPU resource leak on template changes: old primitives were disposed while still rendered and uploaded again. World creation is now memoized; passive cleanup runs after the previous primitives are removed. Two complete template cycles show **191–193 geometries / 9 textures**, with each repeated template returning to its prior counts. Sample is paused, interior mode, selected truck A; counts vary with visible parts.
- Scenic sample: 72 calls / 583,672 triangles including shadow passes / 46 geometries / 5 textures, RTX 2060, ANGLE D3D11, Chrome155, DPR1. No FPS or VRAM byte claim.
- Initial HTML/CSS/JS assets remain HTTP200 in both the stable8080 panel and new8091 studio after building. No browser storage was cleared.

Local evidence is in `.planning/2026-10-17-depot-fleet-threejs/`: catalog test/build logs, runtime asset probe, mobile/desktop captures and SHA-256 manifest. These local paths are not shared evidence links.

## Remaining connected responsibility

The handoff's 10 carriers / 16 depots / 80 vehicles / 80 drivers remain a proposed backend scenario owned by Cristhian. This delivery creates reusable visual assemblies, not those business records. The visual DTO/mapping proposal is in the local first-cut inventory; authoritative presence, visitors, execution IDs and geographic route props still need the agreed connected projection. Existing legacy Google route rendering is unchanged and is not used by the new scenic circuit. This increment does not close HAC-43's complete connected-operation DoD.
