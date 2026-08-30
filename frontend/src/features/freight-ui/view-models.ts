export type FreightRequestStatus =
  | "PENDING"
  | "AWAITING_SELECTION"
  | "BOOKED"
  | "IN_TRANSIT"
  | "DELIVERED";

export type FreightRequestListItem = {
  id: string;
  origin: string;
  destination: string;
  corridorNote?: string;
  cargoSummary: string;
  cargoDetail: string;
  pickupDate: string;
  eta: string;
  vehicleCode: string;
  driver: string;
  status: FreightRequestStatus;
};

export type DashboardSummary = {
  activeRequests: number;
  awaitingSelection: number;
  activeShipments: number;
  slaCompliance: number;
};

export type VehicleStatus = "ACTIVE" | "AVAILABLE" | "MAINTENANCE";

export type VehicleListItem = {
  id: string;
  code: string;
  driver: string;
  route: string;
  status: VehicleStatus;
  eta: string;
  loadPercent: number;
};

export type LogisticsCapacity = {
  id: string;
  name: string;
  usedPercent: number;
  availableDocks: number;
};

export type TrackingMapModel = {
  hubs: Array<{ id: string; label: string; x: number; y: number }>;
  vehicles: Array<{ id: string; code: string; x: number; y: number; selected?: boolean }>;
  selectedVehicle: {
    code: string;
    driver: string;
    route: string;
    speed: string;
    eta: string;
  };
};

export type FreightIntakeModel = {
  requestId: string;
  organization: string;
  requester: string;
  cargoProfile: string;
  origin: string;
  destination: string;
  pickupContact: string;
  deliveryContact: string;
  borderCrossing: string;
  cargoCategory: string;
  entryMethod: string;
  quantity: number;
  unitWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  pickupDate: string;
  budgetMaxUsd: number;
  strategy: "BALANCED";
  documents: string[];
};

export type CandidateProgressStatus =
  | "PENDING"
  | "NAVIGATING"
  | "COVERAGE_CHECKED"
  | "CAPACITY_CHECKED"
  | "QUOTED"
  | "RECORDED";

export type DispatchCandidate = {
  candidateId: string;
  displayName: string;
  status: CandidateProgressStatus;
};

export type DispatchOffer = {
  offerId: string;
  carrierId: string;
  displayName: string;
  totalPrice: number;
  currency: "USD";
  transitHours: number;
  reportedVehicle: string;
  capacityKg: number;
  reliabilityPercent: number;
  pickupWindow: string;
  crossBorderSupported: boolean;
  roundedScore: number;
  reasons: string[];
  recommended: boolean;
};

export type DispatchRequestSummary = {
  requestId: string;
  origin: string;
  destination: string;
  cargo: string;
  pickupDate: string;
  budget: string;
};

type DispatchBase = {
  request: DispatchRequestSummary;
  candidates: DispatchCandidate[];
};

export type DispatchViewModel =
  | (DispatchBase & { state: "LOADING" })
  | (DispatchBase & { state: "EVALUATING" })
  | (DispatchBase & {
      state: "ERROR";
      error: { title: string; message: string; retryable: boolean };
    })
  | (DispatchBase & { state: "NO_MATCH"; offers: [] })
  | (DispatchBase & {
      state: "OPTIONS_READY";
      offers: DispatchOffer[];
      strategy: "BALANCED";
      decisionConfidence: number;
    });

export type DispatchFixtureScenario =
  | "loading"
  | "evaluating"
  | "error"
  | "no-match"
  | "one"
  | "three"
  | "four";
