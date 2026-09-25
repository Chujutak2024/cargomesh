# WebMCP freeze and V2 work separation — 23 September 2026

Status: operational recommendation, **not** proof that either deployed environment has been isolated. No GitHub, Vercel or Supabase settings were changed for this document.

## Decision for the team

The [WebMCP organizer update](https://webmcp.devpost.com/updates/46577-new-date-for-the-webmcp-challenge-winner-announcement-mon-sept-28th) moves the **winner announcement** to 28 September and instructs entrants not to edit the submission until winners are announced. It specifically recommends a fork for further work. The [earlier freeze reminder](https://webmcp.devpost.com/updates/46163-submissions-are-closed) names the video, repository and live site. This does not establish an exact new judging-end timestamp; use the announcement, not an assumed midnight on the 28th, as the release condition.

1. Identify the **exact** repository, submitted commit, video and live URL in Devpost. The V1 release evidence identifies `https://cargomesh.vercel.app` and `main` as its production baseline; confirm that these are the submitted artifacts. Keep them reachable and unchanged. Do not push V2 to `main`, merge V2 PRs into the submitted repository, promote a preview to the submitted domain, or change the existing Vercel project's production branch, root directory, aliases or environment variables while frozen.
2. Continue the same approved Linear issue/branch manifest, but in a **separate GitHub fork or repository**. Keep `codex/v2-amazon-contracts` as the logical V2 integration base there; bring over already-approved V2 commits/branches without rewriting the frozen submitted history. Future PRs and Gate-1/Gate-2 integration target that V2 base in the separate repository, not `main` or the submitted origin. The owner of each issue still delivers and fixes it; validation, Tech Lead approval and authorized merge remain distinct.
3. Create a **separate Vercel project and URL** for V2, connected to the separate repository. Set its root directory to `cargomesh/` only after confirming that this is the V2 Next.js app, and configure its production branch explicitly to the V2 base; keep feature branches as previews. Do not recycle `cargomesh.vercel.app`. A second Vercel account is unnecessary. Vercel [supports multiple projects from a repository](https://vercel.com/docs/projects) and [separate production/preview branch tracking](https://vercel.com/docs/git), but a separate project from the **same submitted repo** does not satisfy the organizer's repository-freeze instruction.
4. Isolate data as well as the URL. V2 development can use local Docker/Supabase. If a remote V2 environment is needed before the announcement, use a separate Supabase project and explicit V2-only Vercel environment variables; do not connect the new V2 deployment to the database behind the submitted live app. On a Free plan, do not assume Supabase preview branching is available: [Supabase documents preview branching as Pro-only](https://supabase.com/docs/guides/deployment). Never copy service-role secrets into browser variables. Validate callback URLs, CORS, OAuth redirects and MCP endpoint against the new V2 origin before calling it live.
5. Record the new fork, Vercel and database URLs/IDs in the deployment decision and Linear gate **after they are actually created**. This document does not authorize a deployment or a remote database change. If an already-pushed V2 branch or today's migration touched submitted infrastructure, do not erase or roll back history to hide it; freeze further changes, inspect read-only, and ask the organizer if eligibility is uncertain.

## Today's remote migration: bounded compatibility assessment

The linked Supabase project has migration history entries `20260918120000_c_draft_creation_idempotency` and `20260922053512_v2_road_facilities_services` (see [FL-02](./friction-logs/FL-02.md)). A read-only check on 23 September found **0** rows in each of `facilities`, `carrier_depots`, `service_areas` and `service_lanes`, while `FR-1042` still exists; its creation receipt and facility references remain null. No V2 seed was loaded by these migrations.

| Change | Static impact on the V1 WebMCP flow |
|---|---|
| Nullable creation receipt fields, conditional check/index/policy and update guard on `freight_requests` | Legacy requests with null receipt still satisfy the check and insert policy; updates that leave those fields null are not blocked by the new trigger. A V1 path that unexpectedly populates or mutates them would need separate verification. |
| Nullable origin/destination facility references | Existing V1 rows need no facility. No geography or coverage is inferred from the new fields. |
| Four new ROAD tables, indexes, RLS and triggers | They contain no rows; the migration does not delete/rename legacy carriers, services, requests or WebMCP functions. |

**Conclusion:** the SQL and current row counts show no direct deletion or required-field break for the known V1 scenario. That is **not** proof that the submitted live flow is unaffected. We have not confirmed the old Vercel project's Supabase project reference or rerun its full read-only/live WebMCP smoke after the migration. Do not run state-changing booking/reset tests against a frozen judging site merely to obtain that assurance. Preserve current state; if a judge-visible failure is reported, collect read-only evidence and coordinate any allowed repair with the organizer. A rollback would itself modify the submitted environment and is not warranted by this assessment.

## Immediate checklist

- [ ] Record the exact submitted repo, SHA, Vercel deployment/URL and database project used by that deployment; compare rather than assume they match the linked development project.
- [ ] Freeze the submitted Git remote, old Vercel project/domain and its backing data until the winner announcement.
- [ ] Decide and approve the fork/new repository and new V2 Vercel project; move the existing V2 base and issue branches there without new branch names invented outside Linear.
- [ ] Use local Docker or a separate V2 Supabase project before any further remote V2 migrations or scenario seeds.
- [ ] Verify the new V2 root directory, deployment variables and URL in an isolated smoke; record results in the gate.
