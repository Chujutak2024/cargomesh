import { z } from "zod";

// ---------------------------------------------------------------------------
// Standard CargoMesh V2 response envelope — used by every Hono route.
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: ApiErrorSchema,
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ---------------------------------------------------------------------------
// Typed helpers used in Hono route handlers.
// ---------------------------------------------------------------------------

export function successResponse<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function errorResponse(
  code: string,
  message: string,
): ApiErrorResponse {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// HTTP status code resolver for domain error message prefixes.
// All CargoMesh service functions throw Error with a prefixed message.
// ---------------------------------------------------------------------------

export function httpStatusFromError(err: unknown): number {
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("UNAUTHENTICATED")) return 401;
  if (message.startsWith("FORBIDDEN")) return 403;
  if (message.startsWith("NOT_FOUND")) return 404;
  if (message.startsWith("INVALID_ARGUMENT")) return 400;
  if (
    message.startsWith("IDEMPOTENCY_CONFLICT") ||
    message.startsWith("RUN_NOT_ACTIVE") ||
    message.startsWith("STALE_DRAFT") ||
    message.startsWith("FREIGHT_REQUEST_NOT_READY")
  )
    return 409;
  if (
    message.startsWith("RESULT_REJECTED") ||
    message.startsWith("CORRELATION_ERROR") ||
    message.startsWith("CANDIDATE_MISMATCH")
  )
    return 422;
  return 500;
}

export function errorCodeFromError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  const colon = message.indexOf(":");
  if (colon !== -1) return message.slice(0, colon).trim();
  return "INTERNAL_ERROR";
}
