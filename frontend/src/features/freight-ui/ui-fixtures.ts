import type {
  DashboardSummary,
  FreightRequestListItem,
  LogisticsCapacity,
  TrackingMapModel,
  VehicleListItem,
} from "./view-models";

// UI-only fixtures for B-01. Replace this adapter with organization-scoped data
// once C exposes the server-side query. Components must not depend on these IDs.
export const dashboardSummaryFixture: DashboardSummary = {
  activeRequests: 3,
  awaitingSelection: 1,
  activeShipments: 2,
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
    eta: "8 h 20 min",
    vehicleCode: "TR-204",
    driver: "Diego Salazar",
    status: "PENDING",
  },
  {
    id: "FR-1039",
    origin: "Arequipa, PE",
    destination: "Antofagasta, CL",
    cargoSummary: "12,400 kg · 16 pallets",
    cargoDetail: "Equipos industriales · Road FTL",
    pickupDate: "30 ago 2026",
    eta: "3 h 45 min",
    vehicleCode: "TR-118",
    driver: "María Quispe",
    status: "IN_TRANSIT",
  },
  {
    id: "FR-1028",
    origin: "Lima, PE",
    destination: "Trujillo, PE",
    cargoSummary: "4,200 kg · 8 pallets",
    cargoDetail: "Carga general · Road FTL",
    pickupDate: "24 ago 2026",
    eta: "Completado",
    vehicleCode: "TR-076",
    driver: "Luis Ortega",
    status: "DELIVERED",
  },
];

export const vehiclesFixture: VehicleListItem[] = [
  {
    id: "vehicle-demo-1",
    code: "TR-204",
    driver: "Diego Salazar",
    route: "Callao → Santiago",
    status: "ACTIVE",
    eta: "8 h 20 min",
    loadPercent: 82,
  },
  {
    id: "vehicle-demo-2",
    code: "TR-118",
    driver: "María Quispe",
    route: "Arequipa → Antofagasta",
    status: "ACTIVE",
    eta: "3 h 45 min",
    loadPercent: 68,
  },
  {
    id: "vehicle-demo-3",
    code: "TR-331",
    driver: "Jorge Huamán",
    route: "Disponible en Lima",
    status: "AVAILABLE",
    eta: "Listo para asignar",
    loadPercent: 0,
  },
  {
    id: "vehicle-demo-4",
    code: "TR-092",
    driver: "Ana Torres",
    route: "Base operativa Callao",
    status: "MAINTENANCE",
    eta: "Disponible mañana",
    loadPercent: 0,
  },
];

export const logisticsCapacityFixture: LogisticsCapacity[] = [
  { id: "hub-demo-1", name: "Centro Callao", usedPercent: 87, availableDocks: 2 },
  { id: "hub-demo-2", name: "Centro Arequipa", usedPercent: 64, availableDocks: 5 },
  { id: "hub-demo-3", name: "Centro Tacna", usedPercent: 48, availableDocks: 7 },
];

export const trackingMapFixture: TrackingMapModel = {
  hubs: [
    { id: "map-hub-1", label: "Callao", x: 22, y: 27 },
    { id: "map-hub-2", label: "Arequipa", x: 55, y: 61 },
    { id: "map-hub-3", label: "Tacna", x: 81, y: 76 },
  ],
  vehicles: [
    { id: "map-vehicle-1", code: "TR-204", x: 43, y: 45, selected: true },
    { id: "map-vehicle-2", code: "TR-118", x: 68, y: 68 },
  ],
  selectedVehicle: {
    code: "TR-204",
    driver: "Diego Salazar",
    route: "Callao → Santiago",
    speed: "72 km/h",
    eta: "8 h 20 min",
  },
};
