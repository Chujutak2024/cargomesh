# HAC-50 — operational fleet and visual handoff

Date: 2026-10-17. This document does not authorize changes to the other chat's files. Carrier backend and front ownership stay separate. New product copy should be English.

## Existing extensibility, reused now

| Concern | Current source of truth | What a new vehicle requires |
|---|---|---|
| Carrier/service ownership, equipment, useful kg, m³, body/brand/model and dimensions | `TransportAsset` via existing `assets` catalog commands | Register an asset using an existing canonical equipment class; add its evidence |
| Cargo/temperature/certifications | Persisted `capability-definitions` and `asset-capabilities` for that service/category | Attach evidenced capabilities; a reefer-looking model is not cold-chain evidence |
| Agenda, reservations, maintenance, repositioning | Existing calendars/workflow/maintenance/block records | Publish evidenced availability and real commitments |
| Driver | Existing `drivers` and assignments | Publish driver evidence, license timezone/date and recorded duty window/budget |
| Current position | Authorized execution/position evidence | No coordinates inferred from home depot; distinguish measured, stale, estimated and simulated |
| Icon and Three.js model | Front renderer registry, currently procedural models/body-text inference | **Pending front work:** explicit allowlisted model association, independent from operational attributes |

A new brand, model or body variant does not require changing the routing algorithm. A genuinely new equipment semantic class requires extending the canonical TS/SQL contracts and tests; entering arbitrary `equipmentType` text is rejected. This increment does not introduce another profile catalog or silently migrate the existing equipment enum.

## Proposed renderer association — not persisted or wired by this increment

Use stable asset identity plus an explicit `visualModelKey`, with `registryVersion`, an optional allowlisted poster/icon key and an explicitly labelled generic fallback. Key lookup must not infer capacity, temperature, coverage or physical location. Unknown keys should show **Generic vehicle**, not silently choose an articulated/reefer model. Resolve assets through the existing authorized catalog; do not accept arbitrary GLB/remote URLs or browser-supplied permissions.

Separate the map marker from the 3D model. A valid newly registered asset can appear with a neutral map icon immediately, even if its custom model is not available. UI grouping must work with 0..N assets/carriers; avoid fixed lists of ten suppliers or twenty models as product rules.

## Consume the operation endpoint

`POST /api/v2/carrier-portal/carriers/:carrierId/road-operation-assessments`

- Use an authenticated same-origin Carrier session and the selected service/asset/driver. This is a Carrier-private assessment, not Client discovery.
- Build the body from `src/shared/schemas/v2/road-operation.ts`; display required assumptions and distinguish null/unknown from zero.
- Render original route points on Google Maps, matching `selectedForReviewId` to `road.routing.alternatives[].id`. Do not redraw/smooth invented road segments. If the selected review route is null, show the reasons; do not fall back to a blocked route.
- Show **Driving estimate** and **Total occupied time** separately, plus loading, waiting/unloading and repositioning windows. Times are instants; display them with the chosen IANA timezone.
- Label `modeledDecision` as **Modeled checks**, never **Confirmed availability**. Top-level unknown = **Needs review**, ineligible = **Cannot serve this scenario**. Preserve source/provenance, versions and unresolved reasons.
- Display unknown current readiness, unverified truck access and pending legal/border requirements. A 3D animation is illustrative, not GPS or customs evidence.
- On `409 STALE_OPERATION` or `STALE_COVERAGE`, refresh/re-evaluate. Do not automatically book or submit an offer from this assessment.
- Keep the existing coverage/road-only endpoint available. The new composition adds handling/resource constraints and may choose a different review alternative from `road.routing.selectedId`.

## Still owned by subsequent backend work

Persistent jurisdiction/vehicle policy profiles; verified current-location-to-pickup repositioning; legal breaks/relay shifts; depot/facility binding to handling; border dossier composition; minimized Client projection with request version; atomic assignment/reservation and commit-time revalidation. No final availability or commercial offer is created by this increment.
