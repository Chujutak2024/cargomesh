# CargoMesh MCP local preview (Milestones 1–2)

Implemented: `/mcp` on the Next.js Node runtime, official SDK `1.30.0`, tested protocol `2025-11-25`, stateless Streamable HTTP with JSON responses. Two registered tools call shared feature services directly: `get_freight_options` reads persisted orchestration; `create_freight_request` creates an idempotent DRAFT. Neither uses Hono HTTP, starts runs, contacts providers or books freight.

The SDK retains its protocol negotiation behavior for older supported clients. Compatibility testing here targets 2025-11-25. No MCP sessions, standalone SSE subscriptions, OAuth, bearer authentication, Alexa, AWS or Bedrock integration are implemented.

## Start locally

Use the project's existing local Supabase configuration and an existing authenticated CargoMesh member. This implementation does not provision users or seed runs.

Creation additionally requires [the idempotency migration](../../../../supabase/migrations/20260918120000_c_draft_creation_idempotency.sql) applied to the intended local database. The migration was tested in a rolled-back local transaction and has not been applied permanently. Do not run a remote `db push` as part of local testing. PostgreSQL checks are in [test 08](../../../../supabase/tests/08_draft_creation_idempotency.test.sql); they require the existing local ACME/FR-1042 scenario and roll back their test rows. Docker was started successfully. All 13 SQL assertions passed on local PostgreSQL 17.6, including duplicate keys, immutable receipts, manager-only writes, member spoofing and anonymous denial. The local database contains zero orchestration runs, so the authenticated M1 existing-run smoke test remains pending.

## Creation contract

`create_freight_request` accepts `{ idempotencyKey: UUID, fields: ... }`; use the full explicit schema in [MCP_TOOL_CONTRACTS.md](../../../../docs/architecture-v2/MCP_TOOL_CONTRACTS.md). It requires an active OWNER/SUPERVISOR and creates ROAD/FTL/BALANCED, PALLETS/SCHEDULED drafts. Save one key per intended request and resend the same fields on retries. Another payload with that key produces `IDEMPOTENCY_CONFLICT`. A replay returns the original request's current status/version with `replayed: true`; it does not revert it to DRAFT. Creation neither submits the request nor authorizes a booking.

Keys are scoped to organization/member and retained while the request exists. Administrative deletion removes that protection. Concurrent deduplication relies on PostgreSQL's unique index; the TypeScript concurrency tests inject storage and do not prove live RLS/database behavior.

From `cargomesh/` in PowerShell:

```powershell
$env:CARGOMESH_MCP_LOCAL_ENABLED = 'true'
pnpm dev --hostname 127.0.0.1
```

Open CargoMesh at `http://localhost:3000` and sign in. Use that same origin for MCP requests. The feature flag is server-only and defaults off. The endpoint returns 404 outside development/test, even when the flag is true. `pnpm start` therefore does not enable this local preview. Keep the development server bound to loopback; do not expose it through a tunnel/proxy.

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

Tests exercise the actual handler, SDK client/server/transport and existing pure view-model builder. Only authentication and the database service boundary are injected. They cover protocol negotiation, list/call, all view states, input/output validation, disabled/production access, Host/Origin rejection, auth failures, downstream access denial, safe diagnostics, concurrency and body limits. They do not certify live Supabase RLS or a real authenticated DB read; perform that read separately against an authorized local environment. No remote database or provider calls are made by these tests.

Verification: typecheck, test:release (including 36 MCP/creation tests), 42 additional existing Hono tests, and Next.js production build passed. The build registers /mcp but the handler remains disabled in production. Creation coverage includes concurrent same/different payloads, code collisions, lost write responses, read-after-write failure, replay after edits, permission revocation and organization/member scoping. TypeScript storage/auth are injected. Separately, the migration and all 13 pgTAP assertions passed against local PostgreSQL 17.6 and were rolled back. Permanent migration application and an authenticated MCP end-to-end smoke test remain pending; no provider smoke test was run.

Later tools remain unregistered until their documented submission, executor, approval and auth dependencies are implemented. See [contracts](../../../../docs/architecture-v2/MCP_TOOL_CONTRACTS.md).
