export type ProviderSelectionMode = "ASSISTED" | "SMART_AUTO";

export type ProviderAuthorizationContext = {
  authorization_reference: string;
  authorized_by: "HUMAN_SELECTION" | "AUTO_BOOKING_POLICY";
};

export type BookFreightInput = {
  freight_request_id: string;
  provider_offer_reference: string;
  idempotency_key: string;
  authorization_context: ProviderAuthorizationContext;
  selection_mode: ProviderSelectionMode;
};

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

export type ProviderBookingStatus =
  | "PENDING_PROVIDER_CONFIRMATION"
  | "CONFIRMED"
  | "REJECTED"
  | "EXPIRED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type ProviderPaymentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export type ProviderBookingLocation = {
  countryCode: string;
  city: string;
};

export type ProviderBookingEvent = {
  providerEventId: string;
  eventType: string;
  providerBookingStatus: ProviderBookingStatus;
  occurredAt: string;
  location: ProviderBookingLocation | null;
  description: string;
};

export type ProviderBookingStatusResult = {
  schemaVersion: "1.0";
  providerReference: string;
  providerBookingStatus: ProviderBookingStatus;
  providerStatusReason: string | null;
  currentLocation: ProviderBookingLocation | null;
  updatedEta: string | null;
  providerResponseDeadline: string;
  paymentStatus: ProviderPaymentStatus;
  events: ProviderBookingEvent[];
};

export type GetProviderBookingStatusInput = {
  provider_reference: string;
};

export type ProviderFixtureControl = "ACCEPT" | "REJECT" | "NO_RESPONSE";
