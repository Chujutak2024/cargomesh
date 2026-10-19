# HAC-50 — Connect Juan fleet UI to the existing backend

Date: 2026-10-17 (verification completed 2026-10-18 UTC).
Branch: `codex/unified-workspaces-demo-boundary`.

## Accepted increment

Connect Fleet, vehicle registration/revision and drivers first. Add connected data and actions to Juan's current frontend, preserving its card/detail composition, CSS and public routes. Depot coverage, commercial screens, dashboard and geographic/scene integration remain separate increments.

## Implementation

The existing Juan `FleetWorkspace` now defaults to the authorized Carrier catalog and receives the server-provided membership list. Carrier and ROAD service selectors replace manual UUID entry. A separate explicit control preserves the illustrative examples, which never fill a failed connected read.

`use-connected-fleet.ts` reuses the existing `readConnectedFleet` client, scoped DTO validation and `connectedVehiclePresentation` mapping. Carrier/service changes clear selected objects and forms. Reads are aborted on context changes. Partial catalogs and unauthorized/inactive contexts cannot write. No current-location, telemetry or booking availability is inferred from the home depot or operating state.

The original cards, filters, grid/list directory, detailed vehicle sheet, KPI and engine-chart layout remain. Original vehicle-detail and engine-chart function bodies are byte-identical. The original driver layout now accepts unknown fields and profiles without a linked vehicle; it does not substitute stock photos, performance or regular demo drivers for authorized records.

The new connected registration form retains Juan's three original field groups and operations CSS. It creates/revises canonical ROAD assets using the existing save client, reusable idempotency receipts and expected version. Hidden persisted attributes such as dimensions, axle configuration and registration code survive revisions. Auxiliary/partner resource rules and declared capacity are validated by the canonical schemas. Equipment classification follows the backend enum separately from body/reference illustration.

Drivers can be opened independently and managed through the preserved operational forms. The existing agenda/assignment management and availability checker are exposed inside the original fleet tabs. These remain actual record operations, not local simulation commands.

The fleet inspection dialog uses the existing localized version and marks connected 3D scenes illustrative. No Three.js scene/model implementation was changed. The source-compatibility wizard/directory listeners also received proper subscription cleanup; URL definitions were not changed.

## Pending fields and screens

The current asset contract does not store model year, free-form vehicle description, photo uploads, tank size or insurance/inspection document details from Juan's local registration. Fuel and consumption lack a production source. Those controls remain visible but disabled and explicitly pending. They are not silently discarded by a successful save or hidden in an evidence string. Supported fields include identity, equipment/body, capacity/volume, home depot, registration date, recorded state, odometer, ownership/partner and evidence.

The Sites & coverage view still contains labelled Juan examples. It is intentionally not attributed to the selected authorized Carrier. Connecting those site cards and coverage is the next independent increment. Dashboard, local request/review/Route screens and map/scene operational data still require their own adaptation. Pipeline remains unchanged and connected.

## Verification

- 52 targeted tests passed: permissions/context isolation, registration payload mapping, preservation of existing attributes, invalid/auxiliary/partner cases, save/read adapter round-trip with controlled responses, current client retry/version/error handling, projection, original local operations and navigation.
- Typecheck passed after correcting the test fixture to the real OPERATOR role.
- Architecture passed: 511 modules / 150 client entry points.
- Six SSR component checks passed: complete Juan workspace with scoped cards; original detail with missing telemetry; standalone driver without fake portrait/performance; original three registration groups; read-only save disabled; denied read without example fallback. The connected hook, locale, CSS, motion, navigation and dialog are stubbed. This is not browser or visual layout validation.
- Native authenticated HTTP read loaded 7 ROAD vehicles and 5 drivers. Agenda dependencies validated: 6 calendars, 0 maintenance records, 0 repositioning blocks, 3 driver assignments, 3 vehicle assignments, 0 combinations, 3 executions and 3 holds. All were complete reads.
- Fleet and nested drivers/register/assignment URLs responded 200; the existing legacy redirect and reference assets remain available.
- SHA-256 verified 368 protected files unchanged: styles, routing, server/API, Landing, Client and 3D scenes. Existing connected backend-facing components remain preserved.

No hosted business records were created or revised as a test. Save/reload was verified through the canonical adapters with controlled HTTP responses, not a claimed production persistence E2E. The temporary native read session was revoked with local scope. Browser automation remains disabled in Work settings; clicks, hydration, responsive layout and animation playback require manual review.

## Evidence

Primary-checkout `salida/juan-fleet-backend-20261017/`: pre-change source backup, new/adapted sources, `NATIVE_RESULTS.json`, `PRESERVATION_RESULTS.json`, native read verification and SSR harness.

Open: http://127.0.0.1:8080/carriers/fleet

No migrations, environment changes, new branch, commit, push, merge or deployment were performed.
