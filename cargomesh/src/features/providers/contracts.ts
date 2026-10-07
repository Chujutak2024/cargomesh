export type CandidateProvider = {
  carrierId: string;
  carrierCode: string;
  displayName: string;
  providerUrl: string;
  matchingServiceId: string;
};

export type ProviderPageConfig = CandidateProvider & {
  service: {
    providerServiceCode: string;
    transportMode: string;
    serviceType: string;
    maxCapacityKg: number;
    maxVolumeM3: number | null;
    supportsCrossBorder: boolean;
  };
};

export type AvailabilityClass =
  | "EXACT_CONFIRMED_SLOT"
  | "AVAILABLE_IN_WINDOW"
  | "LIMITED_WINDOW"
  | "WAITLIST"
  | "UNAVAILABLE";

export type QuoteFreightInput = {
  freight_request_id: string;
  origin: string;
  destination: string;
  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  cargo_category?: string;
  pickup_mode?: "ASAP" | "SCHEDULED";
  pickup_window_start?: string;
  pickup_window_end?: string;
  delivery_deadline?: string;
  available_documents?: string[];
};

export type ProviderQuote = {
  schemaVersion: "1.0";
  freightRequestId: string;
  providerOfferReference: string;
  price: number;
  currency: "USD";
  priceBreakdown: Record<string, number>;
  estimatedPickup: string;
  estimatedDelivery: string;
  transitHours: number;
  availableCapacityKg: number;
  availabilityClass: AvailabilityClass;
  crossBorderSupported: boolean;
  customsCoordinationIncluded: boolean;
  requiredDocuments: string[];
  borderHandlingNotes: string | null;
  validUntil: string;
};

export type ProviderToolEnvelope<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };

export type RecordedOffer = {
  offerId: string;
  orchestrationRunId: string;
  carrierId: string;
  providerOfferReference: string;
  totalPrice: number;
  currency: "USD";
  transitHours: number;
  status: "RECEIVED" | "ELIGIBLE" | "INELIGIBLE";
};
