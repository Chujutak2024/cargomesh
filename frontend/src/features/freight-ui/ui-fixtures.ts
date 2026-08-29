import type {
  DashboardSummary,
  FreightRequestListItem,
} from "./view-models";

// UI-only fixtures for B-01. Replace this adapter with organization-scoped data
// once C exposes the server-side query. Components must not depend on these IDs.
export const dashboardSummaryFixture: DashboardSummary = {
  activeRequests: 3,
  awaitingSelection: 1,
  activeShipments: 1,
  slaCompliance: 97.4,
};

export const freightRequestsFixture: FreightRequestListItem[] = [
  {
    id: "FR-1042",
    origin: "Callao / Lima, PE",
    destination: "Santiago, CL",
    corridorNote: "Frontera Santa Rosa / Chacalluta",
    cargoSummary: "8,000 kg · 10 pallets",
    cargoDetail: "Repuestos mineros · Road FTL",
    pickupDate: "02 sep 2026",
    status: "PENDING",
  },
  {
    id: "FR-1039",
    origin: "Arequipa, PE",
    destination: "Antofagasta, CL",
    cargoSummary: "12,400 kg · 16 pallets",
    cargoDetail: "Equipos industriales · Road FTL",
    pickupDate: "30 ago 2026",
    status: "IN_TRANSIT",
  },
  {
    id: "FR-1028",
    origin: "Lima, PE",
    destination: "Trujillo, PE",
    cargoSummary: "4,200 kg · 8 pallets",
    cargoDetail: "Carga general · Road FTL",
    pickupDate: "24 ago 2026",
    status: "DELIVERED",
  },
];

