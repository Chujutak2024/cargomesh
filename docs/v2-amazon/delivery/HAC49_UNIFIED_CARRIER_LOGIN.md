# HAC-49 — Unified Carrier entry and local launch

Verified 2026-10-14. Working branch: `codex/unified-workspaces-demo-boundary`. This increment remains local; no main merge or production deployment.

## One active application

App directory: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh/cargomesh`.

From this directory run:

```powershell
node scripts/dev-local.mjs
```

The launcher reads this app's ignored `.env.local`. It has no runtime dependency on another checkout or an external login proxy. It checks port 8080 before preparing a build, avoiding a second simultaneous Next compiler.

| Entry | Destination / behavior |
| --- | --- |
| `http://127.0.0.1:8080/` | Landing with Shipper and Carrier choices. |
| `/enter?portal=carrier` without a Carrier session | `/login?returnTo=%2Fv2-workspace%23%2Ffleet`. |
| Same entry with an authorized Carrier session | `/v2-workspace#/fleet`. |
| `/carrier-portal` | Retired alias redirects through `/enter?portal=carrier`. |
| `/v2-workspace` without authorized session | Approved Oops illustration, English text and Sign in link; no coordinator rendered. |
| `/enter?portal=shipper` | Existing explicit read-only Shipper demo when enabled; connected destination otherwise. |
| `/carrier-control-tower`, `/carrier-route-lab` | Existing explicit local preview pages in the same app. |
| Old `127.0.0.1:3090` bookmark | GET/HEAD redirects to 8080 in the same Node process; no second frontend build. Other methods return 410. |

Historical Shipper/Carrier/map launcher scripts under `salida/` are preserved and are not the current entry point. Automatic approval review rejected overwriting launchers belonging to other chats because that could interfere with their work. The safer implementation uses this new launcher and documents its app directory; no historical launcher was overwritten. Do not use historical snapshot launchers for the current front.

## Root causes corrected

1. The landing skipped login and opened the guarded fleet directly, displaying Oops. Entry now resolves session access first and goes to login when needed.
2. Private login defaults depended on a 3907 proxy. The integrated `/api/local/login-defaults` endpoint now serves the existing synthetic demo account only when opted in, in development, on loopback port 8080, from the same-origin login referrer. Cross-origin/unrelated requests fail closed; production/default-disabled returns 404.
3. The previous unified launcher loaded a different Supabase environment. The already working hosted demo URL/public key and existing Maps browser key are consolidated in this app's ignored local configuration. No users, passwords, grants or database schema were changed. No service-role key is loaded.
4. Carrier login returned through the retired basic portal and used a browser-side demo-email override. The shared closed whitelist now includes `/v2-workspace#/fleet`; authorized Carrier logins return directly there. The email override was removed.
5. Fresh local requests waited for a retired 8083 draft-transfer iframe. Initialization now uses same-origin saved/legacy data synchronously, preserving immutable originals and edits. Seven predefined request examples still load.
6. Carrier local examples attempted to read Shipper freight APIs. While local records are active or still initializing, those reads are skipped. Connected reads still require their original permissions.
7. The approved Oops screen was hardcoded in Spanish. Its English UI is now consistent with the landing and login.

## Auth and secrets

The server still validates the Supabase user and persisted Carrier access. Explicit Carrier destinations require a Carrier grant even if the user is a Shipper member. Return paths are a closed enum; arbitrary origins/fragments are rejected. Existing authorization of the historical generic workspace and Shipper endpoints was not expanded.

`CARGOMESH_LOCAL_LOGIN_EMAIL` and `CARGOMESH_LOCAL_LOGIN_PASSWORD` are server-side private settings, never `NEXT_PUBLIC_` values. The user's existing authorization to prefill a synthetic local demo account is retained. Defaults use `no-store, private` and `nosniff`. They are not embedded in server-rendered page HTML or the client bundle. `.env.local` is ignored by Git; no credential values were logged or committed.

Implementation follows Supabase's [SSR cookie guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) and [password sign-in API](https://supabase.com/docs/reference/javascript/auth-signinwithpassword). Server authorization uses validated `getUser`, not unverified `getSession` contents. No auth-library version changes were necessary. Changelog checked: [official changelog](https://supabase.com/changelog).

## Retired branch

User authorized removal of the previous Carrier branch while preserving the recently created unified work. `codex/v2-carrier-preview-map` was removed locally and remotely after checking:

- PR #126 is merged into main.
- Its exact head was `b3b4fd4cd3b4eb9b974b07d7ebd4b11428e7c28e`.
- The same remote SHA still existed immediately before deletion.
- That commit is an ancestor of the current unified branch; it has no unique unincorporated commits.
- No worktree had it checked out.

The recent unified branch remains. Main was not changed. Historical main/other worktrees are not used by the active launcher and were not deleted because they contain other work and configuration history.

## Verification

- **30/30 unit/regression tests:** private defaults, return-path whitelist, Carrier permissions, login access, cookie origin, password login and same-origin predefined request restoration.
- **Typecheck passes.** Architecture: **366 modules, 95 client entry points**.
- **14/14 real local HTTP checks:** anonymous entry/login/defaults restrictions, actual Supabase login and session cookie, full workspace, authenticated Carrier API, legacy entry/port redirects, logout, protected Oops state and signed-out API 401.
- **Browser:** login fields prefilled without printing their contents; sign in reaches Fleet with 12 vehicles; Requests shows 7 saved examples and global city pairs; sign out returns to login; browser Back shows protected English Oops rather than cached operational content; sign in again reaches Fleet.
- **Process/config checks:** 8080 and redirect 3090 have the same owning PID; private env is ignored; old branch has no local/remote ref.

Commands from app directory:

```powershell
node --conditions=react-server --import tsx --test src/server/auth/local-login-defaults.test.ts src/server/auth/login-access.test.ts src/shared/schemas/v2/carrier-entry.test.ts src/features/carrier-portal/permissions.test.ts src/server/auth/session-origin.test.ts src/features/auth/password-login.test.ts src/features/carrier-portal/local-request-demo.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-architecture.mjs
```

Detailed local evidence: `C:/Users/HP/Documents/cargomesh/salida/carrier-login-unified-20261014/login-results.json`. The verification script keeps credentials/cookies only in memory. Existing sample routes remain simulations; this login correction does not certify Google Routes city-pair calculations or truck access. Missing server Routes credential remains the separately documented HAC-48 dependency.

Independent external human review and publication of the combined local frontend work remain pending. Concurrent navigation, UI and routing edits from the other chats were preserved; no mixed commit was created as part of this fix.
