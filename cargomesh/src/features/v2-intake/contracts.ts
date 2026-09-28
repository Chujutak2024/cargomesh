export type EligibilityStatusV2 = "eligible" | "ineligible" | "unknown";
export type ProvenanceStatusV2 = "VERIFIED" | "ESTIMATED" | "SIMULATED" | "UNKNOWN";

export type FreightLocationV2 = {
  facilityId?: string | null;
  label: string;
  countryCode: string;
  region?: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
};

export type FreightWindowV2 = {
  startsAt: string;
  endsAt: string;
};

export type CargoUnitV2 = {
  packageType: string;
  quantity: number;
  weightPerUnitKg: number;
  volumePerUnitM3: number;
  dimensionsCm: {
    length: number;
    width: number;
    height: number;
  };
  indivisible: boolean;
  stackable: boolean;
};

export type ShipmentContactV2 = {
  name: string;
  phoneE164: string;
  email: string;
};

export type CreateFreightRequestV2Input = {
  schemaVersion: "2.0";
  origin: FreightLocationV2;
  destination: FreightLocationV2;
  pickupWindow: FreightWindowV2;
  deliveryWindow: FreightWindowV2;
  acceptedModes: ["ROAD"];
  requiredEquipment: string;
  cargoSpecification: {
    categoryCode: string;
    description: string;
    packaging: string;
    totalWeightKg: number;
    totalVolumeM3: number;
    divisible: boolean;
    requirements: string[];
    temperatureRange: {
      minCelsius: number;
      maxCelsius: number;
    } | null;
    units: CargoUnitV2[];
  };
  contacts: {
    pickup: ShipmentContactV2;
    recipient: ShipmentContactV2;
  };
};

export type FreightRequestV2Data = Omit<CreateFreightRequestV2Input, "schemaVersion"> & {
  id: string;
  referenceCode: string;
  organizationId: string;
  status: "DRAFT" | "PENDING" | string;
  draftVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type FreightRequestV2Response = {
  schemaVersion: "2.0";
  data: FreightRequestV2Data;
  meta?: {
    idempotentReplay?: boolean;
    environmentProfile?: string;
  };
};

export type RoadRoutePreviewDto = {
  corridorCode: string | null;
  distanceKm: number | null;
  estimatedTransitHours: number | null;
  geometrySource: string;
  provenanceStatus: ProvenanceStatusV2;
  legs: Array<{
    sequence: number;
    mode: "ROAD";
    originLabel: string;
    destinationLabel: string;
    waypoints: Array<{ lat: number; lng: number; label?: string }>;
    conditions: Array<{
      code: string;
      severity: "INFO" | "WARNING" | "CRITICAL";
      description: string;
      provenanceStatus: ProvenanceStatusV2;
    }>;
  }>;
};

export type RoadServiceabilityCandidateV2 = {
  candidateId: string;
  status: EligibilityStatusV2;
  carrier: {
    id: string;
    code: string;
    commercialName: string;
  };
  service: {
    id: string;
    code: string;
    mode: "ROAD";
    serviceClass?: string;
    responseChannels?: string[];
  };
  checks: {
    coverage: {
      status: EligibilityStatusV2;
      pickupAreaCode: string | null;
      deliveryAreaCode: string | null;
      exclusionTriggered: boolean;
      reasonCode: string;
    };
    lane: {
      status: EligibilityStatusV2;
      laneId: string | null;
      kind: string | null;
      borderReviewRequired: boolean;
      reasonCode: string;
    };
    cargoAndEquipment: {
      status: EligibilityStatusV2;
      matchedCategory: string | null;
      requiredEquipment: string | null;
      indivisibleUnitsFit: boolean | null;
      reasonCode: string;
    };
    capacityWindow: {
      status: EligibilityStatusV2;
      sourceType: string | null;
      sourceId: string | null;
      calendarId: string | null;
      availableWeightKg: number | null;
      availableVolumeM3: number | null;
      windowChecked: FreightWindowV2;
      provenance: {
        dataSource: string;
        provenanceStatus: ProvenanceStatusV2;
        observedAt: string | null;
        validUntil: string | null;
      };
      reasonCode: string;
    };
  };
  reasons: string[];
  routePreview: RoadRoutePreviewDto | null;
};

export type RoadServiceabilityEvaluationV2Data = {
  freightRequestId: string;
  evaluatedDraftVersion: number;
  evaluatedAt: string;
  overallStatus: EligibilityStatusV2;
  summaryCounts: {
    totalEvaluated: number;
    eligibleCount: number;
    unknownCount: number;
    ineligibleCount: number;
  };
  commercialNotice: "EVALUATION_ONLY_NO_OFFER_OR_BOOKING";
  candidates: RoadServiceabilityCandidateV2[];
};

export type RoadServiceabilityEvaluationV2Response = {
  schemaVersion: "2.0";
  data: RoadServiceabilityEvaluationV2Data;
};

export type RoadCandidateMapViewProps = {
  origin: FreightLocationV2;
  destination: FreightLocationV2;
  overallStatus: EligibilityStatusV2;
  candidates: Array<{
    candidateId: string;
    status: EligibilityStatusV2;
    carrier: RoadServiceabilityCandidateV2["carrier"];
    service: Pick<RoadServiceabilityCandidateV2["service"], "id" | "code" | "mode">;
    carrierName: string;
    serviceCode: string;
    routePreview: RoadRoutePreviewDto | null;
  }>;
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
};

export type IntakeOptionVerification = "CAPTURE_ONLY" | "RESOURCE_EVIDENCE" | "REQUIRES_REVIEW";

export type IntakeOption = {
  code: string;
  labelEs: string;
  labelEn: string;
  guidance?: string;
  verification?: IntakeOptionVerification;
};

export type IntakeFacilityOption = FreightLocationV2 & {
  facilityId: string;
  code: string;
};

export type IntakeOptionsData = {
  facilities: IntakeFacilityOption[];
  cargoCategories: IntakeOption[];
  equipmentOptions: IntakeOption[];
  packagingOptions: IntakeOption[];
  requirementOptions: IntakeOption[];
};

export type IntakeOptionsResponse = {
  schemaVersion: "2.0";
  data: {
    facilities: Array<{
      id: string;
      code: string;
      label: string;
      countryCode: string;
      region?: string | null;
      city: string;
      lat: number | null;
      lng: number | null;
    }>;
    cargoCategories: Array<{
      id: string;
      code: string;
      name: string;
      guidance: string;
    }>;
    equipmentOptions: Array<{
      code: string;
      label: string;
      mode: "ROAD";
    }>;
    packagingOptions: Array<{
      code: string;
      labelEs: string;
      labelEn: string;
      verification: "CAPTURE_ONLY";
    }>;
    requirementOptions: Array<{
      code: string;
      labelEs: string;
      labelEn: string;
      verification: "RESOURCE_EVIDENCE" | "REQUIRES_REVIEW";
    }>;
  };
  meta?: {
    source?: string;
    provenanceStatus?: ProvenanceStatusV2;
  };
};

export type NormalizedIntakeOptionsResponse = Omit<IntakeOptionsResponse, "data"> & {
  data: IntakeOptionsData;
};

export type ErrorEnvelopeV2 = {
  schemaVersion: "2.0";
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
};
