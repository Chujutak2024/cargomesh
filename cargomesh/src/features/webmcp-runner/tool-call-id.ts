import type {
  ProviderToolCallIdFactory,
  ProviderToolCallIdentity,
} from "./contracts";

export const INT02A_TOOL_CALL_ID_PREFIX = "cm:int02a:v1";

function validateIdentityPart(name: string, value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`INVALID_TOOL_CALL_ID: ${name} is required.`);
  }
  if (normalized.includes(":")) {
    throw new Error(
      `INVALID_TOOL_CALL_ID: ${name} cannot contain the canonical separator ':'.`,
    );
  }

  return normalized;
}

/**
 * Canonical INT-02A idempotency identity agreed by A + C.
 */
export const createInt02aToolCallId: ProviderToolCallIdFactory = (
  identity: ProviderToolCallIdentity,
) => {
  if (!Number.isInteger(identity.attemptNumber) || identity.attemptNumber < 1) {
    throw new Error(
      "INVALID_TOOL_CALL_ID: attemptNumber must be a positive integer.",
    );
  }

  return [
    INT02A_TOOL_CALL_ID_PREFIX,
    validateIdentityPart("orchestrationRunId", identity.orchestrationRunId),
    validateIdentityPart("freightRequestId", identity.freightRequestId),
    validateIdentityPart("carrierId", identity.carrierId),
    validateIdentityPart("matchingServiceId", identity.matchingServiceId),
    validateIdentityPart("toolName", identity.toolName),
    identity.attemptNumber,
  ].join(":");
};
