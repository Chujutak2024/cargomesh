import { Hono } from "hono";
import { authMiddleware, type AuthVariables } from "@/server/hono/middleware/auth";
import { CreateFreightRequestSchema } from "@/shared/schemas/freight-request";
import { adaptV2ToLegacyService } from "@/server/hono/adapters/freight-request-adapter";
import { successResponse } from "@/shared/schemas/api-envelope";

// ---------------------------------------------------------------------------
// POST /freight/requests — CargoMesh V2
//
// Migrated vertical (Slice 1). Parallel to legacy POST /api/freight-requests/drafts.
//
// Flow:
//   1. Auth middleware validates session → injects AuthenticatedMemberContext
//   2. Zod validates the V2 flat request body
//   3. adaptV2ToLegacyService() converts flat V2 input → { fields: ... }
//   4. createFreightRequestDraftServer() is called unchanged
//
// Errors are thrown and caught by the global app.onError handler (error-handler.ts).
// JSON parse failures are caught locally (pre-Zod) to return a clear INVALID_ARGUMENT.
//
// Auth note: requireAuthenticatedMember() runs in authMiddleware AND again inside
// createFreightRequestDraftServer(). This double-check is intentional during the
// migration: the service owns its own security boundary. The middleware check
// provides an early-exit guard before any business logic runs.
// TODO(v2-auth): Once all verticals are migrated, consider a single auth boundary
// at the middleware level and passing the member context explicitly into services.
// ---------------------------------------------------------------------------

const freightRequestsRouter = new Hono<{ Variables: AuthVariables }>();

freightRequestsRouter.post("/", authMiddleware, async (c) => {
  // Step 1: Parse JSON body — catch parse errors locally for clear error codes
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    // JSON.parse failures are not Zod errors; handle here to emit the right code.
    const { errorResponse } = await import("@/shared/schemas/api-envelope");
    return c.json(
      errorResponse("INVALID_ARGUMENT", "Request body must be valid JSON."),
      400,
    );
  }

  // Step 2: Validate schema — ZodError bubbles to global error handler
  const input = CreateFreightRequestSchema.parse(body);

  // Step 3: Adapt V2 flat input to the legacy { fields: ... } contract
  const legacyInput = adaptV2ToLegacyService(input);

  // Step 4: Call the existing service function (unchanged)
  const { createFreightRequestDraftServer } = await import(
    "@/features/freight-requests/draft-creation-server"
  );

  const result = await createFreightRequestDraftServer(legacyInput);
  return c.json(successResponse(result), 201);
});

export { freightRequestsRouter };
