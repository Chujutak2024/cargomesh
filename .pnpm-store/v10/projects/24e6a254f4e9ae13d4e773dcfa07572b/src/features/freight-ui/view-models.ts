import type { FreightRequestIntakeStatus } from "@/features/freight-requests/intake-contracts";
import type { RecommendationProposedFields } from "@/features/recommendations/contracts";

export type FreightRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "ORCHESTRATING"
  | "AWAITING_SELECTION"
  | "BOOKING"
  | "BOOKED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type FreightRequestListItem = {
  id: string;
  requestCode: string;
  origin: string;
  destination: string;
  corridorNote?: string;
  cargoSummary: string;
  cargoDetail: string;
  pickupDate: string;
  updatedAt: string;
  status: FreightRequestStatus;
  actionHref?: string;
};

export type DashboardSummary = {
  activeRequests: number;
  awaitingSelection: number;
  inTransit: number;
  completed: number;
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
  source: "persisted" | "visual-fixture" | "new-draft";
  freightRequestId: string;
  draftVersion: number;
  requestId: string;
  organizationId: string;
  organization: string;
  operatorMemberId: string;
  requester: string;
  status: FreightRequestIntakeStatus;
  updatedAt: string;
  currency: string;
  cargoProfile: string;
  originCountry: string;
  originRegion: string;
  originCity: string;
  originAddress: string;
  origin: string;
  destinationCountry: string;
  destinationRegion: string;
  destinationCity: string;
  destinationAddress: string;
  destination: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupContact: string;
  receiverName: string;
  receiverCompany: string;
  receiverPhone: string;
  deliveryContact: string;
  borderCrossing: string;
  operationalNotes: string;
  cargoCategory: string;
  cargoCategoryId: string;
  cargoCategoryCode: string;
  cargoDescription: string;
  transportMode: string;
  serviceType: string;
  entryMethod: string;
  quantity: number | null;
  unitsPerEntry: number | null;
  unitWeightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  totalWeightKg: number;
  totalVolumeM3: number | null;
  cargoWeightKg: number;
  cargoVolumeM3: number | null;
  pickupMode: "ASAP" | "SCHEDULED";
  requiredPickup: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  deliveryDeadline: string;
  budgetMaxUsd: number | null;
  strategy: "BALANCED";
  documents: string[];
  recommendationValues: RecommendationProposedFields;
  requiresRefrigeration?: boolean;
  temperatureMinC?: number | null;
  temperatureMaxC?: number | null;
  isHazardous?: boolean;
  isOversized?: boolean;
  isFragile?: boolean;
};

export type DispatchFixtureScenario =
  | "loading"
  | "evaluating"
  | "error"
  | "no-match"
  | "one"
  | "three"
  | "four";
