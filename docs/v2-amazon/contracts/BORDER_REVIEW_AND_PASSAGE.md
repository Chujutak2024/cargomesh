# Carrier border review and passage — V2

Authorized incremental contract, 2026-10-16, HAC-50. Owner: Cristhian. This adds a Carrier operation to V2; it does not reuse V1 fixtures or certify a customs integration.

## Separate facts

1. Service coverage declares a directed lane and its international conditions.
2. A crossing dossier records the Carrier's review of its declared document checklist.
3. Passage events report physical progress independently of that review.
4. A legal/authority authorization is a separate fact, currently **UNKNOWN**.

An internal `APPROVED` decision means only that all declared documents have references and validity covering the planned crossing window. It is not a government authorization, legal sufficiency of the checklist, vehicle clearance, booking, or proof that a vehicle moved.

## Dossier context

Immutable context: Carrier/service/lane, directed country pair, operation reference, route fingerprint, checkpoint reference, planned UTC window, required document codes, provenance, and optional native execution ID. Catalog lane version and a server-generated fingerprint of the service/lane/pickup-area/delivery-area versions are captured at creation.

The current country pair must match the lane's persisted pickup and delivery areas. The lane, service, areas and Carrier must be active; the areas must be pickup/delivery inclusions and their evidence/validity must cover the window. A prohibited crossing cannot be created or advanced. Changing a catalog version invalidates the dossier for subsequent commands and simulated readiness; read/history remain available.

`routeFingerprint`, `operationReference`, checklist and checkpoint reference are Carrier declarations at this stage. They are **not** a verified join to a Google route, Client request, or canonical border node. Assessment explicitly returns `DECLARED_NOT_PROVIDER_VERIFIED`, `CARRIER_CHECKLIST`, and `DECLARED_NOT_VERIFIED`. Do not infer intermediate transit countries from endpoint countries. A later routing adapter must publish an ordered crossing list and bind dossiers to that actual route/leg before a complete travel feasibility claim.

An optional execution ID is checked against the same Carrier/service and planned window at creation. `CARRIER_REPORTED` passage events require that native execution to be `IN_PROGRESS`; an unlinked dossier supports planning/document review only. The context cannot be attached or reassigned silently later. If the itinerary/window/context changes, create a new explicitly identified operation and revalidate its documents.

## Review and passage transitions

Review:

```text
PENDING -> IN_REVIEW -> APPROVED | NEEDS_DOCUMENTS | REJECTED
NEEDS_DOCUMENTS -> IN_REVIEW
APPROVED -> IN_REVIEW (explicit re-review invalidates readiness)
```

`IN_REVIEW` may receive further evidence. `REJECTED` is terminal for this dossier. A released/crossed dossier cannot have its review rewritten. Approving requires each declared document, no duplicates/undeclared codes, check time no later than now or activity start, and validity through the entire planned window. References are attestations, not uploaded document storage or independent verification.

Passage:

```text
NOT_STARTED -> APPROACHING -> WAITING -> INSPECTION -> RELEASED -> CROSSED
WAITING | INSPECTION -> HELD -> INSPECTION
```

No skipped stages or reverse events. Event time must be within the declared crossing window, no later than the server clock, and no earlier than the prior event. `RELEASED`/`CROSSED` require current internal approval and documents. Release requires an explicit source reference; it does not become authority-verified by being entered by an operator. `CROSSED` is terminal. Historical events outside the planned window and late re-planning need a subsequent contract; do not alter history to hide them.

## Provenance and assessment

- `SIMULATED`: scenario events and evidence; retained through the complete lifecycle.
- `CARRIER_REPORTED`: authenticated Carrier attestation; not a direct authority/GPS integration.
- A client cannot submit `VERIFIED`, `governmentVerified`, or arbitrary permission flags.
- `documentStatus` is scoped to internal document readiness. `catalogCheck` is separate.
- `simulatedJourneyReady` requires a current approved simulation and current catalog evidence. A hold disables it.
- `travelAuthorization` remains **UNKNOWN** for both modes. An external authority verifier is not implemented.

The existing ROAD discovery `BORDER_DOCS_UNKNOWN` and commercial SQL border-pending checks remain conservative. This module does not automatically clear them. Future Client/discovery composition must use an authorized minimal projection and a separate trusted permission contract; do not call private Carrier APIs with a fabricated identity.

## Commands, access and persistence

Base: `/api/v2/carrier-portal/carriers/:carrierId/border-crossings`.

| Method / suffix | Purpose |
| --- | --- |
| GET / POST base | Bounded list / create dossier |
| GET `/:id` | Current dossier |
| POST `/:id/reviews` | Versioned review/evidence decision |
| POST `/:id/passage-events` | Versioned physical event report |
| GET `/:id/history` | Newest audit events, bounded |
| GET `/:id/assessment` | Read-only document/catalog assessment |

Mutations use `{expectedVersion, value}` and a UUID `Idempotency-Key`. Creation uses version 0; revisions use the current positive version. Canonical JSONB payloads are hashed with SHA-256. Identical concurrent retries return one receipt; different payloads conflict. Row locks serialize revisions; a stale writer returns `409 STALE_DRAFT`. Reads revalidate verified Carrier identity, and ADMIN/DISPATCHER may mutate; OPERATOR is read-only. Cookie mutations require same origin. Responses are private and non-cacheable.

Public rows use RLS and SELECT-only grants. All writes and history reads go through checked functions; private receipts/events are not directly exposed. Commands atomically persist a new version, its actor/time audit event and receipt. No synthetic organizations, carriers or documents are inserted by the migration.

List returns up to 100 dossiers and history up to 1000 events; `meta.partial` is explicit. Full pagination is pending if these bounds are exceeded. Missing hosted migration returns `503 BORDER_OPERATIONS_NOT_INSTALLED`; never replace the connected result with demo data.

This cut does not change prices, offers, reservations, assignments or delivery promises when a hold occurs. A later operational/Client workflow must calculate the impact and request acceptance where required.
