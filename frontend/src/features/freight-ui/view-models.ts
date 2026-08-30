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
