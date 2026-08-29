export type CandidateProvider = {
  carrierId: string;
  carrierCode: string;
  displayName: string;
  providerUrl: string;
  matchingServiceId: string;
};

export type ProviderPageConfig = CandidateProvider & {
  service: {
    transportMode: string;
    serviceType: string;
    maxCapacityKg: number;
    maxVolumeM3: number | null;
    supportsCrossBorder: boolean;
  };
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
