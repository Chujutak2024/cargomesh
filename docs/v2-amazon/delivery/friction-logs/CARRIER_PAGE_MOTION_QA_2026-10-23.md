# Carrier page motion — verification boundary

2026-10-23, America/Bogota. Base: `main` at `1e65b6a`.

The shared page-entry controller now covers Carrier navigation, retained tabs, detail routes and asynchronously inserted content without remounting forms. Motion/preference tests (15), Carrier navigation (7), Carrier commercial tests (118), typecheck and architecture checks pass. Browser checks covered every sidebar module, commercial tabs, opportunity/order details, fleet subtabs and direct Control Tower/Route Lab links. Desktop and 390px mobile layouts showed no horizontal overflow in the checked views. Reduced motion and focused-field preservation are covered by controller tests.

`pnpm test:carrier-closeout` cannot pass its five map lifecycle checks: its CommonJS VM adapter loads `display-identity.ts` without `require`, but the unchanged HEAD source imports `demo-presentation`. Evaluating the source from `git show HEAD:cargomesh/src/shared/lib/display-identity.ts` in the same exports-only VM reproduces `ReferenceError: require is not defined`. Neither that source nor the map test adapter was changed for this visual task.

The existing local Supabase instance also returned 409 for some Carrier assets/calendars/depots reads. Orders displayed partial-read warnings and Fleet could not expose its fully populated forms; those data-dependent flows are not certified by this visual check. The dev server and existing Docker Desktop installation were started for QA. No migrations, seeds, commercial mutations or hosted changes were applied. These failures were left outside the animation change.
