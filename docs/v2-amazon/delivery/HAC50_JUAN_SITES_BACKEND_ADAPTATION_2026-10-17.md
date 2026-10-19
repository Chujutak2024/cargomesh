# Juan Sites & coverage — connected increment

Date: 2026-10-17 (verification 2026-10-18 UTC).
Checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`.
Branch verified: `codex/unified-workspaces-demo-boundary`.
URL retained: http://127.0.0.1:8080/carriers/sites

## Implemented

Juan's original site grid, card classes, detail composition, operations styles and navigation remain. The connected screen does not mount `ConnectedCarrierNetwork`. The original local example screen is isolated in `carrier-sites-example.tsx` and is reachable only through the explicit example switch. No example data is used after an empty, denied or failed connected read.

The existing Fleet context owns the authorized Carrier and selected service. Sites adds no independent Carrier/service selector. Its lightweight catalog read avoids requiring successful vehicle/driver reads to choose a site or service; the Fleet read and ROAD projection retain their default behavior. Sites can inspect any service in the authorized service catalog. Fleet context changes discard incompatible references.

Cards and details show the carrier's persisted depots, canonical location reference, city/region/country, coordinates and handling capabilities. Zero depots is supported independently of coverage. The depot API has no separate postal address field; the recorded location label is displayed without inventing an address or accepting an unsupported field.

Service areas show pickup/delivery, include/exclude, geography, own/partner source, evidence, verification and validity. Connections retain direction, endpoint labels, mode, validity, transit provenance and border flags. No city labels from the former comma-separated local form become connected coverage. Neither depot location nor a service relation implies vehicle presence, availability or geographical coverage.

ADMIN users with complete catalogs can create and revise depots, service areas and directed connections. Existing canonical forms provide review, authenticated API calls, stable retry keys and expected versions. Partner/area/service/execution references come from the authorized catalog; no manual UUID input is required. Save triggers a new authorized read, preserving the selected depot if it still exists. Read-only users cannot open write forms. Partial reads disable affected writes.

Depot operating rules and appointment forms are reused from the existing workspace. The selected depot/service is controlled by Juan's context; the redundant selectors are hidden. The policy displays structured weekly hours, IANA timezone, handling resources, equipment compatibility, concurrency limits, blocked windows and evidence. Appointment rows are scoped to the selected service. The implemented forms cover policy definition/revision, read-only additional-capacity checks and appointment registration/revision/cancellation, with canonical validation, idempotency and expected versions.

Carrier/service/depot changes unmount incompatible forms and abort reads. Reader results carry scope; stale or aborted results cannot populate the next context. Dependent failures retain readable depots, coverage or policy with explicit gaps. A 401/403 invalidates the affected view instead of exposing previous records.

## Current environment and operational actions

Authenticated real Next HTTP reads using the existing configured local identity returned:

- ADMIN membership; 1 depot, 1 service, 0 partners.
- 2 service areas and 1 directed connection; complete catalog reads.
- `/carriers/sites`: HTTP 200. An unauthorized carrier's depot endpoint: HTTP 403.
- **Policy and appointment endpoints: `DEPOT_OPERATIONS_NOT_INSTALLED`.** Both remain pending and unavailable in this environment. Depot and coverage reading remains available; policy/appointment mutations and capacity checking cannot be claimed operational here. No remote migrations were changed or applied.

Depot/area/connection create and revise controls are wired to the existing APIs and enabled for the current ADMIN's complete catalog. Their save/reload, version conflicts and retry behavior were validated with controlled responses. **No business records were created or revised against the real environment.** Real persistence after a write was not certified.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — passed.
- Architecture: `node scripts/check-architecture.mjs` — passed, 516 modules / 152 client entries.
- 65 targeted tests — passed. They include carrier/service scope, authorization loss, empty/partial catalogs, cancellation of late responses, selection reconciliation, canonical references, version conflicts, retry receipts, controlled save/read refresh, depot operations, existing Fleet registration and navigation regressions.
- 7 controlled SSR checks — passed. Cards/detail classes, empty depots with independent coverage, read-only and partial controls, no manual UUID field, service-scoped appointments and missing-operation states. CSS and locale are stubbed and React state is supplied explicitly; effects and browser interactions are not exercised.
- `NATIVE_RESULTS.json`: real authenticated read evidence, 0 business writes. The temporary native read session was revoked with local session scope.
- No browser/visual validation: local browser use is disabled in Work settings. Hydration, clicks, keyboard interaction, responsive layout and animation playback remain unverified in a browser.

The normal `pnpm` invocation attempted its dependency status check and stopped at `ERR_PNPM_UNSAFE_MODULES_DIR` because `node_modules` resolves into another worktree. The existing TypeScript, architecture and test commands were run directly with Node. Dependencies, lockfile and module directory were not changed as a workaround.

## Files and recovery

Adapted existing files:

- `src/features/carrier-juan/carrier-sites.tsx`
- `src/features/carrier-juan/fleet-workspace.tsx` — only context/source controls, Sites mounting and hiding unrelated Fleet KPIs in Sites.
- `src/features/carrier-juan/use-connected-fleet.ts` — optional lightweight Sites catalog context.
- `src/features/carrier-juan/connected-fleet-state.ts` — optional all-service context for Sites; default ROAD behavior preserved.
- `src/features/carrier-portal/fleet-client.ts` — honor explicit partial metadata.
- `src/features/carrier-portal/depot-operations-workspace.tsx` — controlled context, scoped appointments, partial reads and pending states.

Added files:

- `src/features/carrier-juan/carrier-sites-example.tsx`
- `src/features/carrier-juan/sites-client.ts`
- `src/features/carrier-juan/sites-model.ts`
- `src/features/carrier-juan/site-catalog-editor.tsx`
- `src/features/carrier-juan/sites-client.test.ts`
- `src/features/carrier-portal/depot-operations-client.ts`
- Delivery and friction documentation under `docs/v2-amazon/delivery/`.

The primary checkout's `salida/juan-sites-connected-20261017/before/` contains the exact pre-edit copies of all six existing files. `SOURCE_DIFF.patch` compares this increment against those copies, including the six new source/test files. `FILE_MANIFEST.json` stores before/after SHA-256 hashes. `SSR_RESULTS.json` and `NATIVE_RESULTS.json` separate controlled and real checks. Implementation/test scripts are retained beside them.

No branch switch, commit, push, PR, merge, deployment, seed, credentials, server contracts, migration, maps, Three.js, Driver/registration implementation, commercial or Pipeline changes were performed. Existing concurrent work remains in place.
