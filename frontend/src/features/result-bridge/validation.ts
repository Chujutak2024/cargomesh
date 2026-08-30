import type {
  AvailabilityClass,
  ProviderQuote,
  ProviderToolEnvelope,
} from "@/features/providers/contracts";
import { isNavigableProviderUrl } from "@/features/discovery/candidate-matcher";
import {
  ResultBridgeError,
  type ValidatedRecordProviderResultInput,
} from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVAILABILITY_CLASSES = new Set<AvailabilityClass>([
  "EXACT_CONFIRMED_SLOT",
  "AVAILABLE_IN_WINDOW",
  "LIMITED_WINDOW",
  "WAITLIST",
  "UNAVAILABLE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function invalid(message: string): never {
  throw new ResultBridgeError("INVALID_PROVIDER_RESULT", message, 400);
}

function parseErrorEnvelope(
  value: Record<string, unknown>,
): ProviderToolEnvelope<ProviderQuote> {
  if (!isRecord(value.error)) invalid("toolOutput.error must be an object.");
  if (!isNonEmptyString(value.error.code)) invalid("toolOutput.error.code is required.");
  if (!isNonEmptyString(value.error.message)) invalid("toolOutput.error.message is required.");
  if (typeof value.error.retryable !== "boolean") {
    invalid("toolOutput.error.retryable must be boolean.");
  }

  return {
    ok: false,
    error: {
      code: value.error.code,
      message: value.error.message,
      retryable: value.error.retryable,
    },
  };
}

function parseQuote(value: unknown): ProviderQuote {
  if (!isRecord(value)) invalid("toolOutput.data must be a ProviderQuote object.");
  if (value.schemaVersion !== "1.0") invalid("ProviderQuote.schemaVersion must be 1.0.");
  if (!isNonEmptyString(value.freightRequestId)) invalid("ProviderQuote.freightRequestId is required.");
  if (!isNonEmptyString(value.providerOfferReference)) {
    invalid("ProviderQuote.providerOfferReference is required.");
  }
  if (!isFiniteNumber(value.price) || value.price <= 0) invalid("ProviderQuote.price must be positive.");
  if (value.currency !== "USD") invalid("ProviderQuote.currency must be USD.");
  if (!isRecord(value.priceBreakdown)) invalid("ProviderQuote.priceBreakdown must be an object.");

  const priceParts = Object.values(value.priceBreakdown);
  if (!priceParts.every((part) => isFiniteNumber(part) && part >= 0)) {
    invalid("Every ProviderQuote.priceBreakdown value must be a non-negative number.");
  }
  const breakdownTotal = priceParts.reduce<number>((total, part) => total + (part as number), 0);
  if (Math.abs(breakdownTotal - value.price) > 0.01) {
    invalid("ProviderQuote.price must equal the priceBreakdown total.");
  }

  if (!isIsoDate(value.estimatedPickup) || !isIsoDate(value.estimatedDelivery)) {
    invalid("ProviderQuote pickup and delivery must be ISO dates.");
  }
  if (Date.parse(value.estimatedDelivery) < Date.parse(value.estimatedPickup)) {
    invalid("ProviderQuote delivery cannot precede pickup.");
  }
  if (!isFiniteNumber(value.transitHours) || value.transitHours <= 0) {
    invalid("ProviderQuote.transitHours must be positive.");
  }
  if (!isFiniteNumber(value.availableCapacityKg) || value.availableCapacityKg < 0) {
    invalid("ProviderQuote.availableCapacityKg cannot be negative.");
  }
  if (
    !isNonEmptyString(value.availabilityClass) ||
    !AVAILABILITY_CLASSES.has(value.availabilityClass as AvailabilityClass)
  ) {
    invalid("ProviderQuote.availabilityClass is invalid.");
  }
  if (typeof value.crossBorderSupported !== "boolean") {
    invalid("ProviderQuote.crossBorderSupported must be boolean.");
  }
  if (typeof value.customsCoordinationIncluded !== "boolean") {
    invalid("ProviderQuote.customsCoordinationIncluded must be boolean.");
  }
  if (
    !Array.isArray(value.requiredDocuments) ||
    !value.requiredDocuments.every(isNonEmptyString)
  ) {
    invalid("ProviderQuote.requiredDocuments must be a string array.");
  }
  if (value.borderHandlingNotes !== null && !isNonEmptyString(value.borderHandlingNotes)) {
    invalid("ProviderQuote.borderHandlingNotes must be a string or null.");
  }
  if (!isIsoDate(value.validUntil)) invalid("ProviderQuote.validUntil must be an ISO date.");

  return value as unknown as ProviderQuote;
}

function parseToolOutput(value: unknown): ProviderToolEnvelope<ProviderQuote> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    invalid("toolOutput must use the ProviderToolEnvelope contract.");
  }
  return value.ok ? { ok: true, data: parseQuote(value.data) } : parseErrorEnvelope(value);
}

function parseToolInput(
  value: unknown,
  freightRequestId: string,
): Record<string, unknown> & { freight_request_id: string } {
  if (!isRecord(value)) invalid("toolInput must be a quote_freight input object.");
  if (!isNonEmptyString(value.freight_request_id)) {
    invalid("toolInput.freight_request_id is required.");
  }
  if (value.freight_request_id !== freightRequestId) {
    invalid("toolInput.freight_request_id does not match freightRequestId.");
  }
  return value as Record<string, unknown> & { freight_request_id: string };
}

export function parseRecordProviderResultInput(
  value: unknown,
): ValidatedRecordProviderResultInput {
  if (!isRecord(value)) invalid("Request body must be an object.");

  for (const field of [
    "toolCallId",
    "orchestrationRunId",
    "freightRequestId",
    "carrierId",
    "providerUrl",
    "toolName",
    "startedAt",
    "completedAt",
  ] as const) {
    if (!isNonEmptyString(value[field])) invalid(`${field} is required.`);
  }

  for (const field of ["orchestrationRunId", "freightRequestId", "carrierId"] as const) {
    if (!UUID_PATTERN.test(value[field] as string)) invalid(`${field} must be a UUID.`);
  }
  if (!isNavigableProviderUrl(value.providerUrl as string)) invalid("providerUrl is not navigable.");
  if (value.toolName !== "quote_freight") invalid("C-02 only accepts quote_freight results.");
  if (value.schemaVersion !== "1.0") invalid("schemaVersion must be 1.0.");
  if (!isIsoDate(value.startedAt) || !isIsoDate(value.completedAt)) {
    invalid("startedAt and completedAt must be ISO dates.");
  }
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) {
    invalid("completedAt cannot precede startedAt.");
  }

  const freightRequestId = value.freightRequestId as string;
  const toolInput = parseToolInput(value.toolInput, freightRequestId);
  const toolOutput = parseToolOutput(value.toolOutput);
  if (toolOutput.ok && toolOutput.data.freightRequestId !== value.freightRequestId) {
    invalid("ProviderQuote freightRequestId does not match the Result Bridge input.");
  }

  return {
    toolCallId: value.toolCallId as string,
    orchestrationRunId: value.orchestrationRunId as string,
    freightRequestId: value.freightRequestId as string,
    carrierId: value.carrierId as string,
    providerUrl: value.providerUrl as string,
    toolName: "quote_freight",
    toolInput,
    toolOutput,
    startedAt: value.startedAt as string,
    completedAt: value.completedAt as string,
    schemaVersion: "1.0",
  };
}
