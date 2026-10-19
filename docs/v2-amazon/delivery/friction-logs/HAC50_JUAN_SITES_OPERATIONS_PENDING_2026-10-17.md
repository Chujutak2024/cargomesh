# Sites integration friction — 2026-10-17

1. **Current backend environment: depot operations not installed.** Real authenticated reads of both `/api/v2/carrier-portal/carriers/{carrier}/depots/{depot}/operations` and `/operations/appointments` returned `DEPOT_OPERATIONS_NOT_INSTALLED`. The frontend preserves physical depots and independent service coverage, displays the missing installation, and blocks policy/appointment mutation and additional-capacity checks. These controls require the existing depot operations database capability to be installed through a separately authorized backend/environment task. No schema or migration was changed to hide the incompatibility. Evidence: `NATIVE_RESULTS.json`.

2. **Postal address contract gap.** `CatalogInputsV2.depots.location` supports `label`, country, region, city and coordinates, but no separate structured/postal address field. The UI shows the existing label as the location/address reference and marks the separate address unavailable. It does not submit an unsupported address field or fabricate data.

3. **Shared module directory and pnpm.** `pnpm typecheck` and `pnpm check:architecture` stopped in pnpm's automatic dependency check with `ERR_PNPM_UNSAFE_MODULES_DIR` because the resolved node_modules target is another worktree. Direct invocations of the already installed TypeScript, architecture script and Node test runner passed. No dependency reinstallation or deletion was attempted after that result.

4. **Browser validation unavailable.** Browser use remains disabled in Work settings. SSR checks and real HTTP reads are explicitly separated from visual/browser validation. Hydration, responsive styling and pointer/keyboard interactions require manual review.
