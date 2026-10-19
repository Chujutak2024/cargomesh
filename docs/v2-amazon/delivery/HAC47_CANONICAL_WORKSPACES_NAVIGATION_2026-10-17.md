# HAC-47 / HAC-50 — canonical workspaces and navigation

Date: 2026-10-17. Existing branch `codex/unified-workspaces-demo-boundary`. Local implementation; no main push, merge, deployment, hosted data or permission change.

## Canonical routes

| Workspace | Entry | Examples |
|---|---|---|
| Landing | `/` | Direct Next links to both portals |
| Client | `/clients` | `/clients/requests`, `/clients/facilities`, `/clients/bookings`, `/clients/tracking`, `/clients/history` |
| Carrier | `/carriers` | `/carriers/fleet`, `/carriers/requests`, `/carriers/orders`, `/carriers/pipeline`, `/carriers/offers`, `/carriers/sites` |
| Experimental routing/map | Carrier namespace | `/carriers/control-tower`, `/carriers/route-lab`; existing preview/source labels remain |

The landing no longer selects Client visual demo mode. Legacy `/demo/shipper/...` bookmarks now redirect to the real Client portal. Fixtures/test-only demo APIs remain isolated in the repository; they are not substituted into the connected portal. Carrier-local demo links are absent from the canonical menu and fleet surface.

Existing Client pages are reused through thin route entry modules, not a second copy of the page logic. Their common Client layout persists between pages. A Client needs an active organization membership; Carrier authorization does not grant it. The tested browser session is Carrier-only and correctly sees **No Client access** at `/clients/requests`; the connected Client journey with an authorized Client account remains unverified in this task.

Carrier uses a persistent authenticated layout with server-validated initial Carrier access. Its menu updates the same document with browser history, keeping Carrier selection and using clean URL paths. Reloads/new tabs still validate server access. Back navigation works. Operational API calls retain their own authorization.

## Causes addressed

- Mixed inherited route models: actual Next paths for Client, legacy `v2-workspace` hash views for Carrier and an `/enter` redirect hop in landing links.
- Repeated Client identity reads within one server render: `requireAuthenticatedMember` now uses React request-render cache with primitive organization key. Required roles are still checked per call. There is no module-global user cache or cross-request authorization result.
- Carrier loaded its initial access on the server and fetched it again after mounting. The new layout passes the validated result into the workspace; Refresh still revalidates access.
- Commercial pages were keyed by `carrierId + view`, remounting and re-fetching opportunities/offers/bookings/executions on every section switch. The Carrier-keyed component now reuses its timestamped snapshot across these views, clears view-specific selection/filter/action UI, and refreshes after mutations or an explicit Refresh. Server version/authorization checks remain authoritative.
- Map, routing lab and legacy local demo coordinator are split into on-demand modules. Connected fleet loads its connected implementation, without eagerly mounting/importing the legacy fleet scene through that view.
- Landing entries use Next Link directly; their old `/enter` URL remains a fast compatibility redirect without an extra remote access lookup.

## Legacy redirects and local origin

Standard Next config redirects preserve the section/query and browser origin. Examples: `/dashboard` → `/clients`, `/requests/id` → `/clients/requests/id`, `/demo/shipper/requests?q=test` → `/clients/requests?q=test`, `/v2-workspace#/fleet` → `/carriers/fleet` after the client normalizes the inherited fragment. No arbitrary browser-supplied redirect target is accepted.

Browser verification caught a custom-dev-server constraint: a new middleware's absolute redirect normalized `127.0.0.1` to `localhost`, losing that host's session cookies; a relative Location was rejected by the middleware adapter. The new middleware was removed. Next core redirects now return relative Locations and retain `127.0.0.1`; this was checked through actual HTTP and browser session continuity. Canonical Carrier route synchronization reads the browser's current pathname for inherited fragments, rather than relying on Next's previous route state.

## Verification and limits

- Relevant Client, commercial, workspace path, origin, Carrier menu and login destination tests: **89 passed**. TypeScript and architecture checks passed.
- Actual browser: Carrier membership/selection preserved; clean Fleet/Requests/Orders URLs; Back; original legacy bookmark retains the 127.0.0.1 session and resolves to Fleet; Client access denied for the Carrier-only account.
- Requests click plus accessibility observation: **272 ms** in one local development observation, while data were still loading. Orders switch plus observation: **310 ms**, with the same loaded commercial snapshot/read timestamp. These are not p50/p95 measurements, full data-completion metrics or a before/after production benchmark.
- Before changes, unauthenticated HTTP observations: warm demo Requests 0.14–0.25 s; first History visit 1.67 s. These are server response observations, not interactive rendering time.
- Cold development compilation remains a limitation: the first Carrier navigation after restarting the custom Next server exceeded the browser tool's 17-second wait, then completed. Internal transitions are improved; the first dev compilation is not claimed instant. No production build/benchmark was run against the other chat's shared dev output.
- Existing CSS and Three.js assets were preserved. No auth bypass, account creation, role grants, new seed or hosted migration was used to demonstrate a screen.

Private local evidence: `salida/navigation-20261017/RESULTS.json`, test/type/architecture logs, `carriers-clean-routes.png`. Reproduce with `python salida/navigation-20261017/verify.py` from this task's saved artifact path; the script targets the explicitly recorded active checkout and existing local server.

Primary implementation references: [Next client navigation and streaming](https://nextjs.org/docs/app/getting-started/linking-and-navigating), [React request-render cache](https://react.dev/reference/react/cache). Installed Next/React behavior was verified locally; no dependencies were upgraded.
