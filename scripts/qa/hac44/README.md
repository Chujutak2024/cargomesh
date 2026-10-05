# HAC-44 reproducible local QA

This directory owns the QA harness beside existing repository scripts, keeping synthetic data outside migrations and leaving product services, profiles and CI unchanged. Documentation and scenario sources are committed; logs, catalogs, CSVs, UUID registries, backups and replay workdirs live in an external evidence directory.

## Setup and complete run

Python 3.11+, Docker, Supabase CLI 2.117.0, the project Node engine and lockfile-matching Node dependencies are required. Dependency provisioning is external to this harness; it never changes SSL validation or installs implicitly. `provenance.py` checks all direct dependency versions against `pnpm-lock.yaml`. The pnpm 11 environment setting prevents its implicit install before scripts; it does not waive dependency verification or any suite.

```powershell
$env:HAC44_EVIDENCE = Join-Path $env:TEMP 'hac44-evidence'
$env:HAC44_CLI = (Get-Command supabase).Source
python scripts/qa/hac44/run.py all
```

Use a fresh external directory for each source SHA. `HAC44_ROOT` may identify the selected checkout when these QA scripts are run from another directory; `HAC44_SOURCE_SHA` accepts the selected full commit hash (default: HEAD). The checkout's product/model/migration inputs must match that SHA. The selected revision must contain the V2 UML/model, dictionary, manifest and native profile inputs expected by this model version. There are no machine-specific absolute paths in committed scripts. Output paths are derived from the environment.

Three dedicated banks use projects `hac44-full-flow-v2`, `hac44-full-flow-v1` and `hac44-full-flow-baseline`, ports 423xx/433xx/443xx and inspector ports 9043/9143/9243. Native preflight verifies conflicts. HTTP tests use loopback port 42350. The normal CargoMesh local bank is untouched. `gates.py` preserves native algorithms and checks, adapting only workdirs, ports, project/container addresses and Python helper import context. No `gate.py`, `test-profiles.json` or workflow change is required. Historical V1 replay is a separate regression bank, never a V2 fixture source.

`run.py all` verifies dependencies, runs the native reconstruction/gates and both pgTAP profiles, starts local HTTP services while preserving the volume, inventories the sources/catalog, executes two sequential dataset cycles, regenerates CSVs and runs `pnpm typecheck`/`pnpm test:release`. `runtime.py stop` stops only the three verified HAC44 projects and preserves their local volumes.

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
python scripts/qa/hac44/fk_complete.py
python scripts/qa/hac44/persistence.py
python scripts/qa/hac44/generate.py
python scripts/qa/hac44/lifecycle.py cleanup
```

Keep these commands sequential. `pending.py` prepares independent FTL/LTL native fixtures for valid mutation states; `pending` exercises each formerly partial route with a functional positive and anonymous/revoked/foreign/version controls where relevant. Shared catalog reads allow B; foreign writes require a denied carrier/admin context. Scoped lists must have a nonempty positive and cannot expose A's IDs to B. Empty results alone do not certify authorization.

`rls.py` uses `set local role authenticated` and actual synthetic JWT claims, paired A/B/revoked controls. `races.py` runs independent native concurrency controls. `fk_complete.py` creates compatible optional metadata only inside rollback and tests the exact FK; see the scenario README for domain-trigger suspension and negative-probe deferral.

`contract_verdict.py` intentionally exits 1 when a real product counterexample remains. The two-cycle orchestrator accepts only the three explicitly enumerated preexisting counterexamples and records them as FAIL; unexpected failures stop the run. It never calls those contract tests green. `guards.py` pairs each local-only denial with a valid connection/count control. `complete_recipe.py --check` verifies the committed completed-operation recipe against native crew inputs.

## Matrix generation and comparison

`generate.py` rereads UML 07 + dictionary + physical design/DER from Git at the selected SHA, the freshly reconstructed PostgreSQL catalog, and real Zod/Hono runtime exports. It requires the fresh execution evidence described above; old JSON results are never imported as current tests. CSVs are written at the evidence root:

- `HAC-44_matriz_clases.csv`, `HAC-44_matriz_atributos.csv`, `HAC-44_matriz_relaciones.csv`;
- `HAC-44_matriz_endpoints.csv` and `HAC-44_mapa_metodos.csv`.

`methods.py` includes every UML method, its related native operation, exact source/test references and an explicit certification limit. A related operation/test is not proof of the standalone UML method's entire semantics. Identity/integration classes without a canonical writer remain explicit gaps.

Set `HAC44_CP1` to the external CP-1 evidence folder and run `compare.py` to list exact classification/FK promotions by stable UML/route/constraint keys. UUIDs, SHA/provenance and call counts are regenerated. `audit.py` also checks identical classifications between the two cycles, unchanged constraint/trigger definitions, staged scope and secrets/machine paths. `HAC44_ORIGINAL` optionally verifies the untouched original checkout.

The secret filter is active in every captured command. Local CLI credentials are read only in memory and passed to the HTTP subprocess; status output and credential environment values are never logged. All data are LOCAL_ONLY/SIMULATED. Hosted databases and live MCP/provider integrations are outside this certification.
