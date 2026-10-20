# HAC-50 — Opportunity deep-link context and navigation hydration

Date: 2026-10-19. User-reported blocker, corrected as a focused exception to the deferred October 21 validation campaign.

## Observed failure

The supplied opportunity belongs to C01 Lima Local. The user's screenshot showed California Link selected, zero opportunities and an unavailable-record message. The coordinator initialized Commercial from the first authorized Carrier and did not consume an explicit Carrier query. The original link supplied by the integrator omitted that context. Access denial under California Link was correct; broadening permissions or scanning other tenants was not required.

The second screenshot showed a hydration attribute mismatch on the Carrier sidebar's React-generated id. Sidebar/group/label identifiers depended on useId tree position rather than the single workspace landmark's stable identity.

## Changes

- New pure carrier-context helper resolves the carrier query only within initialAccess. An explicit unauthorized Carrier resolves to no selection; it does not grant access or silently substitute another Carrier.
- Commercial coordinator synchronizes authorized context on entry/history changes. Changing the selector writes its Carrier to the URL using existing routes.
- Same-document navigation retains Carrier context, and service context only when remaining with the same Carrier. Explicit switches do not inherit the previous Carrier's service.
- Sidebar, label and group IDs use stable identifiers for the single navigation landmark per workspace document; controls retain their aria relationships. No suppressed hydration warning, disabled SSR, route rename or authorization change.

Correct local link:

http://127.0.0.1:8083/carriers/requests/details/26aa4fb0-1550-4c03-8723-5275e1e1aa3f?carrier=e5000001-0000-4000-8000-000000000001

## Focused evidence

- TypeScript compilation exit 0.
- Five targeted context assertions: requested Lima overrides California among authorized IDs; unavailable Carrier fails closed; selection survives workspace navigation; a Carrier switch drops the previous service; external navigation is rejected.
- Opened the corrected link in the in-app browser with the existing native local Carrier session. Observed Lima Local, four opportunities and the target request, 100 kg / 1 m³ with requested windows. Console error read after navigation returned no entries. This is agent inspection of the reported blocker, not validation of the whole flow or the user's separate Chrome session.
- No accept/decline, preparation save, offer issuance, business write, credentials, grants or database changes during this fix. No broad suites or regression campaign run.

Local screenshot: salida/client-carrier-connection-20261019/carrier-detail-context-fixed.png. Original changes backed up under before-detail-context-fix/. General functional/visual validation stays scheduled for October 21. Native multi-tab link behavior and the complete cross-portal flow remain part of that validation.
