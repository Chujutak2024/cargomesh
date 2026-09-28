# Clean V2 bootstrap and local QA profiles (HAC-29)

Decision: [HAC-29 CP-1](https://linear.app/hackatonteamcargomesh/issue/HAC-29), 2026-09-27T02:42:16.961Z.
Frozen source cutoff: `e289801f209902ebfe8e54b39c50ce62a16c4b6f` on `feat/cycle-2-integration`.
Implementation branch: `feat/be3-v2-clean-bootstrap`. This delivery stops at local CP-2.

## One migration chain

`supabase-v2/supabase/migrations/` is the only V2 chain. The schema migration preserves
the historical public/private schema, including grants, RLS, constraints, triggers and
compatibility functions, without executing V1 fixture DML. The reference migration adds
exactly eight categories and their four guidance fields. Empty legacy tables and legacy
function definitions are schema-ready compatibility, not live V2 services.

The audited extraction removes only four historical DML sections: baseline demo rows
(category inserts move to reference); golden-flow alignment/reset DML (its trailing DDL
is retained); organization cargo-profile/demo request DML (validation/RLS retained);
category guidance UPDATE (moves to reference). Functions containing DML are retained
as definitions and are not called. Historical migrations and `supabase/seed.sql` stay unchanged.

[`migration-manifest.json`](../../../supabase-v2/migration-manifest.json) records every
source and V2 file with issue, version, SHA-256, dependencies and profile. Hashes use
UTF-8 with LF normalization, matching Git content across Windows/Linux. Each migration
also carries its source hashes and cutoff in its header. The baseline versions are
`20260927042808` and `20260927042811`.

## Local commands

Prerequisites: Docker running, Python 3.11+, Node/npx. Every CLI call is pinned to
`npx --yes supabase@2.117.0` (`npx.cmd` on Windows). Run from the repository root.
Use an evidence directory outside the repository. PowerShell commands:

```powershell
$evidence = Join-Path $env:TEMP 'hac29-local-evidence'
python supabase-v2/gate.py manifest --evidence-dir "$evidence/manifest"
python supabase-v2/gate.py v1 --evidence-dir "$evidence/v1"
python supabase-v2/gate.py v2 --evidence-dir "$evidence/v2"
```

The V1 runner constructs a dedicated replay workdir from the manifested historical files
and reads the original seed in place. It performs a normal reset and runs the V1 suite.
It does not reset an existing developer stack. The V2 runner performs these fail-fast steps:

1. Verify hashes, migration inventory, ordered dependencies and CLI version.
2. Replay V1 in `hac29-v1-reference` (DB port 59322) for positive fixture controls.
3. Start/reset `supabase-v2` (`cargomesh-v2-local`, DB 58322; API 58321, Studio 58323).
4. Assert eight exact category identities with nonempty guidance; assert V1 absence
   paired with positive V1 controls, including Auth identities and demo vehicles.
5. Replay only the frozen V2 baseline/reference pair in `hac29-baseline-reference`
   (DB 60322). Compare public/private schema-only dumps and reference guidance against
   V1. Only comments, blank lines and pg_dump random restrict markers are normalized;
   owners, ACL, RLS, defaults, indexes, constraints and functions remain compared.
6. Explicit scenario seed, verify and the V2 pgTAP profile.
7. External backup, incoming-FK audit, exact-ID cleanup, zero scenario counts and
   eight intact categories. Each write is read back; evidence includes commands/exit codes.

This third, frozen replay makes drift detection valid after HAC-12/HAC-11 add deltas:
it never compares the intentionally evolved live V2 schema with the V1 snapshot.
Only the two frozen baseline versions enter that comparison. The full V2 reset still
applies every manifested delta and runs the V2 suite. Failed checks stop the gate;
blocked downstream work prints in a `finally` block, including on failures.

Individual reset and scenario commands (PowerShell; no global seed):

```powershell
npx --yes supabase@2.117.0 db start --workdir supabase-v2
npx --yes supabase@2.117.0 db reset --local --yes --workdir supabase-v2
Get-Content -Raw supabase/scenarios/v2-road-baseline/seed.sql | docker exec -i supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -v local_only=1 -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/verify.sql | docker exec -i supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
Get-Content -Raw supabase/scenarios/v2-road-baseline/counts.sql | docker exec -i supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
python supabase-v2/gate.py cleanup --evidence-dir "$evidence/cleanup"
```

`cleanup` creates the backup outside Git before passing `local_only=1` and
`backup_confirmed=1` to cleanup.sql. The SQL locks affected relations, audits every
incoming FK (including implicit cascades), refuses children outside its explicit ID
inventory, and checks before/after counts. No delete-by-name/prefix or CASCADE command
is used. Public data is backed up; Auth recovery uses the synthetic seed, without
exporting credential hashes, tokens or keys. After a failed test, preserve evidence
before using this cleanup command. The `local_only` variable is an operator guard,
not a substitute for checking the Docker target.

The runner owns only its three named containers. It leaves them available for inspection;
stop them later with the matching workdir. Never use `stop --all`. The original V1 stack,
its project/ports and its checkout are not modified.

## Replay ports and Windows excluded ranges

Both replay projects support CLI options and equivalent environment variables. CLI
values override environment values. Unset values preserve the original CI configuration
exactly. The port base replaces the old `593`/`603` prefix and retains each two-digit
offset; inspector and analytics can also be set independently.

| Project | CLI option | Environment variable | Default |
|---|---|---|---|
| `hac29-v1-reference` | `--v1-replay-port-base` | `HAC29_V1_REPLAY_PORT_BASE` | `59300` |
| `hac29-v1-reference` | `--v1-replay-inspector-port` | `HAC29_V1_REPLAY_INSPECTOR_PORT` | `8283` |
| `hac29-v1-reference` | `--v1-replay-analytics-port` | `HAC29_V1_REPLAY_ANALYTICS_PORT` | base + 27 (`59327`) |
| `hac29-baseline-reference` | `--baseline-replay-port-base` | `HAC29_BASELINE_REPLAY_PORT_BASE` | `60300` |
| `hac29-baseline-reference` | `--baseline-replay-inspector-port` | `HAC29_BASELINE_REPLAY_INSPECTOR_PORT` | `8383` |
| `hac29-baseline-reference` | `--baseline-replay-analytics-port` | `HAC29_BASELINE_REPLAY_ANALYTICS_PORT` | base + 27 (`60327`) |

The generated configs use base + 20 for the shadow DB, +21 API, +22 DB, +23 Studio,
+24 Inbucket and +29 pooler. Analytics uses base +27 unless explicitly overridden.
Configured ports are checked even when their service is disabled; `db start` publishes
only the DB port. The base must be 1..65506 and every TCP port 1..65535. Duplicate ports
within/between replay projects and collisions with V1's 56320..56329, V2's 58320..58329
or other explicit V1/V2 config ports (including inspector/analytics) fail validation.

Before any Docker start/reset, `gate.py v1` and `gate.py v2` validate **both** replay
layouts and attempt exclusive TCP binds on the host (IPv4 and IPv6 when available).
A failure identifies the port, project, config setting and CLI/environment override.
The successful layout is saved as `replay-ports.json` outside the repository. This is
a point-in-time check; another process can claim a port after the probe closes.

The Tech Lead's FL-03 reports Windows reserved-port conflicts. Exclusions can change
between machines and reboots; inspect them before selecting an alternative range:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
netsh interface ipv6 show excludedportrange protocol=tcp
```

Stop the two existing **replay** projects using their previous evidence workdirs before
rerunning or changing ports. An already running replay occupies its DB port and fails
the preflight; an existing container does not acquire a new binding from a rewritten
config. Do not stop other projects or use `--all`. For a prior V2 run:

```powershell
npx --yes supabase@2.117.0 stop --workdir "$evidence/v2/workdir-v1"
npx --yes supabase@2.117.0 stop --workdir "$evidence/v2/workdir-baseline"
```

Example alternatives for Windows (verify these ports on your host first):

```powershell
python supabase-v2/gate.py v2 --evidence-dir "$evidence/alternate" `
  --v1-replay-port-base 61300 --baseline-replay-port-base 62300 `
  --v1-replay-inspector-port 8483 --baseline-replay-inspector-port 8583 `
  --v1-replay-analytics-port 61327 --baseline-replay-analytics-port 62327
docker port supabase_db_hac29-v1-reference 5432/tcp
docker port supabase_db_hac29-baseline-reference 5432/tcp
npx --yes supabase@2.117.0 stop --workdir "$evidence/alternate/workdir-v1"
npx --yes supabase@2.117.0 stop --workdir "$evidence/alternate/workdir-baseline"
```

The same configuration can be supplied through environment variables, for example:

```powershell
$env:HAC29_V1_REPLAY_PORT_BASE = '61300'
$env:HAC29_BASELINE_REPLAY_PORT_BASE = '62300'
$env:HAC29_V1_REPLAY_INSPECTOR_PORT = '8483'
$env:HAC29_BASELINE_REPLAY_INSPECTOR_PORT = '8583'
$env:HAC29_V1_REPLAY_ANALYTICS_PORT = '61327'
$env:HAC29_BASELINE_REPLAY_ANALYTICS_PORT = '62327'
python supabase-v2/gate.py v1 --evidence-dir "$evidence/alternate-v1"
```

Unset these six variables to restore defaults. A fresh run requires the previous
replay containers to be stopped; the gate leaves them available for inspection.

### Main V2 profile ports

These options affect only the two replays. The runner still resets the versioned
`supabase-v2/supabase/config.toml` directly at 5832x. CLI 2.117.0 `db start --help`
has no port override flag. Providing an unversioned V2 config would require a separate
workdir and plumbing that path through reset/test commands; it is outside this review
change. No V2 port override was added and the versioned config remains unchanged.
The [Supabase configuration reference](https://supabase.com/docs/guides/local-development/cli/config)
documents config changes and restarting the affected project. Do not change or stop
the existing V2 stack as a side effect of changing replay ports.

## Migration source inventory

| Historical migration | Extraction type |
|---|---|
| `20260828200000_baseline_legacy_schema.sql` | mixed: schema + reference + V1 demo |
| `20260828233233_add_cargomesh_identity_and_intent_contract.sql` | schema |
| `20260828233302_add_cargomesh_observability_and_booking_events.sql` | schema |
| `20260828233343_add_cargomesh_runtime_contract.sql` | schema |
| `20260828233435_add_cargomesh_domain_constraints.sql` | schema |
| `20260828233524_add_carrier_offers_carrier_fk_index.sql` | schema |
| `20260829003215_align_golden_flow_and_reset_runtime.sql` | mixed: schema + V1 demo alignment |
| `20260829003327_secure_cargomesh_data_api_with_rls.sql` | schema |
| `20260829005625_add_organization_cargo_profiles_and_unitized_intake.sql` | mixed: schema + V1 demo cargo profile |
| `20260829010551_add_freight_request_org_cargo_profile_fk_index.sql` | schema |
| `20260829011002_add_cargo_category_intake_guidance.sql` | mixed: schema + reference guidance |
| `20260830040348_c02_result_bridge_idempotency.sql` | schema |
| `20260830182517_int02a_generalize_result_bridge.sql` | schema |
| `20260830210000_int02a_orchestration_run_api.sql` | schema |
| `20260831062736_c03_booking_bridge.sql` | schema |
| `20260901045832_c_release_service_role_base_grants.sql` | schema |
| `20260902065645_c_d1_recommendation_draft_writer.sql` | schema |
| `20260902170000_c_manual_intake_writer.sql` | schema |
| `20260902213000_c_restrict_freight_request_writes.sql` | schema |
| `20260918120000_c_draft_creation_idempotency.sql` | schema |
| `20260922053512_v2_road_facilities_services.sql` | schema |

## Test profiles

[`test-profiles.json`](../../../supabase-v2/test-profiles.json) passes explicit existing paths to
`supabase test db --local --workdir ...`. Shared files are not copied. The original 09
remains a V1 regression; the clean 09 preserves its ROAD/RLS assertions and adds paired
controls using synthetic tenant data and a transaction-local draft request. Test 11
checks declared coverage, Piura, direction and nominal metadata only. All RLS
checks run as `authenticated` with synthetic subject claims, not as the owner.

| Test file | Profile |
|---|---|
| `01_cargomesh_rls_and_golden_flow.test.sql` | V1 |
| `02_c02_result_bridge_and_decision.test.sql` | V1 |
| `03_int02a_result_bridge.test.sql` | V1 |
| `04_int02a_orchestration_run.test.sql` | V1 |
| `05_c03_booking_bridge.test.sql` | V1 |
| `06_release_service_role_grants.test.sql` | V1, V2 |
| `07_d1_recommendation_draft_writer.test.sql` | V1 |
| `08_draft_creation_idempotency.test.sql` | V1 |
| `09_v2_clean_road_network.test.sql` | V2 |
| `09_v2_road_network.test.sql` | V1 |
| `10_v2_qa_negative_cases.test.sql` | V2 |
| `11_v2_scenario_data.test.sql` | V2 |

GitHub Actions retains the original PR triggers and application job. The V1 historical
job and V2 clean job have independent results. Both invoke the same Python runner used
locally with npx CLI 2.117.0. There is no continue-on-error or test-count acceptance gate.
`pnpm typecheck` and `pnpm test:release` run in `cargomesh/`. `test:mcp:local` remains a
known V1 regression and is not relabeled as passing. Running component commands locally
does not establish that the GitHub-hosted workflow executed.

## Adding HAC-12 / HAC-11 deltas

1. Coordinate the timestamp/version and owner with the Tech Lead; use a timestamp
   strictly after `20260927042811` and any dependency version.
2. Create a new migration using `npx --yes supabase@2.117.0 migration new <name> --workdir supabase-v2`.
3. Place only structural/production logic there; synthetic rows belong in scenarios.
   Do not copy the delta to `supabase/migrations/` or alter either applied baseline file.
4. Append its issue, relative path, version, LF SHA-256, dependencies and `v2-clean`
   profile to the manifest. Add explicit tests to the appropriate profile.
5. Re-run the clean gate. A delta does not enter the frozen drift comparison. Expanding
   the frozen historical cutoff is a separate reviewed bootstrap change.
6. HAC-12 reuses `creation_idempotency_key`, `creation_payload_hash` and `draft_version`.
   A single SQL statement is atomic for one write; compound writes need one transaction
   or RPC boundary. No duplicate `idempotency_keys` table or prescribed RPC name.

## Current blocked work and owners

- HAC-12 / Cristhian: native POST/GET writer, capacity assets/pools/calendars/reservations,
  verified positive capacity control, actual eligible/unknown/zero API evaluations,
  canonical facility HTTP 403, QA-13-21/22/23. Test real intermediate-write rollback
  locally with a temporary trigger/constraint once the writer exists; early FK rejection
  is a separate test and does not certify atomic rollback. No production fault switch.
- HAC-11 / Axel: persisted MCP identity, rotation/scopes/revocation and Web/MCP parity.
- HAC-14 / Luis and HAC-15 / Juan: intake/mapper/map smoke using the shared
  [fixture package](../../../supabase/scenarios/v2-road-baseline/fixtures/id-map.json).
- HAC-28 / Jean Paul: runtime V1 removal after the shared services are integrated.

## Hosted preflight: read-only checklist, not deployment authorization

Target identity: `cargomesh-v2`, reference `yhimeajpzicjbxpbzsyh`. No remote checks are
executed by these scripts. A reviewer must record read-only evidence for:

- Confirm project reference, environment and Postgres version without exposing credentials.
- Read migration history and compare it with the frozen baseline/delta manifest; stop on
  any divergence. Do not assume the hosted project is empty.
- Inspect public/private schema, grants, RLS, FKs, triggers, receipts and draft version.
- Count eight reference categories and inspect guidance; count V1 fixture IDs and V2
  business rows; record unexpected data without deleting it.
- Record owners, access scope, expected deltas and a separately approved rollout/rollback
  plan before any future deployment decision by the Tech Lead.

No hosted migration, write SQL, branch, pause, link, repair or db push is authorized here.
