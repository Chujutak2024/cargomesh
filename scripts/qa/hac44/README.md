# HAC-44 reproducible local QA

## Windows CLI transport

The PKCE status reader preserves the complete JSON argv. On Windows, `npx.cmd`
is resolved through its installed npm `npx-cli.js` and launched by Node with
`shell:false`; no bank path or argument is interpreted as shell text. A missing
entrypoint aborts without trying a shell. CLI output (including local keys) stays
in memory and is omitted from failures. Tests cover the installed Windows launcher
with `--version` (no download) and a disposable npm layout with spaces, exact argv,
PATH lookup and missing-entrypoint rejection. These transport tests do not certify
OAuth or hosted database access.

This directory owns the QA harness beside existing repository scripts, keeping synthetic data outside migrations and leaving product services, profiles and CI unchanged. Documentation and scenario sources are committed; logs, catalogs, CSVs, UUID registries, backups and replay workdirs live in an external evidence directory.

## Setup and complete run

For the F-02 CP-1 checkpoint, set `HAC44_CYCLES=1` before `run.py all`.
The default remains two clean cycles for explicitly authorized repeatability work.
`f02_descriptors.json` retains the approved 189-row cohort, nine documentary
antecedents and 144 individual UML method descriptors. Historical metadata selects
contracts; historical outcomes never supply a current verdict. `f02.py` executes
the incorporated probes through the unchanged native commands and Hono router.
`f02_matrix.py` derives row states, method states and the comparison table from
fresh per-case evidence. A missing exact observable or failed positive remains
explicitly blocked. Capacity and scenario projections do not add product CRUD.
For the authorized CP-1b diagnostic checkpoint, also set `HAC44_CP1B=1`.
The original FK baseline failure remains FAIL. Independent strict FK diagnostics,
F-02 probes, matrix generation and cleanup still execute in that one cycle; none
of them can promote the failed integral gate. `f02_source_audit.py` records exact
method searches and both UML association ends. Verified exported native rules
are called by `f02_native.mts`; remaining semantic mappings and isolated fixtures
stay QA-owned per signature, rather than being reported as product defects.
The seven scenario fields are candidate documentary mismatches in the actual
manifest root and SQL loader, never successful CRUD measurements.
Verbatim historical metadata is retained with its input hashes; its Spanish
retest notes are source quotations, not current execution results.
`auth_cleanup.py` backs up nonsecret physical Auth keys, audits every incoming
FK including CASCADE, and removes child rows by exact keys before native user
cleanup. No secret session/token column is exported.

SQL scenario claims are issued and verified by the owned local Auth server in
memory. Every role reset follows `SET CONSTRAINTS ALL IMMEDIATE`; rollback
measurements preserve full table counts before and after. HTTP fixture bearers
also come from actual Auth sessions. No JWT, credential or claim payload is
written to evidence files.

Python 3.11+, Docker, Supabase CLI 2.117.0, the project Node engine and lockfile-matching Node dependencies are required. Dependency provisioning is external to this harness; it never changes SSL validation or installs implicitly. `provenance.py` checks all direct dependency versions against `pnpm-lock.yaml`. The pnpm 11 environment setting prevents its implicit install before scripts; it does not waive dependency verification or any suite.

```powershell
$env:HAC44_EVIDENCE = Join-Path $env:TEMP 'hac44-evidence'
$env:HAC44_CLI = (Get-Command supabase).Source
$env:HAC44_PROJECT_PREFIX = 'hac44-my-new-run'
$env:HAC44_PORT_BASE = '64000'
python scripts/qa/hac44/run.py all
```

Use a fresh external directory for each source SHA. `HAC44_ROOT` may identify the selected checkout when these QA scripts are run from another directory; `HAC44_SOURCE_SHA` accepts the selected full commit hash (default: HEAD). The checkout's product/model/migration inputs must match that SHA. The selected revision must contain the V2 UML/model, dictionary, manifest and native profile inputs expected by this model version. There are no machine-specific absolute paths in committed scripts. Output paths are derived from the environment.

Both layout settings are required; there is no fixed project or port fallback. Projects derive from `HAC44_PROJECT_PREFIX` with `-v2`, `-v1`, and `-baseline` suffixes. Their disjoint layouts start at `HAC44_PORT_BASE`, base + 100, and base + 200; the HTTP runner uses base + 90. Every configured port, including disabled services, is checked for overlap, Windows excluded TCP ranges and IPv4/IPv6 occupancy before any bank starts. A fresh run rejects existing container names and project volumes.

Before reset, stop, cleanup, and SQL, `banks.py` requires the expected config.toml project, actual `com.supabase.cli.project` container labels, an external own-run marker, and the matching database marker created after initial start. Missing or foreign evidence aborts before the mutation. Reset preserves an external public/private backup and recreates the marker. Stop preserves volumes. Existing unrelated banks are never adopted. `gate.py`, `test-profiles.json`, migrations and application CI remain unchanged. Historical V1 replay is a separate, newly owned regression bank, never a V2 fixture source.

`run.py all` verifies dependencies, runs the native reconstruction/gates and both pgTAP profiles, starts local HTTP services while preserving the volume, inventories the sources/catalog, executes two sequential dataset cycles, regenerates CSVs and runs `pnpm typecheck`/`pnpm test:release`. `runtime.py stop` stops only the three verified HAC44 projects and preserves their local volumes.

The complete run also executes `pkce_smoke.py` before dataset seeding: two real local OAuth sessions, issuer validation, a wrong-verifier negative with valid controls, and actual claims under authenticated through ALL IMMEDIATE. Credentials remain in memory. It reconstructs the verified empty bank after the smoke, exporting only nonsecret fixture IDs. `guards.py` runs after each successful cycle cleanup. The final stop verifies business roots are zero; any residual own fixtures are backed up and reconstructed with seed disabled before stop. This cleanup is always attempted, including on a failed run, and never adopts an unowned bank.

Historical replay migrations may recreate fixtures even with seed disabled. `teardown.py` then backs up the own bank, persists explicit physical keys, audits incoming FKs including implicit CASCADE, and deletes children before parents by those exact keys. It restores ordinary triggers and verifies every captured key is absent. Reference cargo categories remain; historical migrations are never edited.

If the unchanged base FK gate blocks the integral run, `strict_diagnostic.py` can measure the present strict cohort independently on a separately seeded own bank. It uses the identical strict builder, probe and merger. Its observed results never promote the integral verdict or resume the stopped second cycle; missing positive fixtures remain BLOQUEADO. This separates measurement of the HAC-41 additions from unrelated base-fixture prerequisites.

## Individual evidence

```powershell
python scripts/qa/hac44/lifecycle.py seed
python scripts/qa/hac44/lifecycle.py verify
python scripts/qa/hac44/api_runner.py run
python scripts/qa/hac44/api_runner.py extended
python scripts/qa/hac44/api_runner.py ltl
python scripts/qa/hac44/pending.py
python scripts/qa/hac44/api_runner.py pending
python scripts/qa/hac44/api_runner.py auth-verify
python scripts/qa/hac44/api_runner.py contract
python scripts/qa/hac44/contract_verdict.py
python scripts/qa/hac44/rls.py
python scripts/qa/hac44/races.py
python scripts/qa/hac44/fk_coverage.py
python scripts/qa/hac44/persistence.py
python scripts/qa/hac44/generate.py
python scripts/qa/hac44/lifecycle.py cleanup
```

Keep these commands sequential. `pending.py` prepares independent FTL/LTL native fixtures for valid mutation states; `pending` exercises each formerly partial route with a functional positive and anonymous/revoked/foreign/version controls where relevant. Shared catalog reads allow B; foreign writes require a denied carrier/admin context. Scoped lists must have a nonempty positive and cannot expose A's IDs to B. Empty results alone do not certify authorization.

`rls.py` uses `set local role authenticated` and issuer-verified claims for synthetic local users, paired A/B/revoked controls. `races.py` runs independent native concurrency controls.

`fk_coverage.py` validates the committed `fk_inventory.json` against the reconstructed
catalog by physical identity and category. The frozen 776b5da scope is preserved: 178 existing measurements, 45 strict V2 additions, and 40 individually excluded V1 FK. `fk_hac41_inventory.json` contains the separately approved HAC-41 cohort. A catalog without that entire cohort reports it as `NOT_PRESENT_IN_CUT`; a catalog containing it requires all physical definitions to agree. Partial cohorts, duplicates and unexpected identities abort. The two authorized cuts therefore reconcile to 263 and 273 physical FK respectively, without using those totals as selection gates.
Selection uses explicit schema/table/constraint identities. The 45 additions comprise
20 model, 11 auxiliary and 14 internal receipt/grant FK. V1 exclusions retain their
individual reasons and never become measured V2 cases.

`fk_complete.py` restores the original 776b5da baseline method. Its only source
changes import the explicit `fk_baseline_scope.py` identities and exclude those
identities from selection, preventing a duplicate partner-assignment measurement.
The original method suspends non-internal triggers on the tested table inside the
rolled-back case, then defers sibling FKs during the exact-constraint orphan check.
`fk_coverage.py` verifies its source against `git show 776b5da`, executes it separately,
and reconciles the measured identities with the baseline inventory. A failure in
this original method stops the run after mandatory cleanup; no second cycle follows.

The original 45 additions and the present HAC-41 cohort use `fk_strict.py` with an authenticated invoker, local
issuer-verified claims injected by the SQL transport and temporary SECURITY DEFINER physical-write helpers (direct client
writes are revoked in production). All positive triggers remain enabled; queued
constraints are evaluated after the helper returns, under authenticated through
`SET CONSTRAINTS ALL IMMEDIATE`. Both boundary roles are recorded and required.
These are physical FK probes, not certification of a native command or RLS.
Every positive must affect one row with its intended non-null reference. A failed positive is `BLOQUEADO`.
Inventory presence is `PRESENT_UNMEASURED`, never FK coverage. SQL regression and pgTAP results with literal claims are reported separately from real local PKCE smoke evidence. Neither is presented as hosted or live-provider certification.
A negative requires SQLSTATE `23503` and the exact expected constraint name; another
constraint or trigger is `FAIL`. The strict method never changes FK deferrability. It first
uses an absent sentinel tuple when sibling FK references remain valid; otherwise it
selects an absent composite tuple from existing parent component values. Extra
columns are set to NULL only when the actual catalog
marks them nullable and the sibling FK permits it. The CSV records each orphan
strategy and whether all sibling references were verified in the fixture snapshot;
CHECKs and guards remain runtime controls, and a masked orphan still fails its case.
It attempts the orphan with ordinary guards enabled, and suspends only an explicitly
reviewed guard demonstrated to block that probe. Each suspension records its reason,
observed blocker and attempt, and rolls back in the negative subtransaction.

Receipts use isolated compatible inserts. Catalog grants retain their real
`auth_user_id`/`carrier_id` columns and partial UNIQUE indexes, use an id-only local
Auth fixture, and locate the inserted grant by `ctid` within the same transaction.
All fixtures and metadata changes roll back. Counts include every permanent table
in non-system schemas, including Auth and the QA registry; the complete measured
public/private catalog must be identical before/after.

Output names derive their counts from reconciled records; at this cut they are
`HAC-44_fk_223.csv`, `HAC-44_fk_45_V2.csv`,
`HAC-44_fk_40_V1_excluded.csv`, and detailed diagnostic/cleanliness JSON logs in the
external evidence directory. FK pairs alone do not certify the complete semantics
of relationship 70; that classification also requires its current dedicated proof.
`strict_controls.py` pairs a live deferred invoker trigger with wrong-role and
failed-positive controls using temporary tables/functions and full rollback.
`tests.py` discovers the Python harness suites and runs its HTTP unit suites.
Run `python scripts/qa/hac44/tests.py` from the repository root; alternatively run
`python -m unittest discover -s scripts/qa/hac44 -p "test_*.py"` and
`node --conditions=react-server --import tsx --test ../scripts/qa/hac44/http_contract.test.ts ../scripts/qa/hac44/http_pending.test.ts`
from `cargomesh` for the HTTP controls. The PR records these local commands;
no workflow changes are part of this harness delivery.

Run `python scripts/qa/hac44/test_fk_inventory.py` and
`python scripts/qa/hac44/test_fk_complete.py` for independent paired regressions.
Run `python scripts/qa/hac44/test_fk_orphans.py` for paired absent-tuple, sibling-FK,
nullable-column and incomplete-snapshot controls.

`contract_verdict.py` intentionally exits 1 when a real product counterexample remains.
The two-cycle orchestrator retains every current FAIL/BLOQUEADO verdict, continues
the remaining measurements when their prerequisites are available, cleans up each
attempted cycle, and runs the final checks. It returns the aggregate verdict without
exceptions for preexisting counterexamples. `guards.py` pairs each local-only denial
with a valid connection/count control. `complete_recipe.py --check` verifies the
committed completed-operation recipe against native crew inputs.

`sql_layout.py` keeps the generated native recipe readable using only Python's standard
library. SQL uses LF, four-space levels, no blank lines within a statement and a maximum
of 120 columns. JSON literals are expanded without changing their parsed value; long
standard SQL strings use PostgreSQL's newline concatenation without changing their
contents. The formatter neither changes the clock nor executes SQL. No formatter is
required as an installed repository dependency.

Endpoint inventory reconciles documented and runtime route shapes, recording
parameter aliases separately (for example assignmentId/parentId). A runtime
route still requires measured functional positive and anonymous negative HTTP
controls. Current model reconciliation targets and RoutePlanner snapshots are
resolved from the selected source/catalog and typed output; no row identity
assigns a fixed verdict.

## Matrix generation and comparison

`generate.py` rereads UML 07 + dictionary + physical design/DER from Git at the selected SHA, the freshly reconstructed PostgreSQL catalog, and real Zod/Hono runtime exports. It requires the fresh execution evidence described above; old JSON results are never imported as current tests. CSVs are written at the evidence root:

- `HAC-44_matriz_clases.csv`, `HAC-44_matriz_atributos.csv`, `HAC-44_matriz_relaciones.csv`;
- `HAC-44_matriz_endpoints.csv` and `HAC-44_mapa_metodos.csv`.

`methods.py` includes every UML method, its related native operation, exact source/test references and an explicit certification limit. A related operation/test is not proof of the standalone UML method's entire semantics. Identity/integration classes without a canonical writer remain explicit gaps.

Set `HAC44_CP1` to the external CP-1 evidence folder and run `compare.py` to list exact classification/FK promotions by stable UML/route/constraint keys. UUIDs, SHA/provenance and call counts are regenerated. `audit.py` also checks identical classifications between the two cycles, unchanged constraint/trigger definitions, staged scope and secrets/machine paths. `HAC44_ORIGINAL` optionally verifies the untouched original checkout.

For a CP-2 repeat comparison, also set `HAC44_CP2` to the preserved CP-2 evidence root.
`compare.py` then compares all four CSV matrices, including every column and `estado`,
without sorting rows or JSON, dropping fields, changing whitespace, or changing expectations.
Only thirteen-digit epoch-millisecond values, ISO-8601 timestamps with a timezone,
UUIDs, and SHA-1/SHA-256 hashes are replaced with typed placeholders. Relative fixture
clocks stay active. Headers, row counts, row order and every remaining character must
match exactly. `logs/normalized-cp2-comparison.json` records X/Y identical rows per matrix
and every residual difference; any residual difference fails the comparison.

Run `python scripts/qa/hac44/test_normalized_compare.py` for paired positive/negative
controls proving that real field values, `estado`, counts, headers, row order, case and
whitespace differences remain failures.

The secret filter is active in every captured command. Local CLI credentials are read only in memory and passed to the HTTP subprocess; status output and credential environment values are never logged. All data are LOCAL_ONLY/SIMULATED. Hosted databases and live MCP/provider integrations are outside this certification.

HAC-41 compatibility fixtures include verified active operators for carriers A/B and an inactive operator. The same synthetic users have explicitly seeded, independent organization memberships for the older catalog routes; no membership is inferred from a carrier. Carrier identity RPC controls, both directions of carrier workflow isolation and paired foreign catalog writes are recorded separately from shared reference reads. The original base and strict FK methods remain unchanged; native HTTP writes create the condition, metrics, partner and incident association fixtures before probing them.

`authentication.py` measures an actual issuer-verified local session cookie through Next's native request stores around the unchanged Hono router. Its same-origin functional controls accompany foreign-origin cookie and invalid-Bearer negatives, including a valid cookie alongside the invalid Bearer. Anonymous requests always require 401; the HAC-41 origin-before-credential defect remains FAIL. Session material stays in memory, followed by an owned reset and Auth count 0. The catalog is captured after that reset so the exact drift guard compares current internal trigger identities.

Fresh MANUAL offer creation always requires 201 and `idempotentReplay=false`; replay requires 200, `idempotentReplay=true`, the same ID, and physical counts 0 -> 1 -> 1. `offer_counts.py` obtains read-only physical counts through the ownership-checked Docker SQL path without granting direct commercial-table SELECT. A fresh 200 remains FAIL and its persisted row may only seed independent downstream probes; it never certifies that creation case.

Previously absent directory routes are reconciled against the current runtime registration and remain inventory observations. Endpoint classifications require a passing functional positive and a passing anonymous 401. An invalid-Bearer 401 cannot replace that anonymous control, and neither an observed route nor a failed creation becomes a functional positive.

## F-02 checkpoint measurements

`f02_descriptors.json` retains the approved historical inventory as metadata. `f02.py`
executes new native HTTP, SQL and exported-rule probes; `f02_matrix.py` derives row
states from their current artifacts. Literal method-name searches never prove that
an implementation is absent: SQL aliases and aggregate handlers require semantic
mapping. Every pending signature retains its own search, declaration candidates,
missing isolated input/frontier, QA owner and retest criterion. A related operation
does not certify that signature. Both UML association ends are required; exact FK
evidence cannot replace zero/many or deferred nonempty child controls.

DB claims are issued and verified by the owned local Auth service. Concurrent
queries serialize issuance and reuse only live verified claims in memory. FK
campaign counts begin after this Auth prerequisite. Every rollback compares all
permanent table counts; deferred invariants reach `ALL IMMEDIATE` before leaving
`authenticated`. Audit reads use the native workflow RPC rather than new SELECT
grants. Exported domain rules are called directly with a valid native input and
an isolated changed input; no product rule is reimplemented.

Set `HAC44_CYCLES=1` for the authorized single integral checkpoint run. Preserve its
result and file hashes before any directed repair/rerun. Directed suites never
upgrade that integral verdict or establish CP-2 repeatability. A stopped bank can
restart only after its disk marker, exact volume label and free port layout are
verified; after startup its original database marker must match. Stop/reset/cleanup
always require the independent container and database ownership proofs.
