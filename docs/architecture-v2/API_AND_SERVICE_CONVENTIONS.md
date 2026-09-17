# API and Service Conventions

## Hono Route Structure

All Hono routes are mounted at `/api/v2/` via a Next.js catch-all route.

```
frontend/src/
  app/
    api/
      v2/
        [[...route]]/
          route.ts          ← Next.js catch-all that hands off to Hono app
  server/
    hono/
      app.ts                ← Hono app factory (createHonoApp)
      middleware/
        auth.ts             ← requireAuthenticatedMember → c.set('member', ...)
        error-handler.ts    ← maps domain errors to HTTP status + envelope
      routes/
        health.ts           ← GET /api/v2/health
        freight/
          requests.ts       ← POST /api/v2/freight/requests (create draft)
          [requestCode].ts  ← GET  /api/v2/freight/requests/:code
        orchestration/
          runs.ts           ← POST /api/v2/orchestration/runs
          [runId].ts        ← GET  /api/v2/orchestration/runs/:runId
          candidates.ts     ← GET  /api/v2/orchestration/candidates
          results.ts        ← POST /api/v2/orchestration/results
          evaluate.ts       ← POST /api/v2/orchestration/evaluate
        bookings/
          index.ts          ← POST /api/v2/bookings/prepare
          [bookingId].ts    ← GET  /api/v2/bookings/:bookingId
          record-provider.ts
          record-status.ts
          recover.ts
```

## Response Envelope

Every Hono route returns the same envelope:

```typescript
// Success
{ ok: true, data: <T> }

// Error
{ ok: false, error: { code: string, message: string } }
```

The `code` field is always a domain error code (uppercase, underscore-delimited), never an HTTP status integer.

**Status codes:**

| Domain error code | HTTP status |
|---|---|
| `UNAUTHENTICATED:*` | 401 |
| `FORBIDDEN:*` | 403 |
| `NOT_FOUND:*` | 404 |
| `INVALID_ARGUMENT:*` | 400 |
| `*_CONFLICT`, `RUN_NOT_ACTIVE`, `STALE_DRAFT` | 409 |
| `IDEMPOTENCY_CONFLICT` | 409 |
| `RESULT_REJECTED`, `CORRELATION_ERROR` | 422 |
| Anything else | 500 |

This envelope is identical to the existing Next.js route handlers — no change for the UI.

## Zod Schema Validation

All request bodies are validated with Zod at the Hono route level before calling the service function.

```typescript
// Example: freight request creation
import { z } from "zod";

const CreateFreightRequestSchema = z.object({
  organizationId: z.string().uuid(),
  originCountry: z.string().min(2).max(3),
  originCity: z.string().min(1),
  destinationCountry: z.string().min(2).max(3),
  destinationCity: z.string().min(1),
  cargoWeightKg: z.number().positive(),
  cargoVolumeM3: z.number().positive().nullable().optional(),
  packageCount: z.number().int().positive(),
  isCrossBorder: z.boolean(),
  transportMode: z.enum(["ROAD", "AIR", "SEA", "RAIL"]),
  serviceType: z.enum(["FTL", "LTL"]),
});
```

**Rule:** Zod schemas live in `src/shared/schemas/`. They are imported by both Hono routes and MCP tool handlers. Service functions may do additional semantic validation but assume structural validation has already happened.

## Authentication / Context

The Hono auth middleware calls `requireAuthenticatedMember()` from `lib/supabase/auth.ts` and injects the result into the Hono context:

```typescript
// middleware/auth.ts
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";

type Variables = { member: AuthenticatedMemberContext };

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const member = await requireAuthenticatedMember();
    c.set("member", member);
    await next();
  }
);
```

Route handlers access the member context via `c.get("member")`. They do NOT call `requireAuthenticatedMember()` themselves.

## Service / Use Case Patterns

**Rule: Route handlers contain no business logic. They contain:**
1. Schema validation (Zod)
2. One service function call
3. Response serialization
4. Error mapping

**Rule: Service functions are the single truth.** The same function is called by both the Hono route and the MCP tool. No duplication.

**Pattern for a service function:**

```typescript
// features/freight-requests/draft-creation-server.ts (existing pattern)
export async function createFreightRequestDraftServer(
  rawInput: unknown
): Promise<FreightRequestIntakeViewModel> {
  // 1. Parse input (semantic validation)
  // 2. requireAuthenticatedMember() — auth boundary
  // 3. Query/mutate Supabase
  // 4. Return typed domain result
  // Throws: RecommendationDraftError (not NextResponse, not HTTP errors)
}
```

**Hono route uses it like:**
```typescript
app.post("/freight/requests", authMiddleware, async (c) => {
  const body = CreateFreightRequestSchema.parse(await c.req.json());
  const result = await createFreightRequestDraftServer(body);
  return c.json({ ok: true, data: result }, 201);
});
```

**MCP tool uses it like:**
```typescript
// mcp/tools/create_freight_request.ts
server.tool("create_freight_request", CreateFreightRequestSchema.shape, async (input) => {
  const result = await createFreightRequestDraftServer(input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

## Naming Conventions

| Layer | Convention | Example |
|---|---|---|
| Hono route files | `kebab-case.ts` | `record-provider.ts` |
| Service functions | `camelCase` | `createFreightRequestDraftServer` |
| Zod schemas | `PascalCase` + `Schema` suffix | `CreateFreightRequestSchema` |
| Domain error classes | `PascalCase` + `Error` suffix | `BookingBridgeError` |
| DB column → TS field | `snake_case` → `camelCase` | `freight_request_id` → `freightRequestId` |
| MCP tool names | `snake_case` | `create_freight_request` |

## When to Call Supabase Directly vs RPC

**Use the session client (anon, RLS-enforced) for:**
- All SELECTs where the user's org scoping should apply
- Reads that are guarded by RLS policies

**Use the admin client (service_role) for:**
- `start_orchestration_run` RPC
- `persist_balanced_decision` RPC
- `prepare_booking_authorization` RPC
- `record_provider_booking_result` RPC
- `record_provider_booking_status` RPC
- `prepare_booking_recovery` RPC
- `reset_demo_booking_runtime` RPC
- Any operation that requires bypassing RLS for a legitimate system reason

**Rule:** Admin client calls happen ONLY after the session client has already verified the user's membership. Never use the admin client for initial auth.

## Error Handling in Hono

The Hono error handler catches:
1. Domain error classes (`BookingBridgeError`, `OrchestrationError`, etc.) — maps to their `httpStatus`
2. Error messages starting with `UNAUTHENTICATED:` or `FORBIDDEN:` — maps to 401/403
3. Zod validation errors — maps to 400
4. All other errors — maps to 500

```typescript
// middleware/error-handler.ts
app.onError((err, c) => {
  if (err instanceof BookingBridgeError) {
    return c.json({ ok: false, error: { code: err.code, message: err.message } }, err.httpStatus);
  }
  if (err instanceof ZodError) {
    return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: err.message } }, 400);
  }
  // ... etc
  return c.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Internal error" } }, 500);
});
```

## What NOT to Put in Route Handlers

```typescript
// ❌ Business logic in route handler
app.post("/bookings/prepare", async (c) => {
  const admin = createAdminClient();
  const { data } = await admin.rpc("prepare_booking_authorization", { ... });
  // ... more DB logic
});

// ✅ Service call in route handler
app.post("/bookings/prepare", authMiddleware, async (c) => {
  const body = PrepareBookingSchema.parse(await c.req.json());
  const result = await prepare_booking(body);
  return c.json({ ok: true, data: result }, result.deduplicated ? 200 : 201);
});
```
