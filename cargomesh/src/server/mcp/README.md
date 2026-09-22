# CargoMesh MCP local preview

Implemented: `/mcp` on the Next.js Node runtime, official SDK `1.30.0`, tested protocol `2025-11-25`, stateless Streamable HTTP with JSON responses. Four registered tools call shared services directly: `create_freight_request` creates an idempotent DRAFT, `submit_freight_request` validates and advances it to PENDING, `find_freight_options` starts or resumes a persisted INITIAL run, and `get_freight_options` reads persisted progress and ranking. The MCP endpoint does not contact providers or book freight.

The SDK retains its protocol negotiation behavior for older supported clients. Compatibility testing here targets 2025-11-25. No MCP sessions, standalone SSE subscriptions, OAuth, bearer authentication, Alexa, AWS or Bedrock integration are implemented.

| MCP tool | Current state |
| --- | --- |
| `create_freight_request` | Implemented; real `/mcp` → service → authenticated member → local Supabase INSERT and persisted-row read verified. |
| `submit_freight_request` | Implemented; checks persisted draft fields, active OWNER/SUPERVISOR, status and draftVersion; atomically writes PENDING/version + 1. Local RLS, replay and denial verified. |
| `find_freight_options` | Implemented; local MCP → authenticated start service → persisted RUNNING run and idempotent replay verified. Requires PENDING. |
| `get_freight_options` | Implemented; local persisted loading and completed ranked-offer reads verified. Read-only. |
| `authorize_and_book` | Proposed contract; not registered. |
| `get_booking_status` | Proposed contract; not registered. |
| `recover_booking` | Proposed contract; not registered. |

## Start locally

Use the project's existing local Supabase configuration and an authenticated CargoMesh member. `supabase/seed.sql` provisions the local demo SUPERVISOR; the optional `supabase/scenarios/mcp-local/seed.sql` provisions a REQUESTER and an isolated tenant for denial tests. Neither is production data.

Creation requires [the idempotency migration](../../../../supabase/migrations/20260918120000_c_draft_creation_idempotency.sql) applied to the intended database. It was applied to the local Supabase database for verification; no remote `db push` was run. PostgreSQL checks are in [test 08](../../../../supabase/tests/08_draft_creation_idempotency.test.sql).

## Creation contract

`create_freight_request` accepts `{ idempotencyKey: UUID, fields: ... }`; use the full explicit schema in [MCP_TOOL_CONTRACTS.md](../../../../docs/architecture-v2/MCP_TOOL_CONTRACTS.md). It requires an active OWNER/SUPERVISOR and creates ROAD/FTL/BALANCED, PALLETS/SCHEDULED drafts. Save one key per intended request and resend the same fields on retries. Another payload with that key produces `IDEMPOTENCY_CONFLICT`. A replay returns the original request's current status/version with `replayed: true`; it does not revert it to DRAFT. Creation neither submits the request nor authorizes a booking.

Keys are scoped to organization/member and retained while the request exists. Administrative deletion removes that protection. Concurrent deduplication relies on PostgreSQL's unique index; the TypeScript concurrency tests inject storage and do not prove live RLS/database behavior.

## Find and browser continuation

Call `submit_freight_request` with `{ freightRequestId, draftVersion }` from the creation receipt before discovery. It validates the stored draft, advances DRAFT to PENDING with an optimistic version check, and returns `replayed: true` for an exact retry while it remains PENDING. It neither contacts a provider nor grants booking approval. A stale version or a request already advanced beyond PENDING requires a fresh read.

`find_freight_options` accepts `{ freightRequestId: UUID, idempotencyKey: string }` for an existing **PENDING** request. It returns a persisted run ID, status, deduplication flag and discovered candidate snapshot. A RUNNING reply means only that the run exists. Reuse the same key after an uncertain response; a different key does not start a second run while the request is ORCHESTRATING.

For this local preview, open `/dispatch/<runId>` on the same signed-in CargoMesh origin and click **Continue provider search**. The browser uses the existing WebMCP navigation/Result Bridge/evaluation pipeline to collect registered provider results, persist offers and rank them. `get_freight_options` can be polled before and after that step. Closing the browser before completion leaves a RUNNING run for later browser continuation; there is no autonomous server-side executor or Alexa client. The local integration test injects one clearly synthetic quote through the Result Bridge to verify persistence and readback; it does not prove browser execution or an external carrier integration.

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
// For a newly created DRAFT, submit its receipt first:
const submitted = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
  name: 'submit_freight_request', arguments: {
    freightRequestId: 'YOUR_DRAFT_REQUEST_UUID', draftVersion: 1,
  },
}});
// Then use submitted.result.structuredContent.data.freightRequestId here.
const started = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: {
  name: 'find_freight_options', arguments: {
    freightRequestId: 'YOUR_PENDING_REQUEST_UUID', idempotencyKey: 'YOUR_STABLE_SEARCH_KEY',
  },
}});
// Visit /dispatch/<runId> and click Continue provider search, then poll:
const runId = started.result.structuredContent.data.runId;
await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: {
  name: 'get_freight_options', arguments: { runId },
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

The default tests exercise the handler, SDK client/server/transport and pure view-model builder with injected auth/database boundaries. The separate `pnpm test:mcp:local` test exercises the running Next route, real Supabase session and RLS, creation, submission/replay, start/replay, persisted loading/completed reads, role/cross-organization denial, and one synthetic Result Bridge quote. It is intentionally excluded from `test:mcp` because it needs local Docker and a running Next development server. No remote database or provider calls are made.

The build registers `/mcp` but the handler remains disabled in production. Local integration tests use new UUIDs and delete only their own requests afterward through local Docker SQL, preserving the Golden Flow pgTAP fixture. The PENDING transition in the find/get test uses the real `submit_freight_request` MCP tool. The completed quote is synthetic test data, not a provider smoke test.

To reproduce the local integration test, work from the repository root to start Supabase and apply the migration **locally**. Apply [the MCP scenario seed](../../../../supabase/scenarios/mcp-local/seed.sql) to the local database only. In one PowerShell terminal from `cargomesh/`, obtain `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` from `supabase status -o json`; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `CARGOMESH_MCP_LOCAL_ENABLED=true`, then run `pnpm dev --hostname 127.0.0.1 --port 3100`. In a second terminal set the same Supabase variables, `MCP_LOCAL_BASE_URL=http://localhost:3100` and `CARGOMESH_MCP_TEST_PASSWORD` to the local-only password in `supabase/seed.sql`, then run `pnpm test:mcp:local`. Next normalizes the Result Bridge origin to `localhost` in this setup, so use `localhost` as the client origin. Docker must be available for exact-ID cleanup. The test refuses non-loopback app or Supabase URLs. Run `supabase test db` from the repository root for pgTAP. The local test must never target hosted Supabase.

Booking/status/recovery tools remain unregistered until their documented approval, execution and auth dependencies are implemented. See [contracts](../../../../docs/architecture-v2/MCP_TOOL_CONTRACTS.md).
