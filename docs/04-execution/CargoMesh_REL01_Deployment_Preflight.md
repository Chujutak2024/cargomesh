# CargoMesh REL-01 — Deployment preflight

> Status: production release verified. The public same-origin demo and the external-provider contract are documented separately so the evidence does not imply independently hosted carrier partners.

## 1. Release status verified on 2026-09-03

| Check | Current state | Ongoing rule |
|---|---|---|
| Repository visibility | **Complete:** public repository | Keep secret scanning enabled |
| Open-source license | **Complete:** MIT license detected in the repository | Preserve the license in release branches |
| INT-03 | **Complete:** replay, rejection/recovery and cleanup verified | Preserve the sanitized evidence |
| Public application URL | **Complete:** `https://cargomesh.vercel.app` | Use this exact origin in public evidence |
| Supabase production project | **Complete:** hosted project configured with RLS and versioned migrations | Never apply unreviewed Dashboard schema edits |
| WebMCP public UAT | **Complete for the CargoMesh same-origin demo:** five provider tools, Golden Flow, booking, replay, recovery and cleanup recorded | Do not describe same-origin demo providers as independently hosted partners |
| External-origin readiness | **Contract/harness verified; independent public carrier origin not claimed** | Run a separate public cross-origin UAT when a registered external provider is deployed |
| Git history and bundle scan | No hosted privileged credential detected | Repeat before every public release |

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
| `CARGOMESH_DEMO_LOGIN_EMAIL` | Server only | Hosted demo identity used only by the one-click login route |
| `CARGOMESH_DEMO_LOGIN_PASSWORD` | Server only | Rotatable hosted demo password; never send it to the browser or reuse the local seed password |
| `CARGOMESH_RELEASE_URL` | Operator shell only | Used by release scripts; exact public HTTPS origin |

Store production values in the hosting platform. Never commit `.env.local`, service-role keys, database passwords or Supabase access tokens.

## 4. Supabase production setup

1. Use a dedicated hosted project; do not expose the local Docker instance.
2. Set the Auth Site URL to the final CargoMesh HTTPS origin.
3. Add only required callback/redirect URLs. Keep localhost entries for local development, not as the production Site URL.
4. Apply database changes exclusively from `supabase/migrations` after checking migration history; do not make production schema edits in the Dashboard.
5. Apply the deterministic demo seed only if the target project is dedicated to the hackathon demo.
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

### Latest verification baseline

The integrated release baseline was verified with:

- 238/238 release tests;
- `pnpm typecheck` and `pnpm build`;
- 147/147 pgTAP tests after a local-only reset;
- `supabase db lint --local` with no error findings;
- `release:preflight` 17/17, including private demo-login configuration and bundle non-exposure;
- 34 generated Next.js routes;
- public HTTP checks for the three canonical provider pages and their five registered tools.

The canonical public URL is `https://cargomesh.vercel.app`. Sanitized browser evidence is recorded in [`REL02_Public_WebMCP_UAT_Evidence.md`](./REL02_Public_WebMCP_UAT_Evidence.md). Video recording and Devpost submission are intentionally handled as a later, separate activity.

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

Items 1–10 have production or reproducible local evidence. Any new deployment SHA must repeat the automated preflight, public smoke and clean-browser WebMCP checks before replacing the verified release baseline.
