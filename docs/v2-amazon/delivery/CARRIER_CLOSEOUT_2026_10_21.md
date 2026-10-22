# Carrier closeout: native automation, Nova briefing and complete records

## Authorized scope

User approved implementing the Carrier/Nova audit, then requested a business dashboard (money, orders and trends). The user explicitly owns visual review: no further front review or screenshot gate. Base `aaeeef3` (PR145) in a detached local checkout; existing shared work remains untouched. No Linear changes, hosted data changes, DDL, seeds, commercial commands, main push or production deploy.

## Implemented

- Commercial now has an ADMIN Automation destination `/carriers/offers/automation`, mounting the existing native quote-policy editor. Existing version/idempotency/consent/role checks remain in place.
- Active opportunity records mount Nova, with explicit microphone activation, transcript and optional typed input. Typed input requires the gateway capability introduced in PR145; failure does not issue an offer.
- Carrier voice grant reads the opportunity, matching offers, operator role and policy configuration from native authorized services. It carries quantities, per-unit weight, indivisibility, customer windows, privacy-safe carrying allocations, current offers and policy summaries. Missing/stale facts remain unknown. ADMIN alone can receive a cost snapshot matching the exact offer and its price. No private Carrier costs are added to Client grants.
- Gateway prompt consumes the native briefing and does not claim absent rates when recorded offers exist. Commercial writes still require native web review/consent. Deploying this Python prompt remains Axel's AWS responsibility.
- Orders/Offers detail frames hide directory tabs/banners, add record titles and breadcrumbs, collapse technical values and retain actions appropriate to the current state. Offer preparation is a full page rather than a form below the record. Completed booking deadlines are not displayed as pending work.
- Resource rows emphasize asset codes, capacity, window and state. Raw calendar/assignment IDs and evidence remain under technical details. Order → Fleet navigation carries authorized Carrier/service and the execution reference. Service selection remains checked against the scoped loaded catalog; no operational assignment is created automatically.
- Dashboard now uses the authenticated commercial read. No local example journey or ETA is used. It shows contracted amount, pending work, confirmation queue and estimated margin (ADMIN, complete matching cost snapshots only), with daily 7/30-day booking amounts and previous-period change.
- Direct demo entry on the hosted-data local preview uses the existing fixed synthetic identity and actual Client/Carrier membership checks. A separate development-only opt-in accepts the exact loopback 8090 origin and an HTTPS Supabase project endpoint. Default local-only 8080 and assigned production policies remain unchanged. No credentials are sent by the browser or added to this cut.

## Financial semantics

Contracted amount means currently confirmed, still-authorized bookings, grouped by persisted confirmation instant in PET. Quotes, pending authorizations and cancelled/revoked bookings do not count. Expired quote validity does not erase an existing confirmed contract. Repeated references to one offer are not counted twice. Different currencies are not summed together.

The graph reflects current contracts grouped by confirmation date; it is not a payment/refund ledger. Estimated margin is the matched native total minus operating costs and tax. Missing/mismatched costs or incomplete relationships yield unknown margin, not zero profit. Dashboard reads at most twelve private cost snapshots; larger histories require an aggregate endpoint and show margin as unknown. No claims of cash collected or realized profit.

## Verification and boundaries

- 50 focused TypeScript tests passed: briefing identity/isolation/freshness/cost privacy, financial semantics, navigation, existing offers/bookings/resource relationships and scoped Fleet entry.
- Seven Python guidance/transport-limit tests passed. The response-finish test was not runnable in the host Python because boto3 is absent; that transport code was not changed.
- 33 focused authentication/switching tests passed, including explicit hosted-local opt-in, hostile origins, fixed credentials, native role checks, real-account protection and busy/unsaved-work switching guards.
- Native local preview with hosted Supabase: automatic Client entry 200, Client context 200, automatic Carrier entry 200, quote-policy read 200 (two records), voice grant 200, role Carrier, `preview=false`. Briefing contains 12,000 kg, two indivisible 6,000 kg crates, two carrying equipment entries and related COST_PLUS policy configuration. Zero commercial commands/audio/text sent. Verification uses the demo workspace-session endpoint; no manual password submission or persisted session files.
- Typecheck passed; architecture passed (699 modules, 205 client entry points). No new UI review after the user's instruction. Initial local login encountered an expired browser refresh token; a fresh native login succeeded without relaxing authorization. That diagnostic preceded the direct-entry addition.
- AWS audio acceptance, new gateway deployment and production publication are not claimed. The hosted gateway observed before implementation did not advertise text input.

## Human continuation

Local preview: `http://127.0.0.1:8090/clients` or `http://127.0.0.1:8090/carriers`. The fixed synthetic account starts automatically using native authentication; no new users/permissions were created. Existing unrelated real identities are not silently replaced. Review Dashboard, Automation, an opportunity/Nova, an offer/preparation and a confirmed Order. Do not start transportation for the existing C01 fixture.

Publication requires the authorized integration/deployment flow. AWS needs the updated accepted gateway sources, including this prompt and PR145 text support; preserve the existing origin, secret, IAM and endpoint. Ramón retains Plan3 catalog/case work.
