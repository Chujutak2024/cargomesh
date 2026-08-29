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
  status: FreightRequestStatus;
};

export type DashboardSummary = {
  activeRequests: number;
  awaitingSelection: number;
  activeShipments: number;
  slaCompliance: number;
};

