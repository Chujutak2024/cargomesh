# HAC-50 — Restore Juan fleet presentation over the connected catalog

Date: 2026-10-17. Existing branch: `codex/unified-workspaces-demo-boundary`. User authorization: restore the previous Juan presentation, retain the current dropdown/navigation and URLs, preserve connected backend features, leave new 3D models to Juan. No commit, push, migration, seed or deployment performed.

## Changes

- Extracted the original truck card, reference images, detail panels, engine chart and photo credits from `fleet-workspace.tsx` into `fleet-presentation.tsx`. The legacy demo and connected directory now reuse those components and the existing `fleet.module.css`; no new fleet design or CSS palette was introduced.
- Restored the four KPI composition, fleet section controls, card/list switch, search, filters, truck detail, driver profile and entry into existing inspection/depot scenes at `/carriers/fleet`.
- Added a small read-only presentation mapper from the existing authorized asset/driver/assignment/maintenance catalog. IDs, service scope, timestamps, recorded capacities and conditions are retained. Only unique, confirmed, current execution assignments link a driver to a truck. No local example driver fills a missing relationship.
- Driver profiles accept missing photo, experience, performance, base, regular shift and join date. Unknown fields show pending/empty data. Catalog state does not imply a verified available resource window.
- Existing creation/revision forms, role/partial-read guards, expected versions, idempotency, driver management and agenda/assignment functionality remain in place. Areas and depots use the existing authorized Carrier network reader.
- Restored inspection access through callbacks, so opening details does not change the URL. Existing 3D scenes are labeled illustrative: they do not establish a live position, physical depot presence, cargo or task. New models, geometry and the future multi-truck coordinator remain Juan's responsibility.
- No navigation, redirect, sidebar/dropdown, map provider, key or API path changes in this task. Only the fleet heading in the existing coordinator was restored. Sources already edited by the other front chat are preserved; their CSS was not changed here.

## Verification

- Focused fleet/model/navigation suite: 57 tests, including four new mapper tests covering missing data, identity, ambiguous assignments and maintenance history.
- TypeScript: PASS via installed compiler; architecture: PASS (450 modules, 117 client entry points).
- Native authorized read: 7 vehicles and 5 drivers, complete catalog, no operational read gaps. The shared presentation mapper retains all 7 asset IDs. Unsupported telemetry remains null. No hosted business writes.
- `/carriers/fleet` returns HTTP 200 with the restored Fleet heading/subtitle; existing `/v2-workspace` redirect remains HTTP 307 to `/carriers`. Reference photo assets respond HTTP 200.
- Component markup harness: original truck card, original vehicle detail and original driver profile render without fake performance or stock identity. Locale and CSS imports are stubbed in this server render; it does not validate real layout, keyboard interaction or animation.
- Native browser automation is disabled in Work settings. No current screenshot, responsive/layout assertion or end-to-end animation claim is made. The app remains available for user review on 8080; the preserved Juan comparison remains on 8082.

## Evidence

Primary workspace `salida/fleet-restore-20261017/`: guarded source baseline/backups, `NATIVE_RESULTS.json`, `SCOPE.json`, native verification script and component render harness. No passwords, tokens or private environment values appear in evidence.
