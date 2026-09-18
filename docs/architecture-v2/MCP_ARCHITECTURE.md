# CargoMesh MCP Architecture

Status: M1 bootstrap and M2 creation code implemented locally on top of application commit `d26c5e4`. M2 requires permanent migration application and an authenticated MCP smoke test; local SQL checks passed; later milestones are proposed.

The authoritative service inventory, six contracts, authentication spike and milestones are in [MCP_TOOL_CONTRACTS.md](./MCP_TOOL_CONTRACTS.md). The [local preview guide](../../frontend/src/server/mcp/README.md) documents the implemented `/mcp` endpoint, `get_freight_options` and `create_freight_request`. OAuth, Alexa+, Bedrock, AgentCore and Strands remain unimplemented.

## Milestone 1 implementation

- Official SDK 1.30.0; protocol 2025-11-25 verified with the SDK client. Zod updated within v3 to 3.25.76 for SDK compatibility.
- Stateless Streamable HTTP JSON responses; initialize, initialized notification, tools/list and tools/call. No long-lived SSE session.
- Read-only orchestration tool directly calling the existing RLS-protected view service.
- M2 adds creation via the existing normalization/creation policy, with durable org/member/key deduplication and an immutable input hash. Its additive migration is required before use; Hono can adopt the shared idempotent service without internal HTTP.
- Opt-in via CARGOMESH_MCP_LOCAL_ENABLED=true, loopback Host/URL and same-origin checks, cookie authentication on every request. Disabled in production even with opt-in.
- Shared runtime input/output schemas, safe diagnostics, request-scoped server lifecycle and tests included in test:release.
- TypeScript tests inject auth/storage. Separately, the migration and 13 SQL/RLS assertions passed on local PostgreSQL in a rolled-back transaction. Authenticated MCP end-to-end and provider validation remain pending.

## Dependency boundary

```text
Hono REST ---\
              -> shared services in server/services/ -> Core -> Supabase/RPC
MCP --------/                                  |
                                               -> WebMCP executor -> provider pages
```

MCP imports shared services directly; it must not call Hono through HTTP in the same process. Existing browser clients may continue calling legacy APIs. Transport handlers parse, authenticate, dispatch and serialize; commercial policy lives in shared services.

Hono bootstrap and draft creation already exist. A separate server/services re-export tree is not required. Do not move working services solely to match a diagram.

## Structure (search, booking and recovery remain proposed)

```text
frontend/src/
  app/mcp/route.ts               # implemented local /mcp endpoint, Node.js runtime
  server/mcp/
    server.ts                   # registration
    http.ts                     # transport and local access boundary
    errors.ts                   # sanitized error mapping
    auth/context.ts             # verified principal to domain context
    tools/
      create-freight-request.ts
      find-freight-options.ts
      get-freight-options.ts
      authorize-and-book.ts
      get-booking-status.ts
      recover-booking.ts
  shared/schemas/
    freight-request.ts          # exists; review adapter semantic gaps
    orchestration.ts            # implemented read input/output schemas
    booking.ts                  # proposed
```

Do not duplicate shared schemas in an MCP-specific directory. Shared submission, execution and approval use cases belong beside relevant feature services, not inside transport handlers.

Streamable HTTP is implemented for the local preview; remote deployment remains gated on the auth milestone. The SDK is pinned; supported older revisions retain SDK negotiation behavior, while tests target 2025-11-25. A file under src/server/mcp/server/route.ts would not mount a Next.js App Router endpoint.

## Execution readiness

start_orchestration_run persists a run and candidates; it does not launch a browser. runInt02aOrchestration coordinates browser collection through legacy APIs. createDocumentModelContextAdapter requires a document with document.modelContext. A Node route cannot obtain browser execution merely by importing that adapter.

Before enabling remote search/booking, agree a durable dispatch and reconciliation boundary with the WebMCP owner: browser host/lifetime, authenticated execution identity, result correlation, restart and retry behavior. Never simulate provider execution and label it live. Andes, Inca and Pacific are same-origin demo providers; Polaris, Apex and Velocity are scenario/roadmap.

Draft creation returns DRAFT, while initial orchestration requires PENDING. The submission use case is missing. getFreightRequestExecutionIntent is read-only. Booking preparation returns authorization, not a reservation; recovery preparation already changes the previous booking to REBOOKED before the replacement completes.

## Authentication and human approval

Current services authenticate with Next.js cookies and active Supabase organization membership. Alexa identity is not assumed to be a Supabase session JWT. Remote auth needs a verified principal, explicit organization selection, action permission and an RLS-preserving database strategy.

Booking/recovery require trusted evidence of explicit human approval before preparation. confirmed_by_human alone is insufficient. Proposed confirmationReference binds actor, organization, action, offer/terms, expiry and idempotency key, plus previous booking for recovery. Enforce this in shared services. Existing authorizationReference is an execution credential, not proof of consent. MCP initially uses ASSISTED only.

## Rollout

Begin with authenticated persisted reads in a restricted local environment. Enable tools only when dependencies work. Never report dispatched search when only a run exists, or booking success when only authorization exists.

Real auth precedes remote deployment. Alexa+ is a later client integration. Any future Bedrock module explains persisted BALANCED results only and cannot change ranking. See the ten milestones and release gates in the contracts document.
