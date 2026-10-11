# HAC-42 — connected shipper flow

Date: 2026-10-10. Owner: Luis (FE-1). Branch: `codex/v2-full-shipper-flow`. Base and PR target: `main`. This delivery preserves the accepted HAC-14/HAC-35 implementation and extends it; it does not re-merge historical PRs or modify hosted Supabase, Vercel, or production.

## Delivered navigation

The authenticated shipper portal now exposes one connected journey:

1. `/dashboard` reads tenant-scoped requests, bookings, and executions and links to the assistant or the full intake.
2. `/facilities` lists and searches persisted facilities and cargo profiles. Selecting a facility never claims route, capacity, price, or booking.
3. `/freight-request/new` retains the dynamic V2 intake and optional conversational assistant. Step navigation remains local; only the explicit create action persists a DRAFT.
4. `/requests` searches, filters, and sorts the tenant request directory.
5. `/requests/:id` owns the shared request, `draftVersion`, serviceability result, map/card selection, revision, submission, offer/ranking review, commercial decision, and explicit booking consent.
6. `/bookings` distinguishes authorization, carrier confirmation/rejection, and cancellation from transport execution.
7. `/tracking` and `/tracking/:id` render only persisted execution/events/incidents and confirmed route geometry. No geometry means UNKNOWN and no route or 3D visualization.
8. `/history` keeps business request history separate from physical shipment events.

The app shell labels this surface as the shipper portal. Carrier operations remain in their own existing portal and are not duplicated here.

## Screen/action → contract matrix

| Screen/action | API/service | Contract fields used | UI state and recovery |
| --- | --- | --- | --- |
| Dashboard/directory | `GET /api/v2/freight/requests` plus tenant-scoped workspace reads | request id/reference/status/version, endpoints, cargo, timestamps | loading/error boundaries; empty state; no fixture fallback |
| Intake options | `GET /api/v2/intake/options` | five groups: facilities, cargo categories, equipment, packaging, requirements | loading, empty facilities, auth/network/contract error; fixture only through explicit development mode |
| Create DRAFT | `POST /api/v2/freight/requests` | facility id or complete location, windows, units, category/equipment/requirements | explicit action, idempotency, 401/403/network/contract errors |
| Request round trip | `GET /api/v2/freight/requests/:id` | server id/reference/status and `draftVersion` | server response replaces local persisted state |
| Location search/confirm | `POST /api/v2/locations/resolutions`; `POST /api/v2/locations/confirmations` | persisted facility/node candidate, precision, provenance, confirmation | no results, provider/auth/network errors, explicit confirmation required |
| Edit/re-evaluate | `POST /api/v2/freight/requests/:id/revisions`; `GET .../serviceability?expectedDraftVersion=` | `expectedDraftVersion`, endpoints, windows, units, equipment | previous evaluation is cleared while loading; 409 tells the user to reload |
| Submit | `POST /api/v2/freight/requests/:id/submissions` | `expectedDraftVersion` | no optimistic success; 401/403/409/5xx visible |
| Candidate cards/map | canonical serviceability read + `mapServiceabilityToMapViewProps` | exact FTL/LTL/UNKNOWN, reason, source, coordinates/route preview | eligible/ineligible/unknown/zero candidates; no geometry is not drawn |
| Offers/ranking | tenant-scoped workflow reads | attributed carrier/source, version, status, amount/breakdown, validity, score and explanation | empty state contains no sample price; withdrawn/expired offer recovery is visible |
| Selection | `POST /api/v2/freight/requests/:id/decisions` | plan, selected and considered offer ids, policy, rationale, verified evidence | explicit dialog; decision does not imply booking |
| Booking consent | `POST /api/v2/bookings` | decision id, offer id, `AUTHORIZE`, verified evidence | explicit consent; pending/rejected/cancelled remain distinct |
| Tracking/history | tenant-scoped executions, incidents and execution events | execution status/progress, actual route preview, reported events | empty/error/unknown; no invented ETA, position, carrier, or route |

All commands created by this frontend include a unique `Idempotency-Key`. Authorization and organization scope remain server-owned; the browser does not gain access by sending an organization id.

## Representation against the 57-class model

HAC-42 does not create 57 screens or duplicate the master dictionary. The authoritative 57-class/397-attribute mapping remains in [HAC-27](./HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md). This frontend directly represents the following aggregates from that model:

- Organization/member/session through the authenticated shell and server guards.
- Facility, canonical location, cargo profile/category/unit, requirements and equipment in facilities/intake.
- Freight request, revision/version, windows and serviceability evaluation in request workspace.
- Carrier/service/route/candidate and provenance in cards and the map mapper.
- Offer, commercial breakdown, ranking policy/result, decision, booking and hold-related status in the commercial flow.
- Execution, incident and execution event in tracking/history.

Classes that are carrier administration internals remain in the carrier portal. A modeled class is not presented as implemented unless the corresponding API record is returned.

## Reuse and replacement audit

| Existing asset | Decision | Result |
| --- | --- | --- |
| HAC-14 V2 intake, contracts and mapper | Reuse and extend | Single persisted request/version and single candidate selection remain authoritative |
| HAC-15 `RoadCandidateMapView` | Reuse | Mounted through the pure mapper; missing geometry stays unknown |
| HAC-37 conversational panel | Reuse as optional entry | Opens with `?assistant=open`; it does not replace the full form or commercial consent |
| Carrier `RouteNavigation3D` | Reuse renderer only | Shipper tracking supplies actual execution geometry or renders no 3D route |
| Legacy dark intake-only shell and V1 Callao→Santiago copy | Replace/retire from this flow | Shipper pages use the common light application shell and synthetic V2 tenant data |
| Independent page-local mock state | Replace | Server workspace reads plus one request workspace own the flow |

## Accessibility and responsive review

- Native labels, focusable filters/sort, skip link, keyboard-operable cards and dialogs are preserved.
- Dialog title and description are linked by the shared accessible dialog component.
- CSS uses single-column mobile layouts, wrapping actions, non-overflowing identifiers, and reduced-motion handling.
- Visual review performed on 2026-10-10 for dashboard, intake, request detail, facilities, lists and empty tracking/commercial states. The authenticated local dataset showed one DRAFT, three facilities, one eligible and one unknown serviceability candidate, zero offers/bookings/executions, and no route geometry.
- Preserved intake evidence: [desktop](./evidence/hac-42/intake-desktop-preserved.png) and [mobile](./evidence/hac-42/intake-mobile-preserved.png). These are copied from the accepted HAC-14 evidence and are labelled as preserved, not presented as new screenshots.

## Verification

Run from `cargomesh/`:

```text
pnpm typecheck
pnpm check:architecture
pnpm test:shipper-portal
pnpm test:v2-intake
pnpm test:v2-chat-workflow
pnpm test:auth
pnpm test:logistics
pnpm build
```

Final local gate on 2026-10-10: shipper portal 4/4; release suite 315/315; conversation suite 58/58; workflow chat 12/12; logistics 117/117; TypeScript PASS; architecture PASS (283 modules / 69 client entry points); Next.js production build PASS. The reviewed commit SHA and PR are recorded in Linear after publication.

## Honest limits and required integrated retest

- The local authenticated dataset currently has no persisted offers, ranking, decision, booking, execution, incident, or execution events. Their connected UI and contract clients are implemented and negative/empty states are verified, but a positive end-to-end commercial/tracking run requires the approved tenant dataset; no records were fabricated.
- Location resolution currently reports `externalGeocoderUsed: false`; it searches authorized persisted facilities/nodes. The UI states that external place search is unavailable instead of pretending it succeeded.
- Facility contacts are not returned by the current facility/intake contract, so contact autofill is not shown or inferred.
- The local serviceability response has no confirmed route geometry. The mapper and tracking correctly refuse to draw a route or launch 3D for UNKNOWN geometry.
- This evidence does not claim hosted Supabase, Alexa+, AWS, production, or carrier-provider integration. Those require their own environment-specific verification and authorization.

