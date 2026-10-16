# HAC-50 — Commercial projection activation

Date: 2026-10-15. Issue: HAC-50. Status: waiting for the correct hosted connection; local implementation and tests pass.

## Observation

The configured frontend uses Supabase project `yhimeajpzicjbxpbzsyh`. The connected plugin lists `tokvzfrefwqobzqgbfoj` and `xdkdxqevtksazldbxesw`; a project lookup for the frontend target is denied. The user explicitly authorized the commercial migration and reconnection, but authorization in chat does not grant the current connector access to that project.

## Effect

Four persisted bookings lack their selected `offerId` in the read projection. Opportunity public IDs are grouped legs, while historical snapshot IDs refer to resource bindings. Orders must retain the bookings without inventing quote/route links. Full-opportunity quotes use all recorded snapshot services; partial quotes require factual grouped-leg references.

## Implemented remedy

Additive migration `20261015122904_hac50_booking_offer_projection.sql`, tested only in isolated local PostgreSQL. It exposes actual booking foreign keys and snapshot `legAssignmentId`, preserves the composed reader and grants, and inserts no synthetic rows. 54 pgTAP assertions pass, with rollback. Node scope/context/read tests and 15 HTTP checks pass.

## Activation

Reconnect Supabase with an account that can access the configured project; inspect the installed reader/migrations before applying the authorized migration. Do not change frontend environment to another project, use a bulk migration push, expand permissions, or execute fixture tests on hosted data. The earlier depot migration is a separate pending activation.

## Additional validation limit

The browser policy rejected observing the existing localhost tab this turn. No alternate browser/control mechanism was used. Authenticated HTTP confirms workspace compilation and navigation delivery, but final visual/mobile review and a real Client browser session remain unverified.
