# Backend/environment gaps — no backend change performed

## 1. Booking selected-offer projection is absent from current HTTP responses

Evidence: `NATIVE_RESULTS.json`, 2026-10-18 UTC, reports all four loaded bookings with `hasOfferReference: false`, despite four readable offers. This is an observed response incompatibility; deployment/migration history was not queried, so the exact remote deployment state is not asserted.

The original generic booking projection returns stored JSON without injecting the relational `v2_bookings.offer_id`. The checkout already contains an additive fix at:

`supabase-v2/supabase/migrations/20261015122904_hac50_booking_offer_projection.sql`

Its booking branch adds authoritative `offerId`/`decisionId`; its opportunity branch adds grouped-leg references. Do not edit historical migrations or guess a booking's offer from request/city/price. The authorized backend owner should reconcile this existing migration with the environment's migration history and verify the response through the Carrier API. Applying it was outside this task and was not done.

Required verification after environment alignment: same Carrier/organization/request offer correlation, grouped assignment/resource references, price/version, scopes rejected across organizations/carriers, current calendars and capacity evidence. An offer reference alone does not prove capacity. Any absent binding/resource/quantity/window or expired/unverified evidence keeps the UI capacity state unknown/unverified.

## 2. No Carrier-authorized operation or hold creation endpoints

`src/server/hono/routes/carrier-workflow.ts` registers GET collection/detail routes for executions and capacity holds and POST transition routes, but no create actions for these two collections. The Carrier workflow command allowlist in `20261008235540_hac41_carrier_workflow.sql` also excludes these creates. Shared workflow input schemas and Customer APIs do not grant Carrier authorization.

Minimal separate extension for backend review:

1. Define the explicitly authorized Carrier roles and create commands. Candidate public routes follow the existing collections: POST `/api/v2/carriers/{carrierId}/executions` and `/capacity/holds`. Do not grant creation by merely exposing generic form schemas.
2. Extend Carrier HTTP/service/SQL authorization together. Resolve membership from the authenticated actor; scope booking, Customer organization/request, selected offer, service, grouped leg, plan resource and calendar to the same persisted plan. Do not accept arbitrary client-selected scope or use service-role credentials in the frontend.
3. Revalidate current Customer authorization, Carrier confirmation where required, time windows, TTL, capacity, grouped reservations and any consolidation/resource rules. Keep crew/vehicle assignment management in Fleet.
4. Execute each command transactionally with the existing canonical payload hash/idempotency receipt, required expected versions and audited actor/reason/evidence. Return canonical records and stable stale/conflict failures.
5. Add proportional service/route/SQL tests for ADMIN/OPERATOR/DISPATCHER policy, foreign Carrier/organization/service/resource references, repeated receipt and changed-payload rejection, stale versions, capacity/window/expiry conflicts and rollback. Validate writes only in an isolated traceable synthetic scenario.

Until approved, implemented and deployed, both creation controls remain disabled. Creating Customer bookings is deliberately not an Orders capability.

## 3. Browser and persistent mutation evidence

Local browser use is disabled in Work settings. No visual/click/focus/responsive validation was possible. Real business records were not changed to produce positive mutation evidence. Command responses, retry/conflict handling and refresh behavior were tested with controlled responses; actual SQL idempotency and current-environment write permissions remain unverified by this delivery.
