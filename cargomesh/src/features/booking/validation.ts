import { buildRegisteredProviderNavigationUrl } from "@/features/discovery/provider-navigation";
import { isNavigableProviderUrl } from "@/features/discovery/candidate-matcher";
import type { ProviderToolEnvelope } from "@/features/providers/contracts";
import {
  BookingBridgeError,
  type BookingAuthorizationKind,
  type BookingPaymentStatus,
  type BookingSelectionMode,
  type PrepareBookingInput,
  type PrepareBookingRecoveryInput,
  type ProviderBookFreightResult,
  type ProviderBookingEvent,
  type ProviderBookingStatus,
  type ProviderBookingStatusResult,
  type RecordProviderBookingInput,
  type RecordProviderBookingStatusInput,
} from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECTION_MODES = new Set<BookingSelectionMode>(["ASSISTED", "SMART_AUTO"]);
const AUTHORIZATION_KINDS = new Set<BookingAuthorizationKind>([
  "HUMAN_SELECTION",
  "AUTO_BOOKING_POLICY",
]);
const PROVIDER_STATUSES = new Set<ProviderBookingStatus>([
  "PENDING_PROVIDER_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
]);
const PAYMENT_STATUSES = new Set<BookingPaymentStatus>([
  "NOT_REQUIRED",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);

function invalid(message: string): never {
  throw new BookingBridgeError("INVALID_BOOKING_BRIDGE_INPUT", message, 400);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function string(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") invalid(`${field} is required.`);
  return value.trim();
}
function uuid(value: unknown, field: string): string {
  const parsed = string(value, field);
  if (!UUID_PATTERN.test(parsed)) invalid(`${field} must be a UUID.`);
  return parsed;
}
function isoDate(value: unknown, field: string): string {
  const parsed = string(value, field);
  if (!Number.isFinite(Date.parse(parsed))) invalid(`${field} must be an ISO date-time.`);
  return new Date(parsed).toISOString();
}
function nullableIsoDate(value: unknown, field: string): string | null {
  return value === null ? null : isoDate(value, field);
}
function parseEnvelope<T>(value: unknown, parseData: (data: unknown) => T): ProviderToolEnvelope<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") invalid("toolOutput must be a ProviderToolEnvelope.");
  if (value.ok) return { ok: true, data: parseData(value.data) };
  if (!isRecord(value.error)) invalid("toolOutput.error must be an object.");
  return {
    ok: false,
    error: {
      code: string(value.error.code, "toolOutput.error.code"),
      message: string(value.error.message, "toolOutput.error.message"),
      retryable: typeof value.error.retryable === "boolean" ? value.error.retryable : invalid("toolOutput.error.retryable must be boolean."),
    },
  };
}

function parseProviderBookFreightResult(value: unknown): ProviderBookFreightResult {
  if (!isRecord(value) || value.schemaVersion !== "1.0") invalid("book_freight result must use schemaVersion 1.0.");
  if (value.providerBookingStatus !== "PENDING_PROVIDER_CONFIRMATION") {
    invalid("book_freight must initially return PENDING_PROVIDER_CONFIRMATION.");
  }
  const paymentUrl = value.paymentUrl;
  if (paymentUrl !== null && typeof paymentUrl !== "string") invalid("paymentUrl must be a string or null.");
  if (typeof value.paymentRequired !== "boolean" || typeof value.idempotentReplay !== "boolean") {
    invalid("book_freight paymentRequired and idempotentReplay must be boolean.");
  }
  if (value.paymentRequired !== (paymentUrl !== null)) {
    invalid("paymentUrl must be present exactly when paymentRequired is true.");
  }
  return {
    schemaVersion: "1.0",
    freightRequestId: uuid(value.freightRequestId, "toolOutput.data.freightRequestId"),
    providerOfferReference: string(value.providerOfferReference, "toolOutput.data.providerOfferReference"),
    providerReference: string(value.providerReference, "toolOutput.data.providerReference"),
    providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
    providerResponseDeadline: isoDate(value.providerResponseDeadline, "toolOutput.data.providerResponseDeadline"),
    paymentRequired: value.paymentRequired,
    paymentUrl,
    idempotentReplay: value.idempotentReplay,
  };
}

function parseProviderBookingEvent(value: unknown): ProviderBookingEvent {
  if (!isRecord(value)) invalid("provider event must be an object.");
  const status = string(value.providerBookingStatus, "provider event.providerBookingStatus") as ProviderBookingStatus;
  if (!PROVIDER_STATUSES.has(status)) invalid("provider event.providerBookingStatus is unsupported.");
  let location: ProviderBookingEvent["location"] = null;
  if (value.location !== null) {
    if (!isRecord(value.location)) invalid("provider event.location must be an object or null.");
    location = {
      countryCode: string(value.location.countryCode, "provider event.location.countryCode"),
      city: string(value.location.city, "provider event.location.city"),
    };
  }
  return {
    providerEventId: string(value.providerEventId, "provider event.providerEventId"),
    eventType: string(value.eventType, "provider event.eventType"),
    providerBookingStatus: status,
    occurredAt: isoDate(value.occurredAt, "provider event.occurredAt"),
    location,
    description: string(value.description, "provider event.description"),
  };
}

function parseProviderBookingStatusResult(value: unknown): ProviderBookingStatusResult {
  if (!isRecord(value) || value.schemaVersion !== "1.0") invalid("booking status result must use schemaVersion 1.0.");
  const status = string(value.providerBookingStatus, "toolOutput.data.providerBookingStatus") as ProviderBookingStatus;
  const paymentStatus = string(value.paymentStatus, "toolOutput.data.paymentStatus") as BookingPaymentStatus;
  if (!PROVIDER_STATUSES.has(status) || !PAYMENT_STATUSES.has(paymentStatus)) invalid("booking status is unsupported.");
  let location: ProviderBookingStatusResult["currentLocation"] = null;
  if (value.currentLocation !== null) {
    if (!isRecord(value.currentLocation)) invalid("currentLocation must be an object or null.");
    location = {
      countryCode: string(value.currentLocation.countryCode, "currentLocation.countryCode"),
      city: string(value.currentLocation.city, "currentLocation.city"),
    };
  }
  if (!Array.isArray(value.events)) invalid("booking status events must be an array.");
  return {
    schemaVersion: "1.0",
    providerReference: string(value.providerReference, "toolOutput.data.providerReference"),
    providerBookingStatus: status,
    providerStatusReason: value.providerStatusReason === null ? null : string(value.providerStatusReason, "providerStatusReason"),
    currentLocation: location,
    updatedEta: nullableIsoDate(value.updatedEta, "updatedEta"),
    providerResponseDeadline: isoDate(value.providerResponseDeadline, "providerResponseDeadline"),
    paymentStatus,
    events: value.events.map(parseProviderBookingEvent),
  };
}

function parseIdentity(value: Record<string, unknown>) {
  const providerUrl = string(value.providerUrl, "providerUrl");
  if (!isNavigableProviderUrl(providerUrl)) invalid("providerUrl is not navigable.");
  return {
    bridgeCallId: string(value.bridgeCallId, "bridgeCallId"),
    authorizationReference: uuid(value.authorizationReference, "authorizationReference"),
    freightRequestId: uuid(value.freightRequestId, "freightRequestId"),
    offerId: uuid(value.offerId, "offerId"),
    carrierId: uuid(value.carrierId, "carrierId"),
    matchingServiceId: uuid(value.matchingServiceId, "matchingServiceId"),
    providerUrl,
    navigationUrl: string(value.navigationUrl, "navigationUrl"),
  };
}

export function assertProviderNavigation(
  providerUrl: string,
  matchingServiceId: string,
  navigationUrl: string,
  cargomeshOrigin: string,
): void {
  let expected: string;
  try {
    expected = buildRegisteredProviderNavigationUrl(providerUrl, matchingServiceId, new URL(cargomeshOrigin).origin);
  } catch {
    invalid("provider navigation cannot be resolved from the registered provider URL.");
  }
  if (navigationUrl !== expected) invalid("navigationUrl must match the registered provider origin, pathname and parameters.");
}

export function parsePrepareBookingInput(value: unknown): PrepareBookingInput {
  if (!isRecord(value)) invalid("prepare booking body must be an object.");
  const selectionMode = string(value.selectionMode, "selectionMode") as BookingSelectionMode;
  if (!SELECTION_MODES.has(selectionMode)) invalid("selectionMode must be ASSISTED or SMART_AUTO.");
  return {
    freightRequestId: uuid(value.freightRequestId, "freightRequestId"),
    offerId: uuid(value.offerId, "offerId"),
    selectionMode,
    bookingIdempotencyKey: string(value.bookingIdempotencyKey, "bookingIdempotencyKey"),
  };
}

export function parsePrepareBookingRecoveryInput(value: unknown): PrepareBookingRecoveryInput {
  if (!isRecord(value)) invalid("booking recovery body must be an object.");
  return {
    ...parsePrepareBookingInput(value),
    replacesBookingId: uuid(value.replacesBookingId, "replacesBookingId"),
  };
}

export function parseRecordProviderBookingInput(value: unknown): RecordProviderBookingInput {
  if (!isRecord(value)) invalid("booking bridge body must be an object.");
  const identity = parseIdentity(value);
  if (value.toolName !== "book_freight" || !isRecord(value.toolInput)) invalid("toolName must be book_freight with an input object.");
  const input = value.toolInput;
  if (!isRecord(input.authorization_context)) invalid("authorization_context is required.");
  const authorizedBy = string(input.authorization_context.authorized_by, "authorization_context.authorized_by") as BookingAuthorizationKind;
  const selectionMode = string(input.selection_mode, "selection_mode") as BookingSelectionMode;
  if (!AUTHORIZATION_KINDS.has(authorizedBy) || !SELECTION_MODES.has(selectionMode)) invalid("booking authorization context is invalid.");
  const parsed = {
    ...identity,
    toolName: "book_freight" as const,
    toolInput: {
      freight_request_id: uuid(input.freight_request_id, "toolInput.freight_request_id"),
      provider_offer_reference: string(input.provider_offer_reference, "toolInput.provider_offer_reference"),
      idempotency_key: string(input.idempotency_key, "toolInput.idempotency_key"),
      authorization_context: {
        authorization_reference: uuid(input.authorization_context.authorization_reference, "authorization_context.authorization_reference"),
        authorized_by: authorizedBy,
      },
      selection_mode: selectionMode,
    },
    toolOutput: parseEnvelope(value.toolOutput, parseProviderBookFreightResult),
  };
  if (parsed.toolInput.freight_request_id !== identity.freightRequestId || parsed.toolInput.authorization_context.authorization_reference !== identity.authorizationReference) {
    invalid("book_freight input must correlate to the server-issued authorization.");
  }
  return parsed;
}

export function parseRecordProviderBookingStatusInput(value: unknown): RecordProviderBookingStatusInput {
  if (!isRecord(value)) invalid("booking status bridge body must be an object.");
  const identity = parseIdentity(value);
  if (value.toolName !== "get_provider_booking_status" || !isRecord(value.toolInput)) invalid("toolName must be get_provider_booking_status with an input object.");
  return {
    ...identity,
    bookingId: uuid(value.bookingId, "bookingId"),
    toolName: "get_provider_booking_status",
    toolInput: { provider_reference: string(value.toolInput.provider_reference, "toolInput.provider_reference") },
    toolOutput: parseEnvelope(value.toolOutput, parseProviderBookingStatusResult),
  };
}
