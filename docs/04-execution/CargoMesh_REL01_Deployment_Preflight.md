# CargoMesh REL-01 — Deployment preflight

> Status: preparatory work only. `REL-01` and `G4` remain open until `INT-03` is integrated and the public Golden Flow passes.

## 1. Release blockers visible on 2026-08-31

| Check | Current state | Required action |
|---|---|---|
| Repository visibility | **Blocked:** GitHub reports `PRIVATE` | Project owner changes it to `PUBLIC` only after the final secret scan |
| Open-source license | Prepared in this branch: MIT | Confirm GitHub detects it after integration |
| INT-03 | **Blocked:** replay P1 is being corrected through PR #26 and PR #24 | Integrate and repeat the real replay before freezing code |
| Public application URL | Pending | Configure the hosting project and production variables |
| Supabase production project | Pending confirmation | Link one controlled project and apply versioned migrations once |
| Git history secret scan | No hosted credential detected; two standard local `supabase-demo` tokens exist in old `.env.example` revisions | Enable GitHub secret scanning after making the repository public |

Changing repository visibility remains an owner decision. The preflight never performs it.

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

## 6. Gate G4 evidence package

After INT-03 closes, retain sanitized evidence for:

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
