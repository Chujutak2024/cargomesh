# FE-1 tracking refinement — 12 October 2026

## Delivery identity and scope

- Branch: `codex/v2-full-shipper-flow`.
- Starting/current committed HEAD: `4c5d2e3` (`visuals refactor`). This delivery is the **uncommitted working-tree delta**, not a new published SHA.
- Scope: `/tracking`, `/tracking/[id]`, their presentation/read helpers, an opt-in embedded presentation of the existing 3D viewer, and a later text cleanup in the request detail.
- No branch creation, commit, push, PR update, merge, deployment, migration, seed or business-data mutation was performed for this refinement.
- Existing server-side authentication, tenant scoping and booking → decision → plan → route validation remain authoritative.

## What changed and why

The previous detail stacked every milestone vertically before the spatial view. The new hierarchy is:

1. Transport reference, origin/destination, operational status and last reported milestone.
2. Three compact metrics: last event, last update and open incidents.
3. A nine-milestone horizontal strip with an accessible, selectable detail panel.
4. A main spatial/activity column alongside incidents and last reported location.
5. A compact reverse-chronological feed: six newest events initially, with expansion for older events.

Mobile keeps a controlled horizontal milestone strip; the document itself does not overflow. Selecting a milestone only scrolls that strip, not the whole page. Arrow keys, Home and End navigate the milestones. Modified keyboard shortcuts are left to the browser.

The list now provides reference/route/location search, active/attention/completed filters, latest/oldest ordering, result counts and useful empty states. It previously passed **empty event and incident arrays** to every card. It now reads child evidence for each execution, so attention counts and recent activity reflect the service. Reads are batched (at most ten concurrent child reads) and failures propagate instead of becoming a false “no incidents” state.

### Truthful milestones

Only evidence-supported states advance. An execution-start event marks departure, not departure **and** transit. Position evidence can support transit. Preparation, pickup, checkpoint, arrival and reception remain unverified when no separate evidence exists; completion does not fabricate those reports. Open and resolved incidents are distinct. A warning does not automatically claim an operational block or invented delay.

### Map and 3D

Both tabs occupy the same spatial panel and display the latest reported milestone/time separately from the scene. The existing `RouteNavigation3D` engine is reused; it was not rebuilt.

- Embedded mode has controlled responsive height, concise overlays, localized camera controls and pause/resume without restarting the scene.
- Follow, side and overhead cameras remain available.
- The illustrative animation is explicitly **not GPS, delivery progress or elapsed shipment time**. It does not assert geographical fidelity to the map's line, even though access to the viewer is gated by the verified route chain.
- No geometry means a visible empty state and disabled 3D, not an approximate invented route.
- WebGL failure has a recovery path to the map/timeline. A provider-map failure is visible and does not remove operational evidence.
- Reduced-motion behavior is retained in the renderer and CSS; see the validation limits below.
- `embedded` defaults to false, preserving the existing FE-2 presentation. No carrier page was edited.

## Exact source inventory

Paths below are repository-relative.

| File | Change / problem addressed |
|---|---|
| `cargomesh/src/app/(cargomesh)/tracking/page.tsx` | Keep protected server reads; load real per-execution child evidence and mount the searchable list. |
| `cargomesh/src/app/(cargomesh)/tracking/[id]/page.tsx` | Retain auth/route-chain checks; delegate layout to the dedicated detail component. |
| `cargomesh/src/features/shipper-portal/tracking-detail.tsx` | New executive summary and responsive spatial/activity/incident composition. |
| `cargomesh/src/features/shipper-portal/request-workspace.tsx` | Removed the serviceability endpoint/version caption and redundant server-authority caption without altering API calls. |
| `cargomesh/src/features/shipper-portal/commercial-panel.tsx` | Removed the ranking-weights paragraph and redundant V2 offers caption without altering offer selection or backend ranking. |
| `cargomesh/src/features/shipper-portal/shipper-portal.module.css` | Removed the unused ranking-note rule. |
| `cargomesh/src/features/shipper-portal/tracking-progress.tsx` | New keyboard-accessible horizontal milestone summary and focused detail. |
| `cargomesh/src/features/shipper-portal/tracking-list.tsx` | New search, filters, sorting, result count and recovery controls. |
| `cargomesh/src/features/shipper-portal/tracking-presentation.ts` | Centralized bilingual names, status derivation, search/filter/sort helpers. |
| `cargomesh/src/features/shipper-portal/tracking-read-model.ts` | Scoped child reads, bounded concurrency and error propagation. |
| `cargomesh/src/features/shipper-portal/tracking-journey.ts` | Correct single current milestone, open-incident count and latest-update evidence. |
| `cargomesh/src/features/shipper-portal/tracking-experience.tsx` | Compact cards, event feed and distinct open/resolved incident presentation. |
| `cargomesh/src/features/shipper-portal/tracking-experience.module.css` | Shared visual tokens, responsive layouts, states, focus and reduced-motion styles. |
| `cargomesh/src/features/shipper-portal/tracking-visual.tsx` | Integrated Map/3D tabs, consistent proportions, context and recoverable failures. |
| `cargomesh/src/features/logistics-3d/route-navigation-3d.tsx` | Opt-in embedded layout/localization, pause/resume and context-loss notification. |
| `cargomesh/src/features/logistics-3d/route-navigation.module.css` | Embedded-only layout and control styles; existing carrier defaults retained. |
| `cargomesh/src/features/shipper-portal/tracking-presentation.test.ts` | 13 new regression cases for state truthfulness, reads, filtering and failures. |
| `cargomesh/src/features/shipper-portal/tracking-qa-fixtures.ts` | Explicit schema-validated synthetic scenarios, imported only by tests/QA preview. |
| `cargomesh/src/app/tracking-preview/page.tsx` | Development-only UI QA route; production returns 404. |
| `cargomesh/src/app/tracking-preview/preview-client.tsx` | Visible synthetic-data banner and scenario selection; no API reads/writes. |
| `cargomesh/package.json` | Include the new regression file in `test:release`. |

This report, its linked friction log and `delivery/evidence/fe1-tracking-refinement/` complete the evidence inventory. No dependency was installed or added.

## Commands and observed results

Executed from `cargomesh/` against this working tree during this continued task. Counts are observations, not permanent acceptance targets. Suites overlap and must not be added together.

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS; 0 TypeScript errors. Repeated after the final source edits. |
| `pnpm check:architecture` | PASS; 305 modules / 77 client entry points. |
| `pnpm test:shipper-portal` | PASS; 35/35, including 13 new regression cases. Repeated after the final source edits. |
| `pnpm test:logistics` | PASS; 124/124, including carrier and shared logistics/3D model regression coverage. |
| `pnpm test:auth` | PASS; 10/10. |
| `pnpm test:release` | PASS; 359/359. |
| `pnpm build` | PASS; Next.js compilation, type validation and static-page generation completed. |
| `git diff --check` | PASS; only informational LF/CRLF conversion warnings. |

The production build was served locally for a smoke check; the explicit `/tracking-preview` route returned 404. Development mode was restored at `http://localhost:3000` after validation. Starting pnpm in the restricted sandbox initially failed in Corepack's isolated cache; using the existing installation with permission resolved it. No package/lockfile change was needed.

## Browser validation and evidence

Tools: in-app browser with actual rendering, accessible DOM inspection, measured viewport/document widths and saved screenshots. Browser automation guidance was used to inspect real UI results rather than replacing rendering with mock images.

### Actual connected tenant

Authenticated existing local QA session; no login changes or data writes:

- Execution: `6aa7c1b9-eab6-40ee-9731-bc039a749905`.
- Request: `37bbd439-cbb7-41bc-b1a3-ad57451ff12b`.
- Persisted synthetic Lima → Arequipa scenario; confirmed booking, execution in progress, one reported start event, no position, no delivery event and no incidents.
- The route is linked through the persisted decision/plan chain; its confidence is `SIMULATED`, with `PUBLISHED_CORRIDORS` provenance. This proves local connected reads, **not a live commercial shipment**.

Observed checks:

- List → detail navigation, search by Arequipa, no-match/reset, attention empty state and sort controls.
- Current departure and unreported transit do not conflict; no physical milestones or positions are invented.
- All requested viewport widths rendered without document-level horizontal overflow in the original refinement. Mobile and 1440 px desktop captures were refreshed after the later text/block cleanup. Only the milestone rail scrolls when needed.
- Milestone arrows/Home/End and selected-stage centering; browser Ctrl+Home no longer changes the selected stage.
- 3D loads and animates; follow, lateral and overhead controls respond. Pause held the renderer's route cursor unchanged across observations; resume advanced it. This measures **illustrative motion**, not freight progress.
- Map provider unavailable state remains visible. It is not presented as a successful map render.
- A separate session-less origin redirected `/tracking` to `/login`, without signing out the existing user.
- FE-2 carrier shell and Opportunities page still rendered, with its 3D access-card controls. The current shipper session had no selected carrier; this is a presentation smoke test, not a carrier transaction test.

### Responsive captures

The browser reserves approximately 15 px for its scrollbar; this is not horizontal page overflow.

| Viewport width | Measured document width (detail) | Detail | List |
|---|---:|---|---|
| 390 | 390 after cleanup (no overflow) | [Mobile detail](evidence/fe1-tracking-refinement/after-detail-390.jpg) | [Mobile list](evidence/fe1-tracking-refinement/after-list-390.jpg) |
| 768 | 753 | [Tablet detail](evidence/fe1-tracking-refinement/after-detail-768.jpg) | [Tablet list](evidence/fe1-tracking-refinement/after-list-768.jpg) |
| 1366 | 1351 | [1366 detail](evidence/fe1-tracking-refinement/after-detail-1366.jpg) | [1366 list](evidence/fe1-tracking-refinement/after-list-1366.jpg) |
| 1440 | 1440 after cleanup (no overflow) | [1440 detail](evidence/fe1-tracking-refinement/after-detail-1440.jpg) | [1440 list](evidence/fe1-tracking-refinement/after-list-1440.jpg) |
| 1920 | 1905 | [1920 detail](evidence/fe1-tracking-refinement/after-detail-1920.jpg) | [1920 list](evidence/fe1-tracking-refinement/after-list-1920.jpg) |

[Before redesign, 1440](evidence/fe1-tracking-refinement/before-1440.jpg) · [Map unavailable](evidence/fe1-tracking-refinement/map-provider-unavailable-768.jpg) · [Anonymous login](evidence/fe1-tracking-refinement/anonymous-login-390.jpg) · [Carrier presentation smoke](evidence/fe1-tracking-refinement/carrier-regression.jpg).

### Explicit synthetic UI scenarios

`/tracking-preview` is **development only**, visibly labelled “UI QA · Synthetic scenarios · No API calls”. It reuses the production presentation components and never substitutes for a failed operational API response.

Browser-checked scenarios: initial/no events, transit, open incident, resolved incident, delivered, cancelled, rejected, unknown, empty list, loading and error. Also checked the eight-record QA list (four active, three requiring attention and one completed), no geometry/disabled 3D, and the error retry control. These are presentation/behavior checks, not persisted backend operations.

Captures: [Initial](evidence/fe1-tracking-refinement/qa-initial-1440.jpg), [incidents desktop](evidence/fe1-tracking-refinement/qa-incidents-1440.jpg), [incidents mobile](evidence/fe1-tracking-refinement/qa-incidents-390.jpg), [delivered](evidence/fe1-tracking-refinement/qa-delivered-1440.jpg), [empty](evidence/fe1-tracking-refinement/qa-empty-1440.jpg), [loading](evidence/fe1-tracking-refinement/qa-loading-1440.jpg), [error](evidence/fe1-tracking-refinement/qa-error-1440.jpg).

## Verification limits — not claimed complete

1. **Successful provider map rendering remains unverified.** Google Maps returned the unavailable state in this environment. Geometry and conceptual 3D worked; no key, provider configuration or production setting was changed. [Friction log](friction-logs/FE1_TRACKING_VISUAL_VALIDATION_2026-10-12.md).
2. **Insufficient-permission browser case remains pending.** Authentication/authorization tests and failure propagation pass, but a separate logged-in forbidden user was not exercised in the browser. The anonymous redirect was verified.
3. **Reduced-motion setting was not toggled in the browser/OS.** The existing renderer guard and CSS overrides were inspected, but this is not an interactive reduced-motion certification. No OS settings were changed.
4. **Live delivery, live incidents and cross-tenant incident visibility are not certified by this dataset.** Those states were tested with explicit, isolated schema-valid UI scenarios and unit tests.
5. **WebGL context-loss recovery is implemented but was not forcibly induced in the browser.** Normal loading, animation, camera changes, pause/resume and map-provider failure were exercised.
6. Existing workflow/request read limits remain. Search and counts refer to loaded, authorized records; this is not a new backend pagination implementation.
7. The shared viewer emits an existing Three.js warning about `PCFSoftShadowMap` falling back to `PCFShadowMap`. It rendered successfully; this work does not change global FE-2 shadow settings.

## Reproduce locally

1. From `cargomesh/`, run `pnpm dev` if no local server is running.
2. Sign in with the existing shipper test account, open `/tracking`, then open the available transport.
3. Inspect the executive summary; select milestones with pointer or keyboard. Stages without evidence must remain unverified/unreported.
4. Open **Recorrido 3D**, try **Seguir / Lateral / Aérea**, then **Pausar / Reanudar**. Observe the conceptual/no-GPS label.
5. Return to the list; search, change filters, clear a no-match query and change ordering.
6. For states missing from the tenant, explicitly open `/tracking-preview` in development and choose a scenario. Do not describe those scenarios as connected business data.

Implementation and local evidence are ready for review, with the above environment/acceptance limits. This document does not authorize a merge or close HAC-42.
