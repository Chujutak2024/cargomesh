# HAC-52 hosted rollout plan — prepared, not executed

Target: **cargomesh-v2**, project reference **yhimeajpzicjbxpbzsyh**.
Owner: Jean Paul. Execution/review owner: Cristhian, with explicit authorization
for the final hosted package. PR: [#132](https://github.com/Chujutak2024/cargomesh/pull/132).

This is an offline plan based exclusively on repository records. This task did
not connect to the hosted database, Auth, Management API or Supabase connector.
No hosted migration, seed, account, permission or configuration was changed.

## Documented baseline and uncertainty

The latest successful hosted migration inventory documented in this checkout is
**27/27**, through `20261009190000_hac40_uml_read_projection.sql`, at product
commit `29c385fe0ee501eb4b8b989b0a247c8fdeda62ad` on October 9:
[deployment record](./uml-bd-api-2026-10-09/DEPLOY_Y_REPRUEBA_29c385f.md).
Its migration manifest is available with
`git show 29c385fe0ee501eb4b8b989b0a247c8fdeda62ad:supabase-v2/migration-manifest.json`.
All 27 entries match the corresponding entries in the current manifest.

`origin/main` at `c7e394db3c0d2d135011ad601df161cf05b61620` contains 32
migrations; this branch adds two, for 34. The five main migrations below have no
successful hosted application record in this checkout. HAC-45's
[handoff](./HAC45_CARRIER_PORTAL_INTEGRATION.md) explicitly requires checking the
hosted history. HAC-50's October 15
[depot activation record](./friction-logs/HAC50_DEPOT_REMOTE_ACTIVATION_2026-10-15.md)
and [commercial activation record](./friction-logs/HAC50_COMMERCIAL_REMOTE_ACTIVATION_2026-10-15.md)
record blocked access and no application. These records do not establish the
live October 20 ledger. The list is the exact **candidate delta against the last
documented baseline**, not a claim that a new remote inspection has occurred.
An authorized operator must reconcile the actual ledger before execution and
skip any already-applied matching migration. Any mismatch stops the rollout.

## Ordered migration package

All paths are under `supabase-v2/supabase/migrations/`. SHA-256 follows the
manifest's encoding: **UTF-8, LF normalized (Git content)**, without a BOM.
Do not hash Windows CRLF bytes as if they were the canonical migration.

| Order | Issue | File | SHA-256 |
| --- | --- | --- | --- |
| 1 | HAC-45 / main | `20261010225539_hac45_carrier_portal_identity.sql` | `aaba859894de50924c51c36e88e1d41a4abbf6f2f9ee8bc78c9fab3ef970b24b` |
| 2 | HAC-50 / main | `20261015055541_hac50_depot_operations.sql` | `b0906a271ae199c415e60567843ac1ebfbb99846bd658ef9cf32a5ee26272db1` |
| 3 | HAC-50 / main | `20261015122904_hac50_booking_offer_projection.sql` | `7030c479f7fc4fe687b33547e1adf186794c54bd6767515930dc16526d4eaa8a` |
| 4 | HAC-50 / main | `20261016165018_hac50_border_operations.sql` | `02262b8c192a18e8fc8455f93ae53fbad1c1cd153f43116485f4e1c73023cbe5` |
| 5 | HAC-50 / main | `20261019030218_hac50_regular_vehicle_drivers.sql` | `ebf0d0f52649adfaa8566f640662363be54bbccd5ca3c2fab1d6d1c4bd2912c2` |
| 6 | HAC-52 / PR #132 | `20261020000100_hac52_facility_civil_hours.sql` | `4dd85f6d3b993877ad88ddeff46cb583e3b6c3068a783b35bb6bcda6f2e2f9b8` |
| 7 | HAC-52 / PR #132 | `20261020000200_hac52_client_action_confirmations.sql` | `be921a2e221047b55062651ed4535420f4c6dbf31f2eaeb78a0af45e6e5aec77` |

Manifest dependencies, in the same order: `20261009190000`, `20261010225539`,
`20261015055541`, `20261015055541`, `20261010225539`, `20261019030218`,
`20261020000100`. Apply the complete selected chain in timestamp order even
where two entries share a dependency. Do not edit or replay an applied migration,
invent ledger rows, or perform a bulk `db push`.

The first five entries also contain Carrier work owned by HAC-45/HAC-50; their
owners must review their hosted activation. This plan neither changes that work
nor authorizes its deployment. The HAC-52 migrations contain schema/functions
only: IANA civil-hour validation and private, authorized confirmation receipts
with prepare/confirm RPCs. They contain no demo data or Auth credentials.

## Base data and Client accounts

Source data: [v2-client-base manifest](../../../supabase/scenarios/v2-client-base/manifest.json)
and [local seed](../../../supabase/scenarios/v2-client-base/seed.sql).

| Artifact | Canonical SHA-256 |
| --- | --- |
| `supabase/scenarios/v2-client-base/manifest.json` | `59ab9cead59335bbc8a2ff598ed8f06343a1df71165c9224dda47c76448bbd0f` |
| `supabase/scenarios/v2-client-base/seed.sql` | `51de4900c9ccc1efbb2d2d645d9e105bde5d9c58ff7106c3cd38d98f32ba85e2` |

The base contains exactly 3 organizations, 8 Facilities, 3 cargo profiles and 3
preferences. It creates no Auth users or memberships. IDs are deterministic:

| Entity | Exact IDs (each prefix is a UUID prefix, followed by the listed 12-digit suffix) |
| --- | --- |
| Organizations | `52000000-0000-4000-8000-` + `000000000001`, `000000000002`, `000000000003` (PE, BO, CL) |
| Facilities | `52010000-0000-4000-8000-` + `000000000001` through `000000000008` (PE: 1–3, BO: 4–6, CL: 7–8) |
| Cargo profiles | `52040000-0000-4000-8000-` + `000000000001`, `000000000002`, `000000000003` |
| Preferences | `52050000-0000-4000-8000-` + `000000000001`, `000000000002`, `000000000003` |
| Planned Client memberships | `52020000-0000-4000-8000-` + `000000000001`, `000000000002`, `000000000003` |

The seed is **local-only**: it requires `psql -v local_only=1` and database marker
`LOCAL_ONLY:HAC52_CLIENT_BASE`. Never set that marker on hosted, remove its guard,
or run this local seed/provisioner there. A hosted data package is still required:
an operator-reviewed, separately authorized transaction derived from the listed
organization/Facility/profile/preference rows, retaining the fixed IDs, explicit
clock `2026-10-19T12:00:00Z`, null unknown hours and `allow_auto_booking=false`.
The source preference validity is `2026-11-02T12:00:00Z`; review that explicit
expiry against the actual deployment date. Do not silently replace it with now.
Record the final package's own SHA-256 before execution; it is not prepared or
executed by this documentation-only hosted step.

Before an insert, compare every target ID and unique code with the approved row.
A conflicting existing owner or value stops execution. Preserve legitimate
manual revisions on reruns; `ON CONFLICT DO NOTHING` alone is not proof that
existing data has the intended owner/value. Verify the existing active `GENERAL`
cargo category and its GUID; reference it rather than duplicating the catalog.
Reuse the existing Carrier catalog. Do not load `v2-road-baseline`, Carrier fleet
fixtures, V1/ACME/FR-1042, or Luis's commercial requests as part of this base.

For each of the three approved synthetic Client identities, an authorized
administrator must create or identify the hosted Auth user through the supported
Auth administration flow. The local Auth UUIDs and local access file are not a
hosted account inventory and must not be copied. If password login is needed for
non-deliverable synthetic addresses, generate credentials in the administrator's
secure tooling, keep them only in a private vault/file outside Git, and never
place them in SQL, command arguments, CI, terminal output, reports or application
logs. Do not export password hashes, sessions or service keys. Existing accounts
must not be reset implicitly. No browser receives a service-role credential.

Map the **actual returned Auth UUID** to the corresponding planned membership
ID and organization ID. Create an `OWNER`, `ACTIVE` membership with the approved
display name and corporate email in a narrowly reviewed transaction. A rerun
must check the same Auth/organization binding and refuse a mismatch. Authorization
comes from `organization_members`, verified `auth.getUser()` and RLS, never user
metadata. Carrier identity does not create Client membership. Keep credentials
and Auth administration out of the public manifest.

## Preflight, backup and release order (future operator actions)

1. Pin the approved application/SQL SHA and verify project name/reference in the
   authorized deployment context. Reconcile migration versions, available SQL
   definitions and hashes with the documented 27-entry baseline and this delta;
   inspect drift, duplicate versions, function/table name conflicts and grants.
   Unknown or different history requires investigation, not a forced repair.
2. Audit the incoming foreign keys and their `ON DELETE` actions for every table
   touched by migrations/base provisioning. Inventory existing non-null Facility
   schedules using the proposed `private.hac52_valid_facility_hours` implementation
   in the local rehearsal (the helper may not exist hosted yet), including IANA names,
   overlap rules and the allowed closing `24:00`. Resolve incompatible values
   through their owner before rollout; do not rewrite unrelated business rows.
3. Confirm an approved platform recovery point/PITR backup. Prepare a sanitized
   schema/function/ACL/RLS snapshot and narrow business-data backups for affected
   IDs/tables, plus preflight counts and hashes. Store them in access-controlled
   operator storage outside Git and CI. Exclude Auth credentials, tokens, keys
   and sessions. A separate protected mapping of new Auth IDs is sufficient for
   this package; do not create an Auth credential dump.
4. Restore the proposed backup in a fresh, operator-owned local bank and verify
   schema, ACL/RLS, row counts and hashes before scheduling deployment. Rehearse
   the seven-migration chain, the separately reviewed hosted data transaction
   and account mapping locally. Run the actual V1/V2 gate and HAC-52 pgTAP there.
   Local tests do not establish hosted health or authorize execution.
5. With explicit authorization, apply only the reconciled missing migrations in
   order, checking each result/ledger before continuing. Apply the approved base
   and membership package after schema readiness. Deploy the reviewed Client
   application against the existing target, with ordinary connected Auth/RLS.
   Do not enable the `hac52-client` local profile or publish private access files;
   keep production branch, root directory and aliases under deployment ownership.

## Postflight acceptance (future, not claimed PASS)

- Confirm the exact expected migration ledger (34 entries if the documented
  baseline plus all seven candidates was the real starting state), canonical
  definitions, RLS enabled on private confirmation receipts, no direct receipt
  access for `authenticated`, and no anonymous execution of Client action RPCs.
- Count the approved IDs: 3/3 organizations, 8/8 Facilities, 3/3 profiles,
  3/3 preferences and 3/3 active memberships correctly bound to verified Auth
  users. Rehearse a rerun and compare counts/IDs/values without duplicating rows.
- Log in separately as PE, BO and CL using secure credential entry. Each must
  read its organization and exactly its active base Facilities (3, 3 and 2).
  Pair each foreign read/write denial with a successful own-organization control
  under `authenticated` and actual JWT claims. Include an approved Carrier-only
  identity with positive Carrier access and denied Client access.
- Through connected HTTP/UI, create/revise/reload an explicitly approved
  synthetic Facility, cargo profile and preference. Verify identical retries,
  `409` on stale versions/conflicting payloads, prepare without business mutation,
  confirm once with a stable replay, and foreign confirmation rejection. Test
  owner/supervisor/requester restrictions with positive controls for each actor.
- Verify IANA/civil hours, unknown hours, invalid coordinates, legitimate empty
  results and network failure presentation. Use the reviewed local tests for
  destructive/error fixtures; never run the complete pgTAP/scenario/race suite
  against hosted data. Record real command/HTTP outcomes, SHA and timestamp;
  redact all credentials. A failed positive control means BLOCKED, not PASS.
- Keep assistant confirmation wiring (Juan/HAC-53) and commercial requests
  (Luis/HAC-54) as separately owned integration checks. This package does not
  claim those consumers are implemented or commercially certified.

## Rollback and stop conditions

Stop further steps on ledger/hash drift, incompatible schedules, failed
migrations, failed authorization/positive controls, unexpected row counts or
unverified recovery. Preserve sanitized evidence and identify the last successful
step. Roll back the application to the operator-recorded previous deployment
while keeping the additive schema where compatible; do not assume application
rollback reverses data or migration history.

Use a new reviewed forward-fix migration for database defects. Do not edit an
applied SQL file, delete ledger rows, blindly drop new objects, or run a whole
database restore over shared live data. If restoration is required, the operator
must use the prevalidated recovery plan and explicitly account for writes made
after the backup; rehearse in an isolated local restoration first.

Any cleanup of newly provisioned synthetic data/accounts requires a separate
approved list of exact created IDs, backup, incoming-FK/cascade audit and counts
before/after. Retain rows already used by other consumers; do not delete by name,
prefix, broad predicate or `CASCADE`. Disable/revoke only the approved newly
created Auth identities through supported administration when required. Do not
reset or alter unrelated accounts, the existing local PE/BO/CL bank, or another
local bank as a rollback shortcut.
