import type { ProviderToolEnvelope } from "@/features/providers/contracts";

export const BOOKING_VIEW_MODEL_SCHEMA_VERSION = "1.0" as const;

export type BookingSelectionMode = "ASSISTED" | "SMART_AUTO";
export type BookingAuthorizationKind = "HUMAN_SELECTION" | "AUTO_BOOKING_POLICY";
export type ProviderBookingStatus =
  | "PENDING_PROVIDER_CONFIRMATION"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";
export type BookingPaymentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

/**
 * Deliberately mirrors A-04 structurally. The provider package remains the
 * owner of its tools; this server contract never imports provider runtime.
 */
export type ProviderBookFreightResult = {
  schemaVersion: "1.0";
  freightRequestId: string;
  providerOfferReference: string;
  providerReference: string;
  providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION";
  providerResponseDeadline: string;
  paymentRequired: boolean;
  paymentUrl: string | null;
  idempotentReplay: boolean;
};

export type ProviderBookingEvent = {
  providerEventId: string;
  eventType: string;
  providerBookingStatus: ProviderBookingStatus;
  occurredAt: string;
  location: { countryCode: string; city: string } | null;
  description: string;
};

export type ProviderBookingStatusResult = {
  schemaVersion: "1.0";
  providerReference: string;
  providerBookingStatus: ProviderBookingStatus;
  providerStatusReason: string | null;
  currentLocation: { countryCode: string; city: string } | null;
  updatedEta: string | null;
  providerResponseDeadline: string;
  paymentStatus: BookingPaymentStatus;
  events: ProviderBookingEvent[];
};

export type PrepareBookingInput = {
  freightRequestId: string;
  offerId: string;
  selectionMode: BookingSelectionMode;
  bookingIdempotencyKey: string;
};

export type PrepareBookingRecoveryInput = PrepareBookingInput & {
  replacesBookingId: string;
};

export type ResetDemoBookingRuntimeResult = {
  freightRequestId: string;
  deletedBookings: number;
  deletedAuthorizations: number;
};

export type PreparedBookingAuthorization = {
  authorizationReference: string;
  freightDecisionId: string;
  freightRequestId: string;
  offerId: string;
  carrierId: string;
  matchingServiceId: string;
  providerOfferReference: string;
  authorizationContext: {
    authorizationReference: string;
    authorizedBy: BookingAuthorizationKind;
  };
  selectionMode: BookingSelectionMode;
  bookingIdempotencyKey: string;
  expiresAt: string;
  deduplicated: boolean;
};

type BookingBridgeProviderIdentity = {
  bridgeCallId: string;
  authorizationReference: string;
  freightRequestId: string;
  offerId: string;
  carrierId: string;
  matchingServiceId: string;
  providerUrl: string;
  navigationUrl: string;
};

export type RecordProviderBookingInput = BookingBridgeProviderIdentity & {
  toolName: "book_freight";
  toolInput: {
    freight_request_id: string;
    provider_offer_reference: string;
    idempotency_key: string;
    authorization_context: {
      authorization_reference: string;
      authorized_by: BookingAuthorizationKind;
    };
    selection_mode: BookingSelectionMode;
  };
  toolOutput: ProviderToolEnvelope<ProviderBookFreightResult>;
};

export type RecordProviderBookingStatusInput = BookingBridgeProviderIdentity & {
  bookingId: string;
  toolName: "get_provider_booking_status";
  toolInput: { provider_reference: string };
  toolOutput: ProviderToolEnvelope<ProviderBookingStatusResult>;
};

export type BookingBridgePersistenceResult = {
  bookingId: string;
  status: "INSERTED" | "DEDUPLICATED";
  deduplicated: boolean;
};

export type BookingViewModel = {
  schemaVersion: typeof BOOKING_VIEW_MODEL_SCHEMA_VERSION;
  bookingId: string;
  freightRequestId: string;
  offerId: string;
  carrierId: string;
  providerReference: string;
  status:
    | "PENDING_PROVIDER_CONFIRMATION"
    | "CONFIRMED"
    | "REJECTED"
    | "EXPIRED"
    | "IN_TRANSIT"
    | "COMPLETED"
    | "CANCELLED";
  providerBookingStatus: ProviderBookingStatus;
  providerResponseDeadline: string;
  paymentStatus: BookingPaymentStatus;
  paymentUrl: string | null;
  selectionMode: BookingSelectionMode;
  canRecover: boolean;
  recoveryOfferIds: string[];
  events: Array<{
    providerEventId: string;
    eventType: string;
    providerBookingStatus: ProviderBookingStatus | null;
    occurredAt: string;
    location: { countryCode: string; city: string } | null;
    description: string | null;
  }>;
};

export class BookingBridgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "BookingBridgeError";
  }
}
