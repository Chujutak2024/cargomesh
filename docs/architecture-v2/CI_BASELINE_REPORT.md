# CargoMesh V2 — CI Baseline Report (HAC-7)

## 1. Purpose and scope

This report certifies the local CI baseline implemented for HAC-7. It covers the complete Hono freight-request harness, the local pgTAP database suite, TypeScript, the production build, and the existing release preflight. It does not claim a green result for checks that require hosted release credentials.

The Hono gate intentionally expands the ticket's single-file command. The route suite contains 15 tests, but the adapter suite contains another 27 contract tests that would otherwise remain outside `test:release`. The implemented command therefore executes both files:

```text
src/server/hono/routes/freight/requests.test.ts
src/server/hono/adapters/freight-request-adapter.test.ts
```

## 2. Execution baseline

| Field | Value |
| --- | --- |
| Executed at | 2026-09-20 00:43:57 -05:00 (America/Lima) |
| Branch | `feat/be3-hac-7-ci-baseline-runner` |
| Tested code commit | `bdedc4f05a26797b75e6b1ef32681e7fb63ef12e` |
| Base branch | `codex/c-mcp-contracts` |
| Node.js | `v24.20.0` |
| pnpm | `11.19.0` |
| Docker | `29.7.2` (build `a7dcaa6`) |
| Supabase CLI through `npx` | `2.117.0` |
| Local Supabase Studio | `http://127.0.0.1:56323` — HTTP 200 |

The local Studio port is `56323`, as configured by `supabase/config.toml`; the `54323` value in the initial operating guide does not apply to this repository.

## 3. Implemented gate

`cargomesh/package.json` now includes:

```json
"test:hono": "tsx --test src/server/hono/routes/freight/requests.test.ts src/server/hono/adapters/freight-request-adapter.test.ts"
```

`test:release` now ends with:

```text
pnpm test:mcp && pnpm test:hono
```

No GitHub Actions workflow is included. The Tech Lead decision on that optional, separate commit is still pending.

## 4. Verification results

| Command/check | Raw result | Status |
| --- | --- | --- |
| `pnpm test:hono` | `tests 42`, `pass 42`, `fail 0`, `suites 11` | PASS |
| `npx supabase test db` | `Files=8, Tests=160`, `All tests successful`, `Result: PASS` | PASS |
| `pnpm typecheck` | `tsc --noEmit`, exit code 0, 0 TypeScript errors | PASS |
| `pnpm test:release` | 366 Node tests reported across the chained suites, 366 passed, 0 failed | PASS |
| `pnpm build` | `Compiled successfully`; 10/10 static pages generated; build traces collected | PASS |
| `pnpm release:preflight` | `Release preflight: 6/16 checks passed` | FAIL — hosted environment missing |
| `pnpm release:verify` | TypeScript, tests and build passed; command exited 1 at `release:preflight` | FAIL |

### 4.1 Hono raw summary

```text
tests 42
suites 11
pass 42
fail 0
cancelled 0
skipped 0
todo 0
```

Breakdown: 15 route tests + 27 adapter tests = 42/42.

### 4.2 pgTAP raw summary

The ticket path `supabase/tests/database/*.test.sql` is incorrect. The executable suite is `supabase/tests/*.test.sql` and contains eight files.

```text
01_cargomesh_rls_and_golden_flow.test.sql ............... ok (plan 21)
02_c02_result_bridge_and_decision.test.sql .............. ok (plan 31)
03_int02a_result_bridge.test.sql ......................... ok (plan 17)
04_int02a_orchestration_run.test.sql .................... ok (plan 14)
05_c03_booking_bridge.test.sql ........................... ok (plan 40)
06_release_service_role_grants.test.sql ................. ok (plan 16)
07_d1_recommendation_draft_writer.test.sql .............. ok (plan 8)
08_draft_creation_idempotency.test.sql .................. ok (plan 13)

Files=8, Tests=160
Result: PASS
```

The verified total is 160/160: 147 historical assertions plus 13 idempotency assertions. The HAC-7 title/description and the “1. Cimientos V2” milestone still need their 147/147 wording corrected by the project lead.

### 4.3 Release preflight ownership and pending hosted evidence

The final preflight is designed for a hosted HTTPS release and reads production-owned configuration, including server-only credentials. It must therefore be executed by Cristhian Chujutalli in his already configured deployment environment. BE-3 will not request or receive those secrets; only the dated, sanitized command output will be incorporated here.

The following output is a **diagnostic-only** inventory produced in the BE-3 environment with `pnpm release:preflight -- --report-only`. It is not a passing result and is not used inside `release:verify`:

```text
FAIL  CARGOMESH_RELEASE_URL: missing or placeholder
FAIL  CargoMesh release origin: must be a valid URL
FAIL  NEXT_PUBLIC_SUPABASE_URL: missing or placeholder
FAIL  Supabase project origin: must be a valid URL
FAIL  NEXT_PUBLIC_SUPABASE_ANON_KEY: missing or placeholder
FAIL  SUPABASE_SERVICE_ROLE_KEY: missing or placeholder
FAIL  CARGOMESH_DEMO_LOGIN_EMAIL: missing or placeholder
FAIL  CARGOMESH_DEMO_LOGIN_PASSWORD: missing or placeholder
FAIL  NEXT_PUBLIC_CARGOMESH_TOOL_CALLER_ORIGINS: missing or placeholder
FAIL  WebMCP release origin allowlist: release origin is absent from the explicit allowlist

Release preflight: 6/16 checks passed.
```

Checks that did pass include Node.js, wildcard rejection, license presence, production bundle presence, client-bundle secret scanning, and Git-history hosted-secret scanning.

No credentials were fabricated, copied into the repository, or printed into this report.

#### Authoritative hosted preflight — pending

| Evidence field | Value |
| --- | --- |
| Operator | Cristhian Chujutalli |
| Execution environment | Operator-owned shell with the existing Supabase and Vercel production configuration |
| Command | `pnpm release:preflight` (without `--report-only`) |
| Execution date | **Pending** |
| Raw sanitized result | **Pending** |

This section will be completed only from the output supplied by Cristhian, attributed to him and dated. Secret values must remain redacted. Until that evidence is present and passing, the hosted release preflight is pending and the full release gate is not certified.

## 5. Reproduction commands

From the repository root:

```powershell
git checkout feat/be3-hac-7-ci-baseline-runner
cd cargomesh
pnpm install --frozen-lockfile
pnpm test:hono
cd ..
npx supabase test db
cd cargomesh
pnpm release:verify
```

## 6. Friction evidence

The valid CP-0 Friction Logs are stored in the official Drive folder:

1. Norton Web/Mail Shield TLS inspection required its Windows root CA to be exported and configured as the npm/pnpm `cafile`, while keeping `strict-ssl=true`.
2. Docker Desktop required a manual application start before the Linux engine became available.

The earlier statement that the manifest lived under `frontend/` was removed: it resulted from validating the wrong branch and is not a project friction.

## 7. Explicitly excluded

- No GitHub Actions workflow is committed without Tech Lead approval; a local untracked proposal may be reviewed separately.
- No hosted secrets or Vercel/Supabase remote configuration changes.
- No changes to the versioned `.pnpm-store/`.
- No merge into `codex/c-mcp-contracts` or `main`.
- No merge before the collective Gate-1 session on Friday, September 25; the Tech Lead explicitly accepted the local gates for Ready for review on 2026-09-20 while the hosted preflight remains tracked separately.

## 8. Current verdict

- Hono in the BE-3 local environment: **42/42 PASS**.
- pgTAP in the BE-3 local Supabase environment: **160/160 PASS**.
- TypeScript in the BE-3 local environment: **0 errors**.
- Production build in the BE-3 local environment: **PASS**.
- Node test chain in the BE-3 local environment: **366/366 PASS**.
- Hosted preflight in Cristhian's configured environment: **PENDING EVIDENCE**.
- Full `release:verify` in the BE-3 environment: **FAIL** at `release:preflight` (`6/16` diagnostic checks passed because production-owned variables are absent).

Therefore, the local code and database gates are green, but the overall release gate is **not yet verified** and must not be represented as 100% passing. Following the Tech Lead's explicit disposition (2026-09-20), the local gates were accepted and this PR moved to Ready for review. It remains unmerged by design: integration into `codex/c-mcp-contracts` happens collectively during the Gate-1 session on Friday, September 25. The hosted release preflight remains pending and is tracked separately; this report does not claim a fully verified `release:verify`.
