# CargoMesh MCP local preview

Implemented: `/mcp` on the Next.js Node runtime, official SDK `1.30.0`, tested protocol `2025-11-25`, stateless Streamable HTTP with JSON responses. Two registered tools call shared feature services directly: `get_freight_options` reads persisted orchestration; `create_freight_request` creates an idempotent DRAFT. Neither uses Hono HTTP, starts runs, contacts providers or books freight.

The SDK retains its protocol negotiation behavior for older supported clients. Compatibility testing here targets 2025-11-25. No MCP sessions, standalone SSE subscriptions, OAuth, bearer authentication, Alexa, AWS or Bedrock integration are implemented.

| MCP tool | Current state |
| --- | --- |
| `create_freight_request` | Implemented; real `/mcp` → service → authenticated member → local Supabase INSERT and persisted-row read verified. |
| `get_freight_options` | Implemented read adapter; protocol/service tests pass, but no local persisted orchestration run was available for a live read smoke test. |
| `find_freight_options` | Proposed contract; not registered. |
| `authorize_and_book` | Proposed contract; not registered. |
| `get_booking_status` | Proposed contract; not registered. |
| `recover_booking` | Proposed contract; not registered. |

## Start locally

Use the project's existing local Supabase configuration and an authenticated CargoMesh member. `supabase/seed.sql` already provisions the local demo SUPERVISOR; the optional `supabase/scenarios/mcp-local/seed.sql` provisions a REQUESTER for the denial test. Neither is production data.

Creation requires [the idempotency migration](../../../../supabase/migrations/20260918120000_c_draft_creation_idempotency.sql) applied to the intended database. It was applied to the local Supabase database for this verification; no remote `db push` was run. PostgreSQL checks are in [test 08](../../../../supabase/tests/08_draft_creation_idempotency.test.sql). The local database contains zero orchestration runs, so the authenticated M1 existing-run smoke test remains pending.

## Creation contract

`create_freight_request` accepts `{ idempotencyKey: UUID, fields: ... }`; use the full explicit schema in [MCP_TOOL_CONTRACTS.md](../../../../docs/architecture-v2/MCP_TOOL_CONTRACTS.md). It requires an active OWNER/SUPERVISOR and creates ROAD/FTL/BALANCED, PALLETS/SCHEDULED drafts. Save one key per intended request and resend the same fields on retries. Another payload with that key produces `IDEMPOTENCY_CONFLICT`. A replay returns the original request's current status/version with `replayed: true`; it does not revert it to DRAFT. Creation neither submits the request nor authorizes a booking.

Keys are scoped to organization/member and retained while the request exists. Administrative deletion removes that protection. Concurrent deduplication relies on PostgreSQL's unique index; the TypeScript concurrency tests inject storage and do not prove live RLS/database behavior.

From `cargomesh/` in PowerShell:

```powershell
$env:CARGOMESH_MCP_LOCAL_ENABLED = 'true'
pnpm dev --hostname 127.0.0.1
```

Open CargoMesh at the same loopback origin as the development server and sign in. The feature flag is server-only and defaults off. The endpoint returns 404 outside development/test, even when the flag is true. `pnpm start` therefore does not enable this local preview. Keep the development server bound to loopback; do not expose it through a tunnel/proxy.

Every request, including initialize/list, requires the current CargoMesh cookie session. The domain read independently checks session, RLS visibility and organization membership. A Bearer header is not a session. Remote clients without cookie integration are not supported until the auth milestone; do not distribute browser cookies or add a service-role bypass.

## Read from the signed-in local browser

In the browser developer console on that CargoMesh origin, use same-origin fetch so the browser sends its session automatically:

```javascript
async function mcp(message) {
  const response = await fetch('/mcp', {
    method: 'POST', credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-11-25',
    },
    body: JSON.stringify(message),
  });
  return response.status === 202 ? null : response.json();
}

await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2025-11-25', capabilities: {},
  clientInfo: { name: 'cargomesh-local', version: '1.0.0' },
}});
await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' });
await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
// Supply an actual persisted run UUID visible to the signed-in organization.
await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
  name: 'get_freight_options', arguments: { runId: 'YOUR_EXISTING_RUN_UUID' },
}});
```

Tool success is `{ ok: true, data: OrchestrationViewModel }` in structuredContent and a matching text block. Status is loading, success, NO_MATCH or error; it is the persisted view status, not a new workflow transition. Technical warning/error diagnostics are replaced with safe messages/codes. Unknown output fields are removed and output/correlation validated. Domain failures have isError true and `{ ok: false, error: { code, message } }`; invalid tool arguments are rejected by the SDK before domain dispatch.

HTTP gates: 404 disabled/production, 403 invalid local Host/Origin or forbidden member, 401 unauthenticated, 405 for authenticated GET/DELETE (Allow: POST), 413 body over 64 KiB. SDK handles protocol/content-type/Accept validation. Responses are no-store. There are no CORS allowances. Host/Origin validation complements loopback binding; it is not a substitute for it.

## Verification

```powershell
pnpm test:mcp
pnpm typecheck
pnpm test:release
pnpm build
```

The default tests exercise the handler, SDK client/server/transport and existing pure view-model builder with injected auth/database boundaries. The separate `pnpm test:mcp:local` test exercises the running Next route, real Supabase session and RLS, service insertion, row readback, replay/conflict and failure cases. It is intentionally excluded from `test:mcp` because it needs local Docker and a running Next development server. No remote database or provider calls are made.

The build registers `/mcp` but the handler remains disabled in production. The local integration test confirmed a persisted DRAFT with expected organization/member, route, cargo and strategy using an authenticated SUPERVISOR, plus anonymous denial, REQUESTER denial, invalid input, idempotent replay/conflict, and a database INSERT failure whose SQL detail stayed private. It uses new UUIDs for each run and deletes only its own draft afterward through local Docker SQL so the Golden Flow pgTAP fixture remains intact. No provider smoke test was run.

To reproduce the local integration test, work from the repository root to start Supabase and apply the migration **locally**. Apply [the requester scenario seed](../../../../supabase/scenarios/mcp-local/seed.sql) to the local database only. In one PowerShell terminal from `cargomesh/`, obtain `API_URL` and `ANON_KEY` from `supabase status -o json`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, set `CARGOMESH_MCP_LOCAL_ENABLED=true`, then run `pnpm dev --hostname 127.0.0.1 --port 3100`. In a second terminal set the same two Supabase variables and `CARGOMESH_MCP_TEST_PASSWORD` to the local-only password in `supabase/seed.sql`, then run `pnpm test:mcp:local`. Docker must be available for the exact-ID local cleanup. The test refuses non-loopback app or Supabase URLs. Run `supabase test db` from the repository root for pgTAP. The local test is a separate opt-in command and must never target hosted Supabase.

Later tools remain unregistered until their documented submission, executor, approval and auth dependencies are implemented. See [contracts](../../../../docs/architecture-v2/MCP_TOOL_CONTRACTS.md).
