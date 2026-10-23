# Judge access observation — 23 October 2026

Owner: Jean. Expert browser walkthrough, approximately 00:25–00:27 America/Lima (05:25–05:27 UTC). Documentation base: `main` at `5f37cb2c8e5340f2dc8a5c252c7817005c66e415`. The production deployment SHA was not exposed/verified by this observation.

## Browser and scope

The session's in-app browser inventory contained no tabs before a new tab was opened. No credentials were entered or supplied. A separate Chrome profile was unavailable; the browser interface did not support the attempted origin-storage reset. Therefore the strict **clean-profile requirement is pending confirmation — Jean**, using a fresh private/profile window before handoff. No storage change was applied. This record verifies the observed direct-entry behavior, not profile isolation or a fresh-checkout run.

Only navigation and inspection were performed. No assistant turn, voice session, request creation, quote, confirmation, cancellation, dispatch or transport start was performed. No database, cloud, environment, permission or deployment tools were used to change the application.

## Observed steps

| Step | Action | URL | Visible result |
|---|---|---|---|
| 1 | Open public home | https://cargomesh.vercel.app/ | “Every shipment. A clearer journey.”; “Explore Shipper” and “Explore Carrier”. No login form. |
| 2 | Click Explore Shipper | https://cargomesh.vercel.app/clients | Transient “Opening Client”, then Dashboard and “What do you need to ship today?”. Shipment counts and recent synthetic records loaded. No credentials requested. |
| 3 | Follow Tracking | https://cargomesh.vercel.app/clients/tracking | Transient “Loading transports”, then two loaded transports: one awaiting departure and one cancelled. Existing records only; counts are a snapshot. |
| 4 | Open the awaiting-departure record | https://cargomesh.vercel.app/clients/tracking/f1502f63-16f4-4535-82e9-25652362c733 | Booking reported; preparation/resources assigned; departure and delivery awaiting reports; no reported position. Google basemap, simulated endpoints and “Map: Google Maps Platform · Simulated geometry”. “Planned route, not a live position.” |
| 5 | Navigate back to public home | https://cargomesh.vercel.app/ | Both workspace entries available again. |
| 6 | Click Explore Carrier | https://cargomesh.vercel.app/carriers | Transient “Opening Carrier”, then Dashboard. Loaded counts: 5 operations, 10 road vehicles, 0 recorded positions and 2 sites. Labels explicitly distinguish catalog records from capacity and sites from coverage. No credentials requested. |
| 7 | Inspect Carrier map after load | https://cargomesh.vercel.app/carriers | “Loading Google Maps… The operation list remains available.” disappeared; Google map controls and a simulated depot appeared. One of two sites mapped; no vehicle positions reported; “no live GPS”. |

The Google basemaps were visible on both inspected views, and the captured map-filtered warning/error logs were empty. The previously reported `RefererNotAllowedMapError` was not reproduced here. A timeout/loading label seen during initialization is not recorded as a persistent map failure.

## Source checks and remaining acceptance

- [PR #151](https://github.com/Chujutak2024/cargomesh/pull/151) is merged; merge `538c141fe29c055eeac4bf790d3a4bdba96e906e` is an ancestor of the reviewed base. Its schematic fallback exists in accepted source. This check did not force a provider error or verify the fallback in production.
- [PR #149](https://github.com/Chujutak2024/cargomesh/pull/149) is merged; merge `8d9bd056bde582f7ac8741d83980422eb94c6e87` is an ancestor of the reviewed base. Typed-only continuous input is implemented in main. No Nova browser acceptance or current AWS revision/digest was checked here.

| Pending item | Owner | Concrete next evidence |
|---|---|---|
| Strict clean-profile entry and fresh-checkout reproduction | Jean | Repeat both entries in a fresh private/profile window; record browser, time and result. Follow setup from a fresh checkout separately. |
| Full conversational walkthrough and audible completion | Axel; Cristhian owns final video acceptance | Record the actual final browser bundle, question/correction/review and consent boundaries; identify the deployment/scenario used. |
| Current AWS source/image/task identity | Axel, coordinated by Cristhian | Authorized read-only deployment evidence; historical revision 5 is not a current-state assertion. |
| Maps beyond the two observed views; degraded fallback | Juan, coordinated by Cristhian | Exact failed URL/message if reproduced, or a bounded fallback acceptance record. No cloud changes in this task. |
| Public video URL and final submission | Cristhian | Public English video under three minutes; verify unauthenticated playback and submit through Devpost. |
| Additional Open Source contribution | Cristhian | Actual separate artifact, contributor, license and timing; otherwise omit that mini challenge. |

No end-to-end commercial success, live telemetry, worldwide coverage, live Alexa+/Echo acceptance, fresh-profile success or video availability is inferred from source code or this access check.
