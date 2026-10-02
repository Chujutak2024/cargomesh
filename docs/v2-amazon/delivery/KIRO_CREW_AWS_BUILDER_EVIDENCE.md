# HAC-30 · AWS Builder evidence (pending verification)

Cut: 2026-10-02. This file is an evidence checklist, **not** a claim that Kiro Crew or Bedrock has run. HAC-11 is `In Progress`; HAC-30 is `In Progress`. The current Codex session must not be represented as Kiro work.

## Kiro Crew session to execute

The local `kiro-cli` binary is present, but `kiro-cli whoami` did not report a usable login in this Codex environment. No Crew session was launched here. Axel should authenticate in his own Kiro environment, then run a real task on `feat/be1-v2-mcp-account-linking` after reviewing the branch and the HAC-12 interface. Suggested task: review the `mcp_account_links` migration and user-token repository against HAC-11, add the missing pgTAP negatives on the V2 bootstrap, and run the relevant tests. Do not let Crew change production or infer consent from a token alone.

Prompt for Kiro Crew:

> Work only on CargoMesh HAC-11 in `feat/be1-v2-mcp-account-linking`. Read AGENTS.md, docs/v2-amazon/README.md, the HAC-11 Linear DoD and the approved HAC-16 manifest. Review `supabase-v2/supabase/migrations/20261002160000_hac11_mcp_account_links.sql`, `cargomesh/src/server/mcp/auth/user-token.ts`, and the corresponding tests. Implement and test one real missing HAC-11 block: pgTAP checks for cross-tenant/client, revoked/expired links, and RLS, using the HAC-29 V2 bootstrap. Preserve fail-closed OAuth consent and avoid service_role in business tools. Record exact commands and results. Do not touch AWS, production, main, or other issues. Stop if the HAC-29 chain or environment is unavailable and report the exact blocker.

Evidence to export after the authentic session: session identifier and date/time, the actual prompt and responses with secrets redacted, screenshots showing Kiro Crew identity/task and test output, diff/commit/PR, Axel's human review (accepted or corrected decisions), command output for `pnpm test:mcp`, `pnpm typecheck`, and V2 pgTAP if runnable. Place the redacted artifacts in the HAC-18 Drive index under `01_Kiro_Crew_Evidencias/Axel_BE1/` and link exact URLs in HAC-30. Never upload `.env`, credentials, tokens, full AWS account IDs, or unredacted transcripts.

| Evidence field | Current value |
| --- | --- |
| Authentic Crew session/date | Pending |
| Crew task and changed files | Pending |
| Human review | Pending |
| Commit/PR | Pending |
| Test results | Pending |
| Redacted Drive artifacts / HAC-18 index | Pending |

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

> We used CargoMesh's MCP development workflow and evaluated Kiro Crew as a potential tool for the HAC-11 identity and authorization work. A Kiro Crew session has not yet been verified, so we cannot claim it accelerated this implementation. The Kiro CLI was discoverable locally, but this Codex environment did not have a usable Kiro login; obtaining and documenting an authenticated Crew session is the next onboarding step. CargoMesh also has an optional Bedrock narration adapter with a deterministic fallback. We have not verified current Bedrock IAM/quota access or a real sandbox invocation, so we cannot report model quality, latency, cost, or production use. We would reassess both tools after an authentic Crew session and a bounded sandbox call, with human review and reproducible test evidence.

Update this draft **only after** the corresponding primary evidence exists. Alexa+ linking and the AWS Builder mini challenge are separate claims.
