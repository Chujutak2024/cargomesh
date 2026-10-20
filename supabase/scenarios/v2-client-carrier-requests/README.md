# Local Client to Carrier request scenario

HAC-50; paired with v2-client-carrier-access and the installed fleet80 catalog.
The seed publishes two synthetic Lima nodes, a directed corridor and a route
policy only. It never creates Auth users, freight requests, opportunities or
commercial offers by direct INSERT. The corridor is SIMULATED (7 km / 1800 s),
not a Google geometry or verified truck-access route.

Run only in the marked local database required by seed.sql. It is repeatable
without resetting existing records. Keep private credentials outside Git.
Create requests and their plans/opportunities through native authorized HTTP
commands, using grouped leg assignment IDs. Local examples use the supported
HAC50_SCENARIO_GENERAL category, one box, fixed pickup/delivery windows and C01.
The operational evaluation remains unknown where route/equipment requirements
lack evidence. Do not change that result to eligible to advance the demo.

The integrator's four local cases are pending review, accepted for review,
declined and a candidate for a transaction-rolled-back stale revision exercise.
Those records are historical local evidence, not automatically installed by this
seed and not portable identities for hosted Supabase. Creation of a preparation
does not issue an offer or reserve capacity.

See docs/v2-amazon/delivery/HAC50_CLIENT_CARRIER_REQUEST_PROJECTION_2026-10-19.md
and HAC50_REQUEST_TO_OFFER_INCREMENT_2026-10-19.md for implementation/limits.
Shared functional validation is scheduled for October 21; no later test results
are implied by this README. Cleanup requires reviewing dependencies and scoped
ownership; this seed performs no deletion or hosted activation.
