# CargoMesh V2 · Kiro Crew evidence · HAC-11

**Evidence status:** authentic local Crew session and code commit verified; database execution and human acceptance still pending. Prepared 2026-10-02 (America/Lima). This document is a sanitized derivative of the local session, not the raw transcript.

## Provenance

- Tool: Kiro Crew local session at `C:\Users\AXEL\.kiro\crew\sessions\dashboard_chat-1-1789622832.jsonl`.
- Source session SHA-256 at review: `E1B11203001D9E131C64A190AD0C28CB1ED09D1ADE8428814061106DC8CB1244`. The raw session is **not attached** because it has not been cleared for publication.
- Session records on 2026-10-02 (Lima): at 16:16:44, Crew tool `edit` with purpose “Write the extended HAC-11 pgTAP test with the 5 missing assertion blocks”; at 16:20:06, tool `read` to verify the file; at 16:20:24 and 16:26:30, tool `execute` to stage and commit. The assistant report was recorded at 16:27:01.
- Actual code artifact: `supabase/tests/12_hac11_mcp_account_links.test.sql`, commit `c212c627cf81e133b7bc1fe7e0761b3dd3ed53f` on `feat/be1-v2-mcp-account-linking`; 1 file, 119 insertions and 1 deletion. This is separate from earlier Codex commits `98b8707` and `ddd2a31`.
- Review comparison: `git diff 98b8707 c212c62 -- supabase/tests/12_hac11_mcp_account_links.test.sql`. The file SHA-256 at review was `D9B5B9927D485ECD64BA1E54617314656C073563A49F6919E41171BCAC9611F5`.

## Actual task and result

Crew extended the existing HAC-11 pgTAP script from `plan(9)` to `plan(14)`. The five new assertions check: authenticated INSERT denied; `REVOKED` without a revocation timestamp denied; `ACTIVE` with a revocation timestamp denied; zero-lifetime link denied; and an otherwise valid link hidden by RLS while its organization membership is `INACTIVE`. The source and migration support these expected outcomes by inspection. **They are not recorded as passing pgTAP tests**, because the local PostgreSQL stack was unavailable.

The membership test proves fail-closed access while membership is inactive. It does **not** prove permanent revocation of the link: if membership is reactivated and the link remains valid, access may resume. A separate explicit revocation test remains in the script.

## Verification and limits

| Check | Result |
| --- | --- |
| Kiro Crew used on a real HAC-11 file | Verified from session tool records and commit diff |
| Commit exists in the local branch | Verified: `c212c62` |
| `git diff --check` after the commit | Passed locally |
| V2 pgTAP `plan(14)` | **Blocked**: Docker Desktop Linux engine was not running; no pass count claimed |
| `pnpm test:mcp` / `pnpm typecheck` for this Crew commit | Not run by Crew for this SQL-only change; earlier Codex runs are separate |
| Human review and approval | Pending Axel / Tech Lead confirmation |
| Kiro UI screenshot | Not provided; local session JSONL and commit are the primary artifacts |
| Bedrock sandbox invocation by CargoMesh | Not demonstrated; Kiro backend throttling is not a CargoMesh Bedrock call |

The Kiro session reported a tool-approval timeout and a Docker API connection failure. These are truthful workflow limits, not successful database validation. No production Supabase, AWS IAM policy, or hosted runtime was modified as part of this evidence review.

## Product Feedback draft for Devpost (English)

> We used Kiro Crew as a development tool on CargoMesh V2's HAC-11 MCP account-link security work. Crew inspected the existing migration and pgTAP tests, then added five negative assertions covering direct INSERT denial, partial revocation, zero lifetime, and inactive organization membership. The resulting change is traceable to commit c212c62 and remains subject to human review. The local Crew session made the test gaps clear and produced a focused one-file change. Onboarding was hindered by a tool-approval prompt that timed out, and the local database test could not run because Docker Desktop's Linux engine was unavailable. We would use Kiro Crew again for bounded code and test tasks, while retaining human review and reproducible test gates. We do not claim a CargoMesh Bedrock runtime invocation from Kiro's own backend activity.

The official hackathon rules state that Kiro Crew can qualify as a development tool for the AWS Builder mini challenge without an additional runtime AWS service. The submission still needs documented usage, accurate Product Feedback, a working primary-track project, and the required demo. Source: <https://amazonappdev2026.devpost.com/rules>.

## Remaining evidence for HAC-30

1. Axel reviews and accepts or amends `c212c62`; record the review decision.
2. Start the HAC-29 V2 local bootstrap and run the pgTAP file; attach sanitized output showing real `14/14` or defects.
3. Export a genuine Kiro Crew UI screenshot, redact any account identifiers/secrets, and add it to the HAC-18 Drive index. Do not fabricate a screenshot from this markdown.
4. Link the Drive artifacts and the PR/commit in HAC-30. Keep Alexa+ and CargoMesh Bedrock claims separate.

## Later independent verification · 2026-10-03

The original Crew session remains recorded exactly as blocked. In a separate Codex review, the expired-link setup was found to violate the migration's valid-lifetime constraint; Codex corrected the test fixture and reran all HAC-11 pgTAP assertions against local Docker. The result was **14/14** with a clean rollback. This later correction and run are **not** Kiro Crew actions. See [HAC-11 execution evidence](../hac-11/HAC11_LOCAL_AUTH_AND_PGTAP_2026-10-03.md). Human acceptance of the Crew contribution and a genuine Kiro UI screenshot remain pending.
