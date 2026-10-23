# Sign out returns home — 22 Oct 2026

User-requested local fix: successful sign out returns to `/`, not `/login`.

- Updated the shared POST `/api/auth/logout` used by Client and Carrier.
  Supabase sign-out, demo-local scope, origin checks, failure responses and
  `no-store, private` are unchanged. Redirect remains a fixed 303 destination.
- Local/hosted Client preview exit still expires its preview cookie, now returning
  to `/`. Preview entry still opens `/clients`.
- The login route is retained for explicit credential authentication; no access
  control, membership, demo authorization or session protection was removed.
- Added actual route-handler tests to `test:auth` and `test:workspace-demo`, covering
  real/demo scope, successful exit, failed sign out, hostile origin, preview cookie
  expiry and unchanged preview entry.

Verification: `pnpm test:auth` 13/13, `pnpm test:workspace-demo` 46/46,
`pnpm typecheck` and `git diff --check` passed. Browser Client "Cerrar sesión"
submitted the form and reached the public home at `http://127.0.0.1:8080/`.
The page remains there, offering Shipper and Carrier entry.

QA limit / friction: attempting a separate Carrier entry afterwards remained in
the existing slow-entry loader. Carrier's individual button was therefore not
rechecked in the browser; its shared logout handler is covered by the route tests.
No loader/session-entry workaround was added to this scoped sign-out change.

Screenshot: local artifact `client-dashboard-mockup-2026-10-22/sign-out-home.jpg`.
No push, deployment, credentials or database changes in this follow-up.
