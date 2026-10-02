# HAC-30 · AWS Builder evidence (pending verification)

Cut: 2026-10-02. An authentic local Kiro Crew session subsequently produced HAC-11 commit `c212c62`; see the [sanitized evidence record](./evidence/hac-30/KIRO_CREW_HAC11_2026-10-02_REDACTED.md). Its five new pgTAP assertions have **not** been executed because Docker Desktop was unavailable. HAC-11 and HAC-30 remain `In Progress`. Codex work is not represented as Kiro work, and no CargoMesh Bedrock invocation is claimed.

## Kiro Crew session to execute

The local `kiro-cli` binary was present but `kiro-cli whoami` did not report a usable login in this Codex environment. Axel then used Kiro Crew in a separate authenticated session and committed the extended pgTAP file as `c212c62`. The prompt below is retained as the planned task record; the verified outcome and limits are in the linked evidence file. Do not let Crew change production or infer consent from a token alone.

Prompt for Kiro Crew:

> Work only on CargoMesh HAC-11 in `feat/be1-v2-mcp-account-linking`. Read AGENTS.md, docs/v2-amazon/README.md, the HAC-11 Linear DoD and the approved HAC-16 manifest. Review `supabase-v2/supabase/migrations/20261002160000_hac11_mcp_account_links.sql`, `cargomesh/src/server/mcp/auth/user-token.ts`, and the corresponding tests. Implement and test one real missing HAC-11 block: pgTAP checks for cross-tenant/client, revoked/expired links, and RLS, using the HAC-29 V2 bootstrap. Preserve fail-closed OAuth consent and avoid service_role in business tools. Record exact commands and results. Do not touch AWS, production, main, or other issues. Stop if the HAC-29 chain or environment is unavailable and report the exact blocker.

Evidence to export after the authentic session: session identifier and date/time, the actual prompt and responses with secrets redacted, screenshots showing Kiro Crew identity/task and test output, diff/commit/PR, Axel's human review (accepted or corrected decisions), command output for `pnpm test:mcp`, `pnpm typecheck`, and V2 pgTAP if runnable. Place the redacted artifacts in the HAC-18 Drive index under `01_Kiro_Crew_Evidencias/Axel_BE1/` and link exact URLs in HAC-30. Never upload `.env`, credentials, tokens, full AWS account IDs, or unredacted transcripts.

| Evidence field | Current value |
| --- | --- |
| Authentic Crew session/date | Local session verified, 2026-10-02 16:16–16:27 Lima |
| Crew task and changed files | Extend `supabase/tests/12_hac11_mcp_account_links.test.sql` from 9 to 14 assertions |
| Human review | Pending |
| Commit/PR | `c212c62` local commit; PR #94 requires update |
| Test results | pgTAP blocked by Docker; no PASS claim |
| Redacted Drive artifacts / HAC-18 index | Pending upload/index |

## Bedrock sandbox

AWS promotional credits were reported as claimed under HAC-17; credits are not IAM access. The `CARGOMESH_BEDROCK_NARRATION_ENABLED` adapter exists and the example configuration leaves it off. This Codex environment has no verified authorized AWS account session, model quota, or sandbox configuration; no Bedrock API call was made. The earlier Sprint 1 `ListFoundationModels` denial is historical and must not be presented as today's IAM status.

With an authorized sandbox, the AWS owner should verify `bedrock:ListFoundationModels` and `bedrock:InvokeModel`/Converse access without exposing identity data; then run one bounded narration call over an already computed ROAD result. Record model ID, region, timestamp, input/output token counts, latency, redacted output, estimated cost, and whether deterministic SSML fallback was used. Bedrock must not change eligibility, ranking, price, or booking. If access is denied, record the sanitized error and the deterministic fallback test instead of claiming a live invocation.

| Bedrock evidence field | Current value |
| --- | --- |
| Current IAM/quota check | Requires authorized AWS access |
| Sandbox model and region | Pending |
| Real invocation, tokens, latency, output, cost | Pending |
| Fallback evidence | Local mock tests only; no live AWS claim |

## Devpost Product Feedback draft (English, factual as of this cut)

> We used Kiro Crew on a real CargoMesh HAC-11 security test task. It inspected the account-link migration and extended one pgTAP file with five negative assertions, traceable to commit c212c62. The database suite could not run because Docker Desktop was unavailable; we therefore do not claim passing pgTAP or production integration. We found the focused review useful, while a tool-approval timeout and local environment dependency added friction. We would use Kiro Crew again for bounded code and test changes with human review. CargoMesh also has an optional Bedrock narration adapter, but no real CargoMesh Bedrock invocation is verified.

Update this draft **only after** the corresponding primary evidence exists. Alexa+ linking and the AWS Builder mini challenge are separate claims.
