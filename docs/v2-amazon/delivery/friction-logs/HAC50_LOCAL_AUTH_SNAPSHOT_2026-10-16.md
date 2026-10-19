# HAC-50 friction — Local Auth snapshot compatibility

16 October 2026. Local scenario bank only: `hac50_scenario_fleet80_global_v1`.

The schema-only QA source had no Auth migration-history rows and differed from the working local Auth schema in two places: the primary key on `auth.identities.id` and the comment on `auth.flow_state`. Starting the matching Auth image without a complete snapshot attempted an old OAuth migration and failed. No accounts were created during that failure.

The optional demo-access helper now compares complete Auth DDL against the genuine local Auth database. It recognizes only those two copy differences, restores them with the local schema administrator, requires exact DDL equality and then copies genuine system migration versions. Other drift stops the helper. It does not invent applied versions or change a V2 migration, production function, RLS policy or hosted database.

A separate Auth container bound to `127.0.0.1:59731` then started. Three real password logins, authenticated user lookups and five Carrier memberships passed. Catalog edits were denied for DISPATCHER and OPERATOR. Test sessions were logged out. The current app's Auth container and environment were not changed.

Secrets reside under the user's temporary directory, outside the repositories. Safe results are in its `RESULTS.json`; scenario regression evidence is in `salida/carrier-scenario-20261016/global-verification/`. Frontend wiring to the scenario/Auth pair remains separate.
