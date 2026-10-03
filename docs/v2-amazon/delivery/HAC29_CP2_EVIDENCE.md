# HAC-29 CP-2 local evidence

Part of HAC-29. Executed 2026-09-27 UTC / 2026-09-26 America/Lima.
Base: `e289801f209902ebfe8e54b39c50ce62a16c4b6f` (`origin/feat/cycle-2-integration`, fetched before branch creation).
Branch: `feat/be3-v2-clean-bootstrap`. Reviewer: Cristhian. No push or PR at this checkpoint.

## Commands and observed results

`<evidence>` is an absolute directory outside the checkout. The local delivery includes
the full logs, SQL inputs without credentials, public-only backups and the Spanish CP-2
report. Commands below are run at the repository root; Windows uses `npx.cmd`/`pnpm.cmd`.

| Command / check | Result | Observed output |
|---|---|---|
| `npx --yes supabase@2.117.0 --version` | PASS | `2.117.0` |
| `python supabase-v2/gate.py v1 --evidence-dir <evidence>/v1-final` | PASS | Normal historical reset and `All tests successful. Files=9, Tests=183. Result: PASS` |
| `python supabase-v2/gate.py v2 --evidence-dir <evidence>/v2-final` | PASS | Full reset, reference/absence/drift checks, seed/verify, pgTAP and cleanup; exit 0 |
| V2 reference check within that command | PASS | Eight exact IDs/codes, all four guidance fields meaningful; retained after cleanup |
| V1 absence with positive replay control | PASS | 9/9 checks: V2 all zero; V1 ACME/FR/carriers/Auth/member each 1, vehicles 3 |
| Frozen baseline schema and reference replay | PASS | public/private schema equal, including ACL/RLS/constraints/functions; four guidance fields equal |
| V2 pgTAP explicit profile | PASS | `All tests successful. Files=4, Tests=73. Result: PASS` |
| Explicit scenario seed/verify | PASS | 25 rows across 10 relations; 2 organizations, 4 facilities, 2 services, 6 areas, 2 directed lanes; Piura/reverse 0 |
| Exact-ID cleanup with backup and FK audit | PASS | 25 removed, all 10 relation counts 0; reference categories 8 |
| `pnpm --dir cargomesh typecheck` | PASS | `tsc --noEmit`, exit 0 |
| `pnpm --dir cargomesh test:release` | PASS | 18 commands, 410 tests passed, 0 failed; exit 0 |
| Local complete workflow executor (`Get-Command act -ErrorAction Stop`) | BLOCKED | `act` is not installed; no GitHub-hosted workflow run is claimed |

Suite counts above describe this run, not acceptance thresholds. The gate requires
successful suites and propagates nonzero exits. The existing application CI job still
includes production build; that build was not part of the requested local CP-2 checks.
`test:mcp:local` was not executed or declared green.

Normalized schema SHA-256 on both frozen replays:
`b5e07dec38cf8e9ec99315ec5859b874f469d99970156c47ded1aeaa62d86e73`.

Additional local negative controls passed: seed refuses missing `local_only`; cleanup
refuses missing `local_only` or backup confirmation; an exact transaction-local child
facility outside the inventory causes `V2_QA_CLEANUP_BLOCKED` through its organization
FK with `ON DELETE CASCADE`. The child existence was checked before rejection, the
scenario remained intact, and the normal backed-up cleanup succeeded afterward.
Repeated seeding and verification also passed. This certifies cleanup safety only,
not the future HAC-12 writer's atomicity.

## Blocked contract expectations

- HAC-12 / Cristhian: positive verified calendar, asset/pool/reservation persistence,
  native POST/GET, actual HTTP 200 eligible/unknown/zero and HTTP 403 FORBIDDEN_TENANT,
  QA-13-21/22/23 round-trip/idempotency/real intermediate-write rollback.
- HAC-11 / Axel: persisted MCP links, rotation/revocation/scopes and Web/MCP parity.
- HAC-14 / Luis, HAC-15 / Juan: UI, mapper, map and absent-geometry behavior.

Read-only local schema evidence found `carrier_services` and all three existing
receipt/version columns. `transport_assets`, `capacity_calendars`, and `mcp_account_links`
were absent. No duplicate receipt table or production fault switch was added.
Fixture JSONs are expected projections with explicit BLOCKED status, not observed API responses.

## Friction and resolved implementation issues

The historical service schema requires `max_capacity_kg`. An initial extension omitted
it and correctly failed with NOT NULL; the transaction rolled back. The extension now
copies the existing 10000 kg / 30 m³ nominal metadata while making no calendar claim.
The final clean run passed without weakening constraints or changing historical DDL.

The existing developer V1 stack was preserved. Historical regression and drift use
dedicated replay containers, so a normal V1 reset does not destroy another task's data.
Docker was initially unavailable and became available before any database verification.
The complete workflow remains locally unexecuted because `act` is unavailable; both DB
job entrypoints and the two requested application commands were executed directly.

## Scope and restrictions

Changes are limited to `supabase-v2/`, the V2 scenario, tests, the existing workflow and
documentation. The untracked CP-1 experiment was backed up outside the checkout and
removed; its local container was stopped. Historical migrations, the historical global
seed, original tests 01–10, application source, the original checkout and its two
untracked user files were preserved. The dedicated V2 stack ends with no scenario rows.

No hosted Supabase tools or SQL were used. No remote write, migration, branch, pause,
link, repair or db push. No Linear operation, issue completion, push, PR, merge, main
checkout, published-history rewrite, external message or live credential export.
