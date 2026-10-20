# HAC-54 — Local access resolved, October 20

## Scope and authorization

After the H2 delivery, the user explicitly authorized creating the missing test access and clarified that testing must use **local services only**. No hosted service, production credential, deployment or shared identity implementation was changed.

The earlier credential limitation described configuration, not absence of accounts. Inspection found an existing Client Auth user/member. Its existing local scenario password was verified without resetting it. Therefore asking the team to supply that password was unnecessary. This follow-up supersedes that local-access blocker, but does not claim the remaining H2 voice/positive commercial acceptance work is complete.

## Provisioning

- App: `http://localhost:3000`, existing dev server in this checkout.
- Supabase: `http://127.0.0.1:61321`, gateway/database containers `supabase_kong_cargomesh-v2-local` / `supabase_db_cargomesh-v2-local`.
- Existing Client: `qa-v2-a@cargomesh.test`, active SUPERVISOR in organization `c2300000-0000-4000-8000-000000000001`. Password and membership unchanged.
- New synthetic local Carrier user: `hac54.carrier.local@cargomesh.test`, Auth ID `952ff6dc-54e9-422f-ba59-4f45a61100b7`.
- Synthetic operator ID: `d54c0000-0000-4000-8000-000000000001`, role OPERATOR, active and verified against the local confirmed Auth identity; no Client membership.
- Existing synthetic Carrier: `c2340000-0000-4000-8000-000000000001`, `[SYNTHETIC] QA ROAD carrier`.
- Separate server-owned `CARRIER_EDITOR` grant valid seven days from provisioning. No ADMIN grant, no unrelated account/password changes.

The reproducible, explicitly local-only runner is `cargomesh/scripts/hac54-local-access.mjs`. The identity fixture and its safeguards are in `supabase/scenarios/v2-hac54-local-access/`. Auth signup/password login use the actual local Supabase API. Only the explicit synthetic operator/grant bootstrap uses local SQL; no commercial record is inserted and no guard is disabled. Passwords/tokens are never included in the runner's output or this delivery.

## Focused checks actually executed

The final runner invocation passed against the running app and local database, using real independent password sessions and native HTTP endpoints, not injected responses:

| Check | Observed result |
| --- | --- |
| Client password login and request read | PASS; HTTP 200, five persisted requests |
| Carrier password login and portal identity | PASS; authorized OPERATOR for the exact Carrier |
| Carrier opportunity read | PASS; HTTP 200, one persisted opportunity |
| Anonymous request read | Expected HTTP 401 |
| Client attempts Carrier opportunity read | Expected HTTP 403; Client membership is not Carrier authority |
| Carrier attempts Client request collection | Expected HTTP 403; no inferred organization membership |
| Client and Carrier read the same commercial records | Request `37bbd439-cbb7-41bc-b1a3-ad57451ff12b`, opportunity `fd472535-6777-491c-a286-a11c1b0df7f0`, offer `e934c985-4ee4-4d75-9742-fbbf8c755429`; exact IDs match both projections |
| Actual H2 `refreshRequestCommercial` and context checks | PASS against real HTTP; catalog returns the actual synthetic Carrier name; offer attribution chain is linked |
| Actual old quote/ranking state | Correctly unavailable with `EXPIRED`. No dates, prices or states were altered to manufacture a positive case |
| Independent cookie SSR requests | HTTP 200 at `/clients/requests`, `/carriers/requests` and the correlated Client request detail; current `commercial-title` comparison rendered in detail |
| Runner syntax / whitespace | `node --check` and `git diff --check` PASS |

The first SSR check used a nonexistent `/carriers/commercial` path and correctly returned 404. Source inspection established `/carriers/requests` as the existing commercial route; the runner was corrected, not the application routing. The final scoped run passed. No broad release/UI suite was rerun.

These are authenticated HTTP/SSR and real-data attribution checks, not interactive browser/audio validation. The old expired dataset is a legitimate negative case, not proof of a newly issued, current quote. CP-L2 still needs a fresh eligible transaction/Carrier-issued quote and the pending shared voice-context work; deterministic commercial scenario construction remains H4. Both usable accounts are retained for the user's local browser testing.
