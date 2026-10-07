# HAC-11 · local identity and account-link verification · 2026-10-03

Branch: `feat/be1-v2-mcp-account-linking`. Starting commit: `f4521335afa6cb928a189659ce44ed8a5cbaa73c`.
Scope: HAC-11 only. No hosted Supabase, production Vercel, Alexa+ client, or carrier was contacted.

## Change and reason

- A Supabase Auth `getUser` result is now paired with exact OAuth claims: configured issuer, `authenticated` audience and role, matching subject, exact `client_id`, and valid issue/expiry times. The legacy `azp` fallback is removed. The verified token still creates a request-scoped user Supabase client; account-link and active-membership checks continue on every MCP request.
- The HAC-11 expired-link pgTAP fixture now uses a historical `linked_at` before an elapsed `expires_at`. The previous test attempted `expires_at < linked_at`, which correctly failed the production lifetime constraint before the RLS assertion could execute.
- The example environment comment now assigns account-link persistence to HAC-11 rather than HAC-21, while retaining the disabled-by-default bearer setting.

## Local execution

The existing HAC-29 `feat/cycle-2-integration` checkout at `f2a8e3e` was used as a detached, ignored temporary test worktree. Only the HAC-11 migration and SQL test were copied into it. This was an isolated local test composition, not an integration merge. Supabase CLI `2.117.0` started the `cargomesh-v2-local` PostgreSQL container and applied the two HAC-29 baseline migrations plus the HAC-11 migration. The guarded `supabase/scenarios/v2-road-baseline/seed.sql` ran with `local_only=1`.

Commands, from the repository root, against the named local Docker container:

```powershell
npx.cmd --yes supabase@2.117.0 db start --workdir .tmp/hac11-gate/supabase-v2
Get-Content -Raw .tmp/hac11-gate/supabase/scenarios/v2-road-baseline/seed.sql | docker exec -i supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -v local_only=1 -U postgres -d postgres
Get-Content -Raw .tmp/hac11-gate/supabase/tests/12_hac11_mcp_account_links.test.sql | docker exec -i supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
```

First pgTAP run: **FAIL at assertion 9 setup**, SQLSTATE `23514`, because the test's expired date violated `mcp_account_links_lifetime_valid`. After correcting that fixture, the same test reported **14/14 `ok` and `finish()` returned zero failures**. It covered tenant/client isolation, uniqueness, scopes, direct-write denial, revocation completeness, expiry, and inactive membership. The test transaction rolled back.

`pnpm typecheck`, focused `user-token.test.ts` (5/5), `pnpm test:mcp` (76/76), `pnpm test:release`, and `pnpm build` passed. Node's test/build subprocesses require execution outside the restricted sandbox on this Windows host; initial `spawn EPERM` was environmental, and the rerun passed. The isolated pgTAP composition does not certify HAC-12 or Gate-2; a combined gate and real user OAuth token/client test remain pending. The named local Supabase container was stopped with `--project-id cargomesh-v2-local --no-backup`, and the temporary checkout was removed after verification.

## Boundaries

No `mcp_account_links` row was written to hosted Supabase. No Alexa+ call was observed. No V2 business tool was enabled by this change. HAC-12's application service remains on its own PR and must be consumed directly by HAC-11 during Gate-2, with Web/MCP parity tested on the same V2 scenario.
