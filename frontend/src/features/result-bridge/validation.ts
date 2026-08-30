import type { CapacityResult } from "@/features/providers/check-capacity-tool";
import type { ServiceCoverageResult } from "@/features/providers/check-service-coverage-tool";
import type { AvailabilityClass, ProviderQuote, ProviderToolEnvelope } from "@/features/providers/contracts";
import { isNavigableProviderUrl } from "@/features/discovery/candidate-matcher";
import {
  ResultBridgeError,
  type ProviderToolTechnicalError,
  type RecordableProviderToolName,
  type ValidatedRecordProviderResultInput,
} from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_TOOL_NAMES = new Set<RecordableProviderToolName>([
  "check_service_coverage",
  "check_capacity",
  "quote_freight",
]);
const AVAILABILITY_CLASSES = new Set<AvailabilityClass>([
  "EXACT_CONFIRMED_SLOT",
  "AVAILABLE_IN_WINDOW",
  "LIMITED_WINDOW",
  "WAITLIST",
  "UNAVAILABLE",
]);
const RECORD_FIELDS = new Set([
  "schemaVersion", "toolCallId", "orchestrationRunId", "freightRequestId",
  "carrierId", "matchingServiceId", "providerUrl", "navigationUrl", "toolName",
  "attemptNumber", "toolInput", "toolOutput", "startedAt", "completedAt",
  "durationMs", "status", "technicalError",
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

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function invalid(message: string): never {
  throw new ResultBridgeError("INVALID_PROVIDER_RESULT", message, 400);
}

function parseErrorEnvelope(value: Record<string, unknown>): ProviderToolEnvelope<never> {
  if (!isRecord(value.error)) invalid("toolOutput.error must be an object.");
  if (!isNonEmptyString(value.error.code)) invalid("toolOutput.error.code is required.");
  if (!isNonEmptyString(value.error.message)) invalid("toolOutput.error.message is required.");
  if (typeof value.error.retryable !== "boolean") invalid("toolOutput.error.retryable must be boolean.");
  return {
    ok: false,
    error: {
      code: value.error.code,
      message: value.error.message,
      retryable: value.error.retryable,
    },
  };
}

function parseEnvelope<T>(value: unknown, parseData: (data: unknown) => T): ProviderToolEnvelope<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    invalid("toolOutput must use the ProviderToolEnvelope contract.");
  }
  return value.ok ? { ok: true, data: parseData(value.data) } : parseErrorEnvelope(value);
}

function parseQuote(value: unknown): ProviderQuote {
  if (!isRecord(value)) invalid("toolOutput.data must be a ProviderQuote object.");
  if (value.schemaVersion !== "1.0") invalid("ProviderQuote.schemaVersion must be 1.0.");
  if (!isNonEmptyString(value.freightRequestId)) invalid("ProviderQuote.freightRequestId is required.");
  if (!isNonEmptyString(value.providerOfferReference)) invalid("ProviderQuote.providerOfferReference is required.");
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
  if (!isNonEmptyString(value.availabilityClass) || !AVAILABILITY_CLASSES.has(value.availabilityClass as AvailabilityClass)) {
    invalid("ProviderQuote.availabilityClass is invalid.");
  }
  if (typeof value.crossBorderSupported !== "boolean") invalid("ProviderQuote.crossBorderSupported must be boolean.");
  if (typeof value.customsCoordinationIncluded !== "boolean") {
    invalid("ProviderQuote.customsCoordinationIncluded must be boolean.");
  }
  if (!isStringArray(value.requiredDocuments)) invalid("ProviderQuote.requiredDocuments must be a string array.");
  if (value.borderHandlingNotes !== null && !isNonEmptyString(value.borderHandlingNotes)) {
    invalid("ProviderQuote.borderHandlingNotes must be a string or null.");
  }
  if (!isIsoDate(value.validUntil)) invalid("ProviderQuote.validUntil must be an ISO date.");
  return value as unknown as ProviderQuote;
}

function parseCoverageResult(value: unknown): ServiceCoverageResult {
  if (!isRecord(value)) invalid("Coverage output data must be an object.");
  if (value.schemaVersion !== "1.0") invalid("Coverage schemaVersion must be 1.0.");
  if (!isNonEmptyString(value.providerServiceCode)) invalid("Coverage providerServiceCode is required.");
  if (typeof value.supported !== "boolean") invalid("Coverage supported must be boolean.");
  if (typeof value.crossBorderSupported !== "boolean") invalid("Coverage crossBorderSupported must be boolean.");
  if (!isRecord(value.corridor)) invalid("Coverage corridor must be an object.");
  if (!isNonEmptyString(value.corridor.origin) || !isNonEmptyString(value.corridor.destination)) {
    invalid("Coverage corridor origin and destination are required.");
  }
  if (typeof value.customsCoordinationAvailable !== "boolean") {
    invalid("Coverage customsCoordinationAvailable must be boolean.");
  }
  if (!isStringArray(value.serviceNotes)) invalid("Coverage serviceNotes must be a string array.");
  return value as unknown as ServiceCoverageResult;
}

function parseCapacityResult(value: unknown): CapacityResult {
  if (!isRecord(value)) invalid("Capacity output data must be an object.");
  if (value.schemaVersion !== "1.0") invalid("Capacity schemaVersion must be 1.0.");
  if (!isNonEmptyString(value.providerServiceCode)) invalid("Capacity providerServiceCode is required.");
  if (typeof value.available !== "boolean") invalid("Capacity available must be boolean.");
  if (!isNonEmptyString(value.availabilityClass) || !AVAILABILITY_CLASSES.has(value.availabilityClass as AvailabilityClass)) {
    invalid("Capacity availabilityClass is invalid.");
  }
  if (!isFiniteNumber(value.availableCapacityKg) || value.availableCapacityKg < 0) {
    invalid("Capacity availableCapacityKg cannot be negative.");
  }
  if (value.availableVolumeM3 !== null && (!isFiniteNumber(value.availableVolumeM3) || value.availableVolumeM3 < 0)) {
    invalid("Capacity availableVolumeM3 must be non-negative or null.");
  }
  if (!isNullableIsoDate(value.earliestPickup) || !isNullableIsoDate(value.estimatedDelivery)) {
    invalid("Capacity dates must be ISO dates or null.");
  }
  if (typeof value.requestedWindowAvailable !== "boolean") {
    invalid("Capacity requestedWindowAvailable must be boolean.");
  }
  if (value.reportedVehicleType !== null && !isNonEmptyString(value.reportedVehicleType)) {
    invalid("Capacity reportedVehicleType must be a string or null.");
  }
  if (!isStringArray(value.capabilityNotes)) invalid("Capacity capabilityNotes must be a string array.");
  return value as unknown as CapacityResult;
}

function parseTechnicalError(value: unknown): ProviderToolTechnicalError | null {
  if (value === null) return null;
  if (!isRecord(value)) invalid("technicalError must be an object or null.");
  if (!isNonEmptyString(value.code) || !isNonEmptyString(value.message)) {
    invalid("technicalError code and message are required.");
  }
  if (typeof value.retryable !== "boolean") invalid("technicalError.retryable must be boolean.");
  return { code: value.code, message: value.message, retryable: value.retryable };
}

function validateExecutionEvidence<T>(
  toolOutput: ProviderToolEnvelope<T> | null,
  status: "COMPLETED" | "TECHNICAL_ERROR",
  technicalError: ProviderToolTechnicalError | null,
): void {
  if (status === "COMPLETED" && (!toolOutput || !toolOutput.ok)) {
    invalid("A completed call requires a successful ProviderToolEnvelope.");
  }
  if (status === "TECHNICAL_ERROR" && toolOutput?.ok) {
    invalid("A technical failure cannot contain a successful ProviderToolEnvelope.");
  }
  if (toolOutput && !toolOutput.ok && technicalError && (
    toolOutput.error.code !== technicalError.code ||
    toolOutput.error.message !== technicalError.message ||
    toolOutput.error.retryable !== technicalError.retryable
  )) {
    invalid("technicalError must match the failed ProviderToolEnvelope.");
  }
}

function parseNavigationUrl(value: string, matchingServiceId: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("navigationUrl must be an absolute HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    invalid("navigationUrl must be an absolute HTTP(S) URL without credentials.");
  }
  if (url.searchParams.get("serviceId") !== matchingServiceId) {
    invalid("navigationUrl must preserve the discovered matchingServiceId.");
  }
  return url.toString();
}

function parseCoverageInput(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) invalid("Coverage toolInput must be an object.");
  for (const field of ["origin", "destination", "transport_mode", "service_type", "cargo_category"]) {
    if (!isNonEmptyString(value[field])) invalid(`Coverage toolInput.${field} is required.`);
  }
  return value;
}

function parseCapacityInput(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) invalid("Capacity toolInput must be an object.");
  for (const field of ["origin", "destination", "cargo_category"]) {
    if (!isNonEmptyString(value[field])) invalid(`Capacity toolInput.${field} is required.`);
  }
  if (!isFiniteNumber(value.cargo_weight_kg) || value.cargo_weight_kg <= 0) {
    invalid("Capacity toolInput.cargo_weight_kg must be positive.");
  }
  if (value.pickup_mode !== "ASAP" && value.pickup_mode !== "SCHEDULED") {
    invalid("Capacity toolInput.pickup_mode is invalid.");
  }
  return value;
}

function parseQuoteInput(value: unknown, freightRequestId: string): Record<string, unknown> & { freight_request_id: string } {
  if (!isRecord(value)) invalid("Quote toolInput must be an object.");
  if (!isNonEmptyString(value.freight_request_id)) invalid("toolInput.freight_request_id is required.");
  if (value.freight_request_id !== freightRequestId) {
    invalid("toolInput.freight_request_id does not match freightRequestId.");
  }
  return value as Record<string, unknown> & { freight_request_id: string };
}

export function parseRecordProviderResultInput(value: unknown): ValidatedRecordProviderResultInput {
  if (!isRecord(value)) invalid("Request body must be an object.");
  const unknownField = Object.keys(value).find((field) => !RECORD_FIELDS.has(field));
  if (unknownField) invalid(`Unknown Result Bridge field: ${unknownField}.`);
  for (const field of [
    "toolCallId", "orchestrationRunId", "freightRequestId", "carrierId",
    "matchingServiceId", "providerUrl", "navigationUrl", "toolName",
    "startedAt", "completedAt",
  ] as const) {
    if (!isNonEmptyString(value[field])) invalid(`${field} is required.`);
  }
  for (const field of ["orchestrationRunId", "freightRequestId", "carrierId", "matchingServiceId"] as const) {
    if (!UUID_PATTERN.test(value[field] as string)) invalid(`${field} must be a UUID.`);
  }
  if (!isNavigableProviderUrl(value.providerUrl as string)) invalid("providerUrl is not navigable.");
  if (!PROVIDER_TOOL_NAMES.has(value.toolName as RecordableProviderToolName)) {
    invalid("toolName is not supported by INT-02A.");
  }
  if (!Number.isInteger(value.attemptNumber) || (value.attemptNumber as number) < 1) {
    invalid("attemptNumber must be a positive integer.");
  }
  if (!Number.isInteger(value.durationMs) || (value.durationMs as number) < 0) {
    invalid("durationMs must be a non-negative integer.");
  }
  if (value.schemaVersion !== "1.0") invalid("schemaVersion must be 1.0.");
  if (!isIsoDate(value.startedAt) || !isIsoDate(value.completedAt)) {
    invalid("startedAt and completedAt must be ISO dates.");
  }
  const calculatedDuration = Date.parse(value.completedAt as string) - Date.parse(value.startedAt as string);
  if (calculatedDuration < 0) invalid("completedAt cannot precede startedAt.");
  if (calculatedDuration !== value.durationMs) invalid("durationMs must match the recorded timeline.");
  if (value.status !== "COMPLETED" && value.status !== "TECHNICAL_ERROR") {
    invalid("status must be COMPLETED or TECHNICAL_ERROR.");
  }

  const toolName = value.toolName as RecordableProviderToolName;
  const matchingServiceId = value.matchingServiceId as string;
  const navigationUrl = parseNavigationUrl(value.navigationUrl as string, matchingServiceId);
  const expectedToolCallId = [
    "cm:int02a:v1", value.orchestrationRunId, value.freightRequestId,
    value.carrierId, matchingServiceId, toolName, value.attemptNumber,
  ].join(":");
  if (value.toolCallId !== expectedToolCallId) {
    invalid("toolCallId does not match the canonical INT-02A identity.");
  }

  const technicalError = parseTechnicalError(value.technicalError);
  if (value.status === "COMPLETED" && (technicalError !== null || value.toolOutput === null)) {
    invalid("A completed call requires toolOutput and cannot contain technicalError.");
  }
  if (value.status === "TECHNICAL_ERROR" && technicalError === null) {
    invalid("A technical failure requires technicalError.");
  }

  const common = {
    schemaVersion: "1.0" as const,
    toolCallId: value.toolCallId as string,
    orchestrationRunId: value.orchestrationRunId as string,
    freightRequestId: value.freightRequestId as string,
    carrierId: value.carrierId as string,
    matchingServiceId,
    providerUrl: value.providerUrl as string,
    navigationUrl,
    attemptNumber: value.attemptNumber as number,
    startedAt: value.startedAt as string,
    completedAt: value.completedAt as string,
    durationMs: value.durationMs as number,
    status: value.status as "COMPLETED" | "TECHNICAL_ERROR",
    technicalError,
  };

  if (toolName === "check_service_coverage") {
    const toolOutput = value.toolOutput === null ? null : parseEnvelope(value.toolOutput, parseCoverageResult);
    validateExecutionEvidence(toolOutput, common.status, technicalError);
    return {
      ...common,
      toolName,
      toolInput: parseCoverageInput(value.toolInput),
      toolOutput,
    };
  }
  if (toolName === "check_capacity") {
    const toolOutput = value.toolOutput === null ? null : parseEnvelope(value.toolOutput, parseCapacityResult);
    validateExecutionEvidence(toolOutput, common.status, technicalError);
    return {
      ...common,
      toolName,
      toolInput: parseCapacityInput(value.toolInput),
      toolOutput,
    };
  }

  const toolOutput = value.toolOutput === null ? null : parseEnvelope(value.toolOutput, parseQuote);
  validateExecutionEvidence(toolOutput, common.status, technicalError);
  if (toolOutput?.ok && toolOutput.data.freightRequestId !== value.freightRequestId) {
    invalid("ProviderQuote freightRequestId does not match the Result Bridge input.");
  }
  return {
    ...common,
    toolName: "quote_freight",
    toolInput: parseQuoteInput(value.toolInput, value.freightRequestId as string),
    toolOutput,
  };
}
