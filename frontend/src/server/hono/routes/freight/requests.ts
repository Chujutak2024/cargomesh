import { Hono } from "hono";
import { ZodError } from "zod";
import { authMiddleware, type AuthVariables } from "@/server/hono/middleware/auth";
import { CreateFreightRequestSchema } from "@/shared/schemas/freight-request";
import {
  successResponse,
  errorResponse,
  httpStatusFromError,
  errorCodeFromError,
} from "@/shared/schemas/api-envelope";

const freightRequestsRouter = new Hono<{ Variables: AuthVariables }>();

// ---------------------------------------------------------------------------
// POST /freight/requests
//
// Creates a new freight request draft.
// Migrated vertical: maps to legacy POST /api/freight-requests/drafts
//
// Service function: createFreightRequestDraftServer (features/freight-requests/)
// The service function is imported lazily (server-only) and called unchanged.
// ---------------------------------------------------------------------------

freightRequestsRouter.post("/", authMiddleware, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      errorResponse("INVALID_ARGUMENT", "Request body must be valid JSON."),
      400,
    );
  }

  // Validate structural schema with Zod
  let input;
  try {
    input = CreateFreightRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return c.json(errorResponse("VALIDATION_ERROR", message), 400);
    }
    throw err;
  }

  // Call the existing service function (unchanged)
  const { createFreightRequestDraftServer } = await import(
    "@/features/freight-requests/draft-creation-server"
  );

  try {
    const result = await createFreightRequestDraftServer(input);
    return c.json(successResponse(result), 201);
  } catch (err) {
    const status = httpStatusFromError(err) as Parameters<typeof c.json>[1];
    const code = errorCodeFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to create freight request.";
    return c.json(errorResponse(code, message), status);
  }
});

export { freightRequestsRouter };
