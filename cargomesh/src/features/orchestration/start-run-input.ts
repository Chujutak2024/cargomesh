import { OrchestrationError, type StartOrchestrationRunInput } from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStartOrchestrationRunInput(raw: unknown): StartOrchestrationRunInput {
  if (!isRecord(raw)) {
    throw new OrchestrationError("INVALID_ARGUMENT", "Request body must be an object.", 400);
  }

  const freightRequestId = raw.freightRequestId;
  const idempotencyKey = raw.idempotencyKey;
  if (typeof freightRequestId !== "string" || !UUID_PATTERN.test(freightRequestId)) {
    throw new OrchestrationError(
      "INVALID_ARGUMENT",
      "freightRequestId must be a UUID.",
      400,
    );
  }
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0 ||
    idempotencyKey.length > 200
  ) {
    throw new OrchestrationError(
      "INVALID_ARGUMENT",
      "idempotencyKey must contain between 1 and 200 characters.",
      400,
    );
  }

  return { freightRequestId, idempotencyKey: idempotencyKey.trim() };
}
