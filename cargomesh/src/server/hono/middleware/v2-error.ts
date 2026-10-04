import type { Context } from "hono";
import { ZodError } from "zod";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { ErrorEnvelopeV2Schema } from "@/shared/schemas/v2/freight-request";

export function v2Error(c: Context, error: unknown) {
  let code = "INTERNAL_ERROR";
  let message = "Internal V2 error.";
  let status = 500;
  if (error instanceof V2DraftError) {
    ({ code, message } = error);
    status = error.httpStatus;
  } else if (error instanceof ZodError) {
    code = "VALIDATION_ERROR";
    message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    status = 400;
  }
  return c.json(ErrorEnvelopeV2Schema.parse({
    schemaVersion: "2.0",
    error: { code, message, retryable: status >= 500 && status !== 501 },
  }), status as Parameters<typeof c.json>[1]);
}
