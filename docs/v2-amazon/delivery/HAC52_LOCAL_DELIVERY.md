# HAC-52 local Client delivery

Initial base: `c7e394db3c0d2d135011ad601df161cf05b61620`.
PR: https://github.com/Chujutak2024/cargomesh/pull/132.
Contract: [Client identity and Facilities](HAC52_CLIENT_IDENTITY_CONTRACT.md).

## Local startup

Run from the HAC-52 worktree root in PowerShell. Docker Desktop must be running.
This creates only `cargomesh-hac52-local`, with API 64621 and DB 64622.
The project/bank identity is checked; no existing bank is reset or copied.

```powershell
node scripts/hac52/provision-local.mjs C:\Users\Usuario\Documents\Proyectos\hac52-local-bank C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json
$env:CARGOMESH_HAC52_ACCESS_FILE='C:\Users\Usuario\Documents\Proyectos\hac52-private\client-access.json'
Set-Location cargomesh
node scripts/dev-client-local.mjs
```

Open http://127.0.0.1:59580/api/local/hac52/client-session and press
**Open connected Client workspace**. The server signs in the synthetic local
Client using the private access file; credentials are never returned in the page.
The convenience route is unavailable outside this exact non-production profile,
endpoint and loopback host. Its POST requires the same origin. The normal
Client/Carrier login flow is retained. Auth uses its own HAC-52 cookie name.

The private access file is outside Git, restricted to the current Windows user,
and contains only local account access plus the local anonymous API credential.
Never paste it into reports. Provisioning reuses its password and membership IDs;
it does not rotate credentials, create remote users, use service role in the
browser, or authorize from user-editable metadata.

## H1 validation

- `node --conditions=react-server --import tsx --test src/server/auth/client-preview-selection.test.ts src/server/auth/local-client-preview-policy.test.ts src/server/auth/login-access.test.ts` (from `cargomesh/`): 12 passed, 0 failed.
- `node --conditions=react-server --import tsx --test src/server/db/supabase/local-profile.test.ts src/server/auth/client-preview-selection.test.ts` (from `cargomesh/`): 4 passed, 0 failed.
- `pnpm typecheck` (from `cargomesh/`): exit 0 at the H1 implementation cut.
- `node scripts/hac52/verify-h1.mjs ABS_EXTERNAL_EVIDENCE_JSON` verifies the
  live local HTTP session, anonymous/foreign-origin rejection, real organization
  identity and a persisted facilities collection. Executed with external output
  `C:\Users\Usuario\Documents\Proyectos\hac52-evidence\h1-http.json`: 7 checks
  passed, exit 0. The connected page returned 200 and displayed the persisted
  organization and member names, without Alex Morgan.

No new migration is required for H1. All active base migrations are applied only
to the task-owned bank. No hosted rollout has been performed. Hosted prerequisites
for H1 are: an approved synthetic Auth account, an isolated active organization and
an active organization member linked by the administrator; deploy the Client
preview-selection fix. Do not deploy local convenience credentials or enable its
local-only profile on hosted environments.

## Environment friction

Windows excludes ports 59452–59551. The first bank start on 59522 failed with
`LegacyContainerStartError` / socket access denied. Read-only inspection of the
reserved ranges and actual bind probes confirmed 64620–64629 and app port 59580
available. The bank uses 64621/64622. No reservation, firewall, TLS setting or other
bank was changed.

Linear became connected during H2. HAC-52 and HAC-51 were read; the registered
branch and current October 19 plan agree with this task. No issue state or
content has been changed.
Human CP-J1..J3 validation remains scheduled for October 21.

## H2 connected editors

Open `/clients/facilities` to list, create, select details and revise addresses,
coordinates, local hours and restrictions. A copied `?facility=UUID` opens the
same saved detail after a reload. Open `/clients/organization` to revise the
organization, create/revise cargo profiles with unit templates, and manage the
existing organization transport preferences. All controls reuse
`components/ui`; the shell, sidebar, shared filters and assistant files are
unchanged. Preview pages remain separate. No persisted operation falls back to
fixtures after an error.

Creation/revision keys are retained when a command is retried after a network
failure. Invalid fields retain input; stale versions retain input and provide
**Reload latest (discard edits)**. The next save uses the reloaded version.
Code conflicts remain editable. Lists consume offset pagination, including the
valid empty case. Role restrictions are reflected in the controls and enforced
again by existing database commands/RLS.

New migration: `20261020000100_hac52_facility_civil_hours.sql`. It replaces only
the Facility validator implementation while preserving its OID, existing CHECK
constraint, command and grants. It accepts closing at 24:00, validates IANA names,
disallows overlap, and retains restriction validation. No historical migration
or request-planning/Carrier Depot implementation was changed.

Executed evidence:

- `pnpm --dir cargomesh typecheck`: exit 0 after the connected editors.
- From `cargomesh/`: `node --conditions=react-server --import tsx --test src/features/shipper-portal/client-settings-api.test.ts src/server/modules/facilities/application/facility-service.test.ts src/server/modules/organizations/application/organization-service.test.ts`: 9 passed, 0 failed.
- `node scripts/hac52/verify-h2.mjs C:\Users\Usuario\Documents\Proyectos\hac52-evidence\h2-http.json`: 13 passed, exit 0 against real local HTTP/API/SQL.
- The HTTP checks include create/replay, payload conflict, invalid coordinates,
  revision, stale-version 409, re-read of midnight hours, active-only intake,
  cargo unit persistence and organization revision/readback.
- Retained inactive controls: Facility `445a6a7a-c888-40c0-b66c-7361ef16d0c1`,
  profile `4141c03e-86bb-4470-a880-4014e6300c72`. They are outside the H3 manifest
  and are not commercial seed data; no cleanup deletion was performed.

Hosted prerequisites for H2: review/apply the new migration after the existing
chain, deploy the connected pages and provision Client membership as above.
No hosted migration or seed was executed. Build and the H3 adapter/seed checks
are recorded with the final implementation cut. Human validation is pending
October 21; HTTP checks are technical verification only.

H3 seed, assistant contracts, final build evidence, exact hosted prerequisites
and completed authorized BO/CL access recovery are recorded in [the handoff](HAC52_HANDOFF.md).
