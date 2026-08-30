import type {
  DispatchCandidate,
  DispatchFixtureScenario,
  DispatchOffer,
  DispatchViewModel,
  DashboardSummary,
  FreightIntakeModel,
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

export const freightIntakeFixture: FreightIntakeModel = {
  requestId: "FR-1042",
  organization: "ACME Mining Perú",
  requester: "Carlos Mendoza",
  cargoProfile: "Repuestos y maquinaria minera",
  origin: "Callao / Lima, PE",
  destination: "Santiago, CL",
  pickupContact: "María Paredes · +51 999 210 440",
  deliveryContact: "Tomás Rojas · +56 9 6123 4010",
  borderCrossing: "Santa Rosa / Chacalluta",
  cargoCategory: "Repuestos mineros",
  entryMethod: "Pallets",
  quantity: 10,
  unitWeightKg: 800,
  lengthCm: 120,
  widthCm: 100,
  heightCm: 150,
  pickupDate: "2026-09-02T09:00",
  budgetMaxUsd: 2000,
  strategy: "BALANCED",
  documents: ["Factura comercial", "Packing list"],
};

const dispatchRequest = {
  requestId: freightIntakeFixture.requestId,
  origin: freightIntakeFixture.origin,
  destination: freightIntakeFixture.destination,
  cargo: "10 pallets · 8,000 kg · 18 m³",
  pickupDate: "02 sep 2026 · 09:00",
  budget: "$2,000 USD",
};

const candidateFixtures: DispatchCandidate[] = [
  { candidateId: "candidate-demo-1", displayName: "Andes Freight", status: "RECORDED" },
  { candidateId: "candidate-demo-2", displayName: "Inca Logistics", status: "RECORDED" },
  { candidateId: "candidate-demo-3", displayName: "Pacific Cargo", status: "RECORDED" },
  { candidateId: "candidate-demo-4", displayName: "Altiplano Transport", status: "RECORDED" },
];

const offerFixtures: DispatchOffer[] = [
  {
    offerId: "offer-demo-1",
    carrierId: "carrier-demo-1",
    displayName: "Andes Freight",
    totalPrice: 1760,
    currency: "USD",
    transitHours: 31,
    reportedVehicle: "Scania R450",
    capacityKg: 18000,
    reliabilityPercent: 96,
    pickupWindow: "02 sep · 09:00–11:00",
    crossBorderSupported: true,
    roundedScore: 89,
    reasons: ["Mejor balance entre costo y confiabilidad", "Capacidad confirmada para la ventana solicitada"],
    recommended: true,
  },
  {
    offerId: "offer-demo-2",
    carrierId: "carrier-demo-2",
    displayName: "Inca Logistics",
    totalPrice: 1920,
    currency: "USD",
    transitHours: 29,
    reportedVehicle: "Volvo FH",
    capacityKg: 24000,
    reliabilityPercent: 98,
    pickupWindow: "02 sep · 10:00–12:00",
    crossBorderSupported: true,
    roundedScore: 84,
    reasons: ["Menor tiempo de tránsito", "Alta confiabilidad histórica"],
    recommended: false,
  },
  {
    offerId: "offer-demo-3",
    carrierId: "carrier-demo-3",
    displayName: "Pacific Cargo",
    totalPrice: 1590,
    currency: "USD",
    transitHours: 60,
    reportedVehicle: "Freightliner Cascadia",
    capacityKg: 15000,
    reliabilityPercent: 86,
    pickupWindow: "03 sep · 08:00–12:00",
    crossBorderSupported: true,
    roundedScore: 72,
    reasons: ["Menor precio total", "Ventana de disponibilidad limitada"],
    recommended: false,
  },
  {
    offerId: "offer-demo-4",
    carrierId: "carrier-demo-4",
    displayName: "Altiplano Transport",
    totalPrice: 1840,
    currency: "USD",
    transitHours: 36,
    reportedVehicle: "Mercedes-Benz Actros",
    capacityKg: 20000,
    reliabilityPercent: 92,
    pickupWindow: "02 sep · 12:00–15:00",
    crossBorderSupported: true,
    roundedScore: 80,
    reasons: ["Capacidad amplia", "Experiencia en operación transfronteriza"],
    recommended: false,
  },
];

const evaluatingCandidates: DispatchCandidate[] = [
  { ...candidateFixtures[0], status: "RECORDED" },
  { ...candidateFixtures[1], status: "CAPACITY_CHECKED" },
  { ...candidateFixtures[2], status: "NAVIGATING" },
  { ...candidateFixtures[3], status: "PENDING" },
];

export function getDispatchFixture(
  scenario: DispatchFixtureScenario,
  requestId: string,
): DispatchViewModel {
  const request = { ...dispatchRequest, requestId };

  if (scenario === "loading") {
    return { state: "LOADING", request, candidates: [] };
  }
  if (scenario === "evaluating") {
    return { state: "EVALUATING", request, candidates: evaluatingCandidates };
  }
  if (scenario === "error") {
    return {
      state: "ERROR",
      request,
      candidates: evaluatingCandidates.slice(0, 2),
      error: {
        title: "No pudimos completar la evaluación",
        message: "La consulta terminó de forma controlada. Revisa la solicitud o vuelve a intentarlo.",
        retryable: true,
      },
    };
  }
  if (scenario === "no-match") {
    return { state: "NO_MATCH", request, candidates: candidateFixtures.slice(0, 3), offers: [] };
  }

  const offerCount = scenario === "one" ? 1 : scenario === "four" ? 4 : 3;
  const offers = offerFixtures
    .slice(0, offerCount)
    .sort((left, right) => right.roundedScore - left.roundedScore);
  return {
    state: "OPTIONS_READY",
    request,
    candidates: candidateFixtures.slice(0, offerCount),
    offers,
    strategy: "BALANCED",
    decisionConfidence: offerCount === 1 ? 71 : offerCount === 4 ? 86 : 88,
  };
}
