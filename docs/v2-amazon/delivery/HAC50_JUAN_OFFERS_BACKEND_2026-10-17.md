# Juan Offers — connected commercial workspace

Date: 2026-10-17 (checks completed 2026-10-18 UTC).
Checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`.
Application: nested `cargomesh/`. Branch: `codex/unified-workspaces-demo-boundary`.
URL: http://127.0.0.1:8080/carriers/offers

## Implemented frontend

The Offers route now mounts its own connected commercial components inside Juan's coordinator. It retains Juan's directory cards, transport manifest, checklist/sidebar composition, existing CSS, selects and navigation. It does not mount `ConnectedCommercialWorkspace` as the Offers screen; Pipeline keeps that existing component unchanged. The original `request-review.tsx`, its CSS and the local Client editor are unchanged.

Offers uses the same selected Carrier as Requests and Pipeline, including the existing header selector. It has no independent identity selector. The coordinator changes are limited to the Offers mount, header/context participation, English Offers heading and exclusion of the old local/Customer-read logic for that view. A legacy review action targeting Offers now navigates there without first reading a Customer freight request.

The directory shows native Carrier opportunities/offers with loaded-record search, status filtering and detail reads. Opportunity origin, destination, cargo, requirements and requested windows are read-only. Absent requested windows remain explicitly unavailable; response deadlines and resource windows never fill them. Detail reads and collection reads validate scope through the existing commercial parsers.

Preparation captures the authorized assignment subset, manual Carrier source, USD price/breakdown, commercial validity, proposed pickup/delivery, documented transit duration, declared reservable capacity, terms and evidence. Known source/reference fields from an existing offer survive a replacement preparation. A new preparation has no invented price, dates, capacity or evidence timestamps. Dates require an explicit Z or UTC offset; display dates use UTC labels.

Quoted costs less quoted discounts are checked in integer cents against the total. Included costs are not charged twice. Estimated, excluded and unknown components remain separately labelled. Canonical `offers.create` validation applies immediately before review. Transit duration requires identified supporting evidence. Blank optional values remain null/unknown.

Issued offers are displayed as saved records, with source, validity, record version, commercial version, plan/opportunity references and the persisted data. They have no direct edit form. Expiry and not-started validity are derived display states; no new persisted offer state was introduced. A replacement preparation creates a new offer using `supersedesOfferId` in a **single** existing issuance command. It never withdraws the old offer in a separate call. The existing SQL workflow owns atomic substitution, status, selection restrictions, booking constraints and version increment.

Withdrawal has a separate reason/evidence review and explicit confirmation, using the existing expected record version. ADMIN and OPERATOR commercial permissions are reused; DISPATCHER cannot emit/withdraw/replace. Incomplete reads and current read errors block affected writes. Known active bookings block offer changes in the UI; selection and concurrent commitment restrictions remain authoritative server checks.

All mutations retain a retry receipt while path and canonical submitted payload remain identical. Editing the payload changes the key. Issuance time is frozen when review begins, so a retry does not silently create a different payload. Failed submissions retain the preparation. Carrier/operator changes unmount forms, abort reads and hide incompatible records. Preparations are held in a component-local map keyed by operator, Carrier, opportunity and replaced offer; the operator is the authenticated user-bound Carrier principal. There is no shared localStorage/global draft key and no use of the Client draft storage.

## Preparation persistence: partial delivery, not certified complete

Inspection found no commercial preparation storage in the existing workflow. `offers.create` issues state `RECEIVED` and was not reused as a silent draft-save endpoint.

This increment adds a separate bounded preparation contract, service, repository adapter and authenticated HTTP GET/POST route at:

`/api/v2/carriers/{carrierId}/offer-preparations`

Preparations allow structurally valid incomplete field strings and an empty assignment selection. They do not become offers. The service validates authorized opportunity/replacement references, user/operator/Carrier isolation, request/organization correlation, expected version, idempotency key and a deterministic SHA-256 fingerprint. The repository targets a separate `offer_preparations_v2` RPC and returns an explicit installation error if absent. The route reuses the existing session/Bearer identity and same-origin mutation protection. It does not change the emitted workflow or Client backend.

**Actual environment result:** HTTP 503 `OFFER_PREPARATIONS_NOT_INSTALLED`. The persistent-save control is disabled while that capability is unavailable. “Keep preparation in this tab” is explicitly local to this workspace memory and lasts only while the workspace remains open. It is not presented as saved in Supabase. Persistent preparation is **not operational or fully verified** in this environment.

The minimum database increment is prepared as `preparation-schema-candidate.sql`, with a generated bounded JSON schema, private owner-scoped tables for preparations/revisions/receipts, RLS, indexes, authorization and role checks, SHA-256 receipt hashing, optimistic versions, canonical grouped assignment references and serialized atomic saves. The privileged implementation is private and the public RPC is an invoker wrapper with explicit grants. It is a **review candidate outside the active migration chain**, not an applied migration.

Docker was unavailable and no local Supabase CLI was found, so no database was modified to validate that candidate. `preparation-schema-pgtap-candidate.sql` contains structural security tests and is **not executed**. Activation requires backend-owner review, a CLI-generated additive migration, migration manifest/generated types review, SQL/RLS/advisor checks, multi-user authenticated RPC and concurrent transaction tests in an isolated DB, then separate authorization for any remote application. Historical migrations and the current manifest are unchanged.

## Real reads and controlled checks

- Real Next HTTP cookie session using the existing configured local identity: **4 opportunities, 4 offers, 4 bookings, 3 executions**, complete reads. Opportunity states: OFFERED. Existing offer/opportunity detail reads parsed successfully.
- `/carriers/offers`: HTTP 200 with the connected Offers mount; old local-example notice absent.
- Another Carrier's offers: HTTP 403. Anonymous preparation endpoint: HTTP 401. Persistent preparation endpoint: HTTP 503 with the expected missing-installation code.
- No calls to `/api/v2/freight/requests` were made by the read harness.
- **0 real business writes.** Issuance, withdrawal, substitution and save/reload were tested with controlled HTTP responses/repositories. Actual business persistence and real issuance/withdrawal/replacement are not certified. The temporary read session was revoked with local session scope.
- TypeScript passed using `node node_modules/typescript/bin/tsc --noEmit`.
- Architecture passed: **531 modules / 158 client entry points**.
- **78 targeted tests passed**: monetary totals/discounts, explicit offsets/date ordering, source/reference correlation, roles/deadlines, partial/empty/denied/aborted reads, retry receipts, withdrawal version conflicts, one-call replacement, separate preparation saves, owner isolation, SHA-256, optimistic versions, route authentication/CSRF, existing Requests and commercial/workflow/navigation regressions.
- **10 controlled SSR checks passed**: Juan card/manifest/checklist classes, read-only Customer facts and unknown windows, immutable offer display, empty/denied/partial states, role-disabled controls, explicit preparation storage distinction, no manual UUID fields and separate issuance/withdrawal confirmations. React state and connected hook are controlled; CSS/locale are stubbed. Effects/clicks/hydration/layout are not exercised.
- Browser inventory returned **“Local browser use is disabled in Work settings.”** No visual, responsive, keyboard, animation or browser-interaction validation is claimed, and no screenshot is supplied as validation.
- SHA-256 preservation check: **414 pre-existing protected files unchanged** across Juan's other screens, server/shared code, portal components and the V2 migration directory. The only adapted existing source file is `carrier-juan/coordinator.tsx`, backed up exactly before editing.

## Files and dependencies

Adapted existing source:

- `cargomesh/src/features/carrier-juan/coordinator.tsx`

New isolated source/test files:

- `carrier-juan/connected-offers.tsx`
- `carrier-juan/use-connected-offers.ts`
- `carrier-juan/offers-model.ts` and `offers-model.test.ts`
- `carrier-juan/offers-client.ts`
- `carrier-juan/offer-preparation-editor.tsx`
- `carrier-juan/offer-withdrawal-form.tsx`
- `shared/schemas/v2/offer-preparation.ts`
- `server/modules/offer-preparations/application/preparation-service.ts` and its test
- `server/modules/offer-preparations/infrastructure/preparation-repository.ts`
- `server/hono/routes/offer-preparations.ts`
- `app/api/v2/carriers/[carrierId]/offer-preparations/route.ts`

The new shared preparation contract is owned by this Offers increment and depends on the existing commercial evidence/enums; **existing `commercial.ts`, `workflow.ts`, permissions, commercial readers/models, Hono app, identity and workflow service/repository were not modified**. The filesystem route avoids editing the shared Hono app during concurrent work. The future RPC/database/type activation is a backend dependency, not an implicit deployment of this increment.

Primary-checkout evidence: `salida/juan-offers-connected-20261017/` contains the exact coordinator backup, protected-file hashes, current source manifest/diff, source staging, executable test and SSR/native harnesses, results, SQL/pgTAP review candidates and friction notes.

No branch switch, commit, push, PR, merge, dependency install, port/server replacement, seed, credential change, remote migration or deployment was performed. Requests, Sites, Fleet, Orders, Pipeline, maps, Three.js, login and Client backend implementations remain unchanged.
