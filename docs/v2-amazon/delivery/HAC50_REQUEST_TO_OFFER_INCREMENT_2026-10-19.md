# HAC-50 — Carrier opportunity to persistent preparation and issued offer

Date: 2026-10-19. Status: implemented development increment; joint functional validation deferred to 2026-10-21 by the user's closure plan.

## What changed

The existing Juan Offers screen and native issuance workflow remain in place. Requests links to Offers with the authorized opportunity ID. The preparation now records the evaluated request revision, displays the request reference/revision, and retains price, breakdown, proposed dates, validity, conditions and evidence using the existing editor. Issuance still requires explicit review and confirmation by an allowed Carrier operator.

The separate preparation RPC is implemented from the earlier HAC-50 review candidate as a CLI-created additive migration:

`20261019202113_hac50_offer_preparations_request_version.sql`

It stores owner-scoped preparations, revisions and retry receipts in private tables with RLS, indexes, guarded native identity/role checks, expected versions and server-computed SHA-256 fingerprints. It does not use offers.create as a draft-save endpoint. Old preparation payloads without requestVersion remain readable; saved values are bound by the server to their opportunity's plan revision. An explicitly mismatched revision is rejected.

A private trigger on native offer insertion correlates organization, request, plan and opportunity, holds the referenced rows while creating the record, and rejects a closed/revised request or an ineligible plan. It persists requestVersion and requestCode in the stored offer data. Later status changes cannot rewrite those fields. The shared Client workflow functions, commercial schemas, routes, assignment/issuer guards and atomic replacement implementation were not replaced.

The UI checks the request brief before preparation/issuance and checks the revision returned by native issuance. Offers detail displays the stored request revision and the recorded plan evaluation. Unknown evaluation/pending requirements remain visible; a link opens the existing Fleet/Scheduling screen. This does not perform a new live assessment, confirm coverage, assign a driver or reserve equipment. Offer acceptance and booking remain separate.

## Local activation and environment limits

Applied only to Docker database `hac50_scenario_fleet80_global_v1`, guarded by `LOCAL_ONLY:v2-carrier-fleet-80`, in one transaction with a PostgREST schema reload notification. No synthetic or real offer, booking, hold or execution was created by this increment. Existing native Client/Carrier scenario and four opportunities are retained.

Hosted Supabase, Vercel, environment variables, AWS and production configuration were not changed. Deployment of this code needs both migrations in order: request projection `20261019190034`, then preparation/request version `20261019202113`. The manifest records that dependency. Provision hosted identities/schema only with the correct project's authorized owner; local identities are not portable.

## Evidence and deferred validation

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit 0.
- Local DDL transaction: committed; zero business writes.
- No new functional, integration, browser, pgTAP, regression or full build runs. Compilation success is not a certification of saving/reloading or actual issuance.
- Joint validation on October 21: save/reload and revision conflict, role/tenant denial, retry replay/hash conflict, stale request at issuance, offer issuance visible to Client, withdrawal/replacement and concurrency. Include a positive control and retain limits for unknown plans.

Local artifacts are under the integrator's `salida/client-carrier-connection-20261019/`: `offer-connection-files.json`, `offer-preparation-activation.json`, the activation script and exact pre-edit backup folder `before-offer-connection/`. No secrets are included in this delivery.

## Consumer handoff

Luis can consume the existing Client request-offers workflow endpoint; the offer retains its native IDs, request/plan/opportunity links and commercial fields. New requestVersion/requestCode are additive stored audit fields. No second offer store or Client implementation was introduced.

Use Requests → opportunity → Prepare offer, or `/carriers/offers/prepare/{opportunityId}` in the connected local scenario. Saving a preparation and issuing an offer remain separate actions. Existing commercial dates and evidence must be entered explicitly; no prices, timestamps or availability were fabricated.

Next increment: selected offer → booking → capacity commitments and operational assignments → shared execution state, coordinated with Luis. Automated discovery, live reassessment from this screen, predictive pricing, mixed cargo lines and hosted activation are not delivered by this change.
