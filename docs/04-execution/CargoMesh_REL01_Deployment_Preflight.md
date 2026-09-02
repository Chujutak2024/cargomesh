# CargoMesh REL-01 — Deployment preflight

> **Status:** active release gate, reconciled on 2026-09-02 against
> `main@ea3e37b`. `INT-03` and the D1 implementation are integrated; `D1-04`,
> `REL-01` and `G4` remain open until the current release SHA passes the public
> browser/WebMCP flow.

## 1. Release state

| Check | Current state | Required action |
|---|---|---|
| Repository visibility | **Complete:** GitHub reports `PUBLIC` | Keep secret scanning enabled and repeat the final history scan |
| Open-source license | **Complete:** root `LICENSE` exists | Confirm GitHub continues detecting it on the release SHA |
| INT-03 / D1 code | **Integrated:** booking/recovery and the editable/recommendation intake are in `main` through PR #53 | Revalidate the combined flow as `D1-04` on the release deployment |
| Release SHA | Not frozen; documentation and approved UX work remain in progress | Freeze one `main` SHA before collecting final evidence |
| Public application URL | Deployment infrastructure exists; the final production HTTPS origin and deployed SHA still require confirmation | Record the exact URL/SHA and remove deployment protection for judges |
| Supabase production project | Previously configured during integration; current migration history, demo membership and reset state still require release verification | Verify the linked project without printing credentials or reapplying unreviewed scenario data |
| Git history secret scan | No hosted credential was reported in the previous preflight; local `supabase-demo` tokens are not production credentials | Repeat the scan on the frozen release history |

Repository visibility is already public. This preflight does not change visibility,
repository settings, deployment protection or remote database state.

## 2. Recommended deployment shape

Use one production CargoMesh deployment with `frontend` configured as the hosting root. The seeded provider paths (`/providers/andes`, `/providers/inca`, `/providers/pacific`) can run on that same HTTPS origin; the external-navigation adapter remains available for separately hosted registered providers.

For Vercel:

- Root Directory: `frontend`
- Framework preset: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Node.js: 22 or newer
- Production branch: `main`

Do not promote a preview URL to the final demo URL. WebMCP `exposedTo`, Supabase Auth redirects and the provider registry must agree on the final origin.

## 3. Production variables

| Variable | Scope | Rule |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Exact HTTPS project origin |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Supabase publishable key or legacy anon key; never a secret/service-role key |
| `NEXT_PUBLIC_CARGOMESH_TOOL_CALLER_ORIGINS` | Browser bundle | Comma-separated exact HTTPS origins; no wildcard, path, query or credentials |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Hosting secret; never prefix with `NEXT_PUBLIC_` |
| `CARGOMESH_RELEASE_URL` | Operator shell only | Used by release scripts; exact public HTTPS origin |

Store production values in the hosting platform. Never commit `.env.local`, service-role keys, database passwords or Supabase access tokens.

## 4. Supabase production setup

1. Use a dedicated hosted project; do not expose the local Docker instance.
2. Set the Auth Site URL to the final CargoMesh HTTPS origin.
3. Add only required callback/redirect URLs. Keep localhost entries for local development, not as the production Site URL.
4. Apply database changes exclusively from `supabase/migrations` after checking migration history; do not make production schema edits in the Dashboard.
5. Apply only the reviewed baseline/demo dataset required by the release. Optional
   scenario packages under `supabase/scenarios/` require explicit approval and must
   not be disguised as migrations or production activity.
6. Run Security Advisor and confirm RLS on every exposed `public` table.
7. Keep one operator responsible for the production migration push.

The current Supabase CLI changelog also requires checking Data API exposure explicitly for new tables; RLS and Data API grants are separate controls.

## 5. Automated preflight

From `frontend`, after setting production variables without printing their values:

```powershell
pnpm install --frozen-lockfile
pnpm release:verify
pnpm release:smoke
```

`release:preflight` fails when:

- a required variable is missing or still a placeholder;
- a production origin is not exact HTTPS;
- the WebMCP allowlist omits the release origin or contains a wildcard;
- the repository has no license;
- the production bundle is absent;
- `.next/static` contains privileged Supabase markers or the configured service-role value.
- Git history contains a hosted Supabase JWT or `sb_secret_` credential. Standard CLI-local tokens with issuer `supabase-demo` are identified separately and are not hosted credentials.

`release:smoke` checks the landing page, login and a seeded provider page over the public URL. It does not replace the browser/WebMCP E2E.

### Latest integrated verification

PR #53 records 188/188 frontend release tests plus successful `typecheck` and
production build on `main@ea3e37b`. That PR did not establish a new final pgTAP,
database lint, secret-scan or public-browser result for the eventual release SHA.

Do not reuse old test counts as if they described a newer deployment. After the
release SHA is frozen, rerun the complete frontend, database, preflight, smoke and
browser/WebMCP matrix and attach its sanitized output.

## 6. Gate G4 evidence package

With INT-03 closed, retain sanitized evidence for:

1. `main` SHA and public URL;
2. clean incognito login with an ACTIVE member;
3. `getTools()` and `executeTool()` on the deployed provider page;
4. Golden Flow 89/84/72 and confidence 88;
5. booking confirmation plus reject/recovery;
6. closed replay without additional navigation or duplicated rows;
7. cleanup with zero provider tools after leaving the page;
8. typecheck, build, pgTAP, `db lint`, bundle scan and public smoke output;
9. public repository and detected license;
10. reset followed by a second successful run.

Only after all ten items pass may C mark `REL-01` and `G4` complete.
