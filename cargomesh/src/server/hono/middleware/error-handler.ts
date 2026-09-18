import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import {
  errorResponse,
  errorCodeFromError,
  httpStatusFromError,
} from "@/shared/schemas/api-envelope";

// ---------------------------------------------------------------------------
// Domain error classes imported from existing feature modules.
// We import types only to avoid pulling in server-only side effects here.
// ---------------------------------------------------------------------------

function isDomainError(
  err: unknown,
): err is { code: string; message: string; httpStatus: number } {
  return (
    err instanceof Error &&
    "code" in err &&
    "httpStatus" in err &&
    typeof (err as { httpStatus: unknown }).httpStatus === "number"
  );
}

// ---------------------------------------------------------------------------
// Global Hono error handler.
// Maps domain errors, Zod validation errors, and plain Errors to the
// standard CargoMesh V2 response envelope.
// ---------------------------------------------------------------------------

export const errorHandler: ErrorHandler = (err, c) => {
  // 1. Typed domain errors (BookingBridgeError, OrchestrationError, etc.)
  if (isDomainError(err)) {
    return c.json(
      errorResponse(err.code, err.message),
      err.httpStatus as Parameters<typeof c.json>[1],
    );
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    const message = err.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return c.json(errorResponse("VALIDATION_ERROR", message), 400);
  }

  // 3. Plain errors with CargoMesh prefix conventions ("UNAUTHENTICATED: …")
  const status = httpStatusFromError(err) as Parameters<typeof c.json>[1];
  const code = errorCodeFromError(err);
  const message =
    err instanceof Error ? err.message : "Internal error";

  return c.json(errorResponse(code, message), status);
};
