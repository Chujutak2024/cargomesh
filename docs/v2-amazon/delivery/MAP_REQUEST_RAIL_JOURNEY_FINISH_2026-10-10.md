# Map request rail and journey finish — 10 October 2026

## Scope
Local CargoMesh V2 frontend refinement requested through two screenshots: place tracked requests to the right of the route map; refine journey colors, design and motion. No deployment, database migration, branch, commit or external service mutation.

## Implementation
- `LocalRoute` accepts an optional sidebar. Tracking uses a desktop grid with a 310–340 px request rail; distance, estimated time and truck preference sit beneath the map. Wizard and inspection consumers retain their existing map layout. Below 1000 px the request list stacks below the map and facts.
- Seven compact request rows retain the existing selection callback and dropdown. Teal selection and status colors distinguish arrival, road, departure and stopped states. The current map, truck and operational summary still derive from the selected stored request.
- Journey board uses a slate progress gauge, amber remaining time and indigo planned arrival. Milestones occupy their actual presentation fractions (0, .22, .5, .8, 1). Selecting one updates its contextual detail; comparing times and opening/focusing the map remain functional.
- CSS animates guide markings and subtle truck suspension, transitions progress and reveals action-driven details. Reduced-motion media rules disable all added animations/transitions; cancelled journeys stop guide/truck motion. No additional JavaScript animation loop.
- Tracking keeps the workspace/map/selector mounted between selections to preserve focus. Journey and incidence panels have distinct, request-specific React keys to reset their own state without sibling-key collisions.

## Data and provider boundaries
The authorized demonstration still uses `journey-model.ts` presentation fixtures. Guide animation is not live GPS, dispatch, booking or delivery completion. Existing Google geometry, attribution, provenance and absent-data behavior remain unchanged. No record payload, photo, custom model, review progress or scheduling field is edited by this refinement.

## Verification
- Existing relevant regression suite: 19/19 pass (`tests.log`).
- Architecture checker: 381 modules / 72 client entries pass.
- Next production build includes compilation, lint and TypeScript checks (`build.log`).
- Native Opera desktop and 412 × 915 responsive checks and saved evidence are completed in the final verification pass below.

Evidence folder: `D:\Documents\hackaton 2\cargomesh-v2-map-journey-finish-20261010`.

### Final native verification
- Desktop content width 1863 px with scroll width 1863 px. Geographic map right edge 1423 px, request rail left edge 1462 px; both top edges align within 1 px. All seven selectable requests remain available. `desktop-geometry.json` and `map-rail-desktop.png`.
- 412 × 915 mobile viewport: content/scroll width both 397 px (browser scrollbar excluded), seven requests stack below the map. `journey-mobile.png`, `requests-mobile.png`. Reduced-motion and inactive behavior verified by the CSS rules; OS motion preference was not changed.
- Sequential switching across SOL-0002 through SOL-0007 and back to SOL-0001 produced exactly one journey region every time, with the correct destination/map heading and seven options. `request-switching.json`. Native button selection retained focus after the tracking shell change.
- Departure checkpoint selection changed detail text. Comparison showed 18:06 versus 17:35 with a 31-minute difference; closing restored the actions. Opening the map focused `active-request-map`. `comparison.txt`.
- Live guide background position changed from 6.71 px to 31.01 px between DOM observations; truck remained bound to the current progress. `motion.json`, native `journey-desktop.png`. Full-page capture can momentarily reset a CSS transition; the journey proof uses the native viewport capture.
- Final production build passes compilation/lint/types. Final browser console error list is empty.
- Directory still shows seven requests totaling 74,600 kg with all original cargo/route/date/review progress. SOL-0001 remains Lona lateral and SOL-0007 remains Mi camión. `requests-preserved.txt` / `.png`.
- Browser viewport override reset; initial selected request SOL-0005 restored and tracking tab kept open. Local server restarted on 8080/8083.
