import type {
  OrchestrationViewModel,
  ProviderAttemptView,
  RankedOfferView,
} from "@/features/orchestration/contracts";
import type {
  DashboardSummary,
  DispatchFixtureScenario,
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

function toLocalDateTimeInput(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function atDemoDay(reference: Date, dayOffset: number, hour: number) {
  const value = new Date(reference);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hour);
  return toLocalDateTimeInput(value);
}

/** Mirrors the FR-1042 reset contract without freezing the demo to a calendar date. */
export function createFr1042DemoSchedule(reference = new Date()) {
  const pickupWindowStart = atDemoDay(reference, 1, 13);
  return {
    pickupMode: "SCHEDULED" as const,
    requiredPickup: pickupWindowStart,
    pickupWindowStart,
    pickupWindowEnd: atDemoDay(reference, 1, 17),
    deliveryDeadline: atDemoDay(reference, 4, 13),
  };
}

export function createFreightIntakeFixture(reference = new Date()): FreightIntakeModel {
  return {
    freightRequestId: "f2000000-0000-0000-0000-000000000001",
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
    cargoCategoryCode: "MACHINERY",
    transportMode: "ROAD",
    serviceType: "FTL",
    entryMethod: "Pallets",
    quantity: 10,
    unitWeightKg: 800,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 150,
    ...createFr1042DemoSchedule(reference),
    budgetMaxUsd: 2000,
    strategy: "BALANCED",
    documents: ["Factura comercial", "Packing list"],
  };
}

const candidateFixtures = [
  {
    carrierId: "carrier-demo-1",
    carrierCode: "ANDES_DEMO",
    displayName: "Andes Freight",
    providerUrl: "/providers/andes",
    matchingServiceId: "service-demo-1",
  },
  {
    carrierId: "carrier-demo-2",
    carrierCode: "INCA_DEMO",
    displayName: "Inca Logistics",
    providerUrl: "/providers/inca",
    matchingServiceId: "service-demo-2",
  },
  {
    carrierId: "carrier-demo-3",
    carrierCode: "PACIFIC_DEMO",
    displayName: "Pacific Cargo",
    providerUrl: "/providers/pacific",
    matchingServiceId: "service-demo-3",
  },
  {
    carrierId: "carrier-demo-4",
    carrierCode: "ALTIPLANO_DEMO",
    displayName: "Altiplano Transport",
    providerUrl: "/providers/altiplano",
    matchingServiceId: "service-demo-4",
  },
] as const;

const offerFixtures: RankedOfferView[] = [
  {
    offerId: "offer-demo-1",
    carrierId: "carrier-demo-1",
    carrierCode: "ANDES_DEMO",
    displayName: "Andes Freight",
    matchingServiceId: "service-demo-1",
    providerOfferReference: "ANDES-OFFER-DEMO",
    totalPrice: 1760,
    currency: "USD",
    transitHours: 31,
    rank: 1,
    score: 89,
    eligible: true,
    reasons: ["Mejor balance entre costo y confiabilidad", "Capacidad confirmada para la ventana solicitada"],
    recommended: true,
  },
  {
    offerId: "offer-demo-2",
    carrierId: "carrier-demo-2",
    carrierCode: "INCA_DEMO",
    displayName: "Inca Logistics",
    matchingServiceId: "service-demo-2",
    providerOfferReference: "INCA-OFFER-DEMO",
    totalPrice: 1920,
    currency: "USD",
    transitHours: 29,
    rank: 2,
    score: 84,
    eligible: true,
    reasons: ["Menor tiempo de tránsito", "Alta confiabilidad histórica"],
    recommended: false,
  },
  {
    offerId: "offer-demo-3",
    carrierId: "carrier-demo-3",
    carrierCode: "PACIFIC_DEMO",
    displayName: "Pacific Cargo",
    matchingServiceId: "service-demo-3",
    providerOfferReference: "PACIFIC-OFFER-DEMO",
    totalPrice: 1590,
    currency: "USD",
    transitHours: 60,
    rank: 3,
    score: 72,
    eligible: true,
    reasons: ["Menor precio total", "Ventana de disponibilidad limitada"],
    recommended: false,
  },
  {
    offerId: "offer-demo-4",
    carrierId: "carrier-demo-4",
    carrierCode: "ALTIPLANO_DEMO",
    displayName: "Altiplano Transport",
    matchingServiceId: "service-demo-4",
    providerOfferReference: "ALTIPLANO-OFFER-DEMO",
    totalPrice: 1840,
    currency: "USD",
    transitHours: 36,
    rank: 3,
    score: 80,
    eligible: true,
    reasons: ["Capacidad amplia", "Experiencia en operación transfronteriza"],
    recommended: false,
  },
];

const allTools = ["check_service_coverage", "check_capacity", "quote_freight"] as const;

function attempt(
  index: number,
  status: ProviderAttemptView["status"],
  completedTools: ProviderAttemptView["completedTools"] = [],
  stopReason: string | null = null,
): ProviderAttemptView {
  return { ...candidateFixtures[index], status, completedTools: [...completedTools], stopReason };
}

function baseFixture(
  scenario: DispatchFixtureScenario,
  requestCode: string,
  attempts: ProviderAttemptView[],
  completedCandidateCount: number,
) {
  return {
    schemaVersion: "1.0" as const,
    runId: `run-fixture-${scenario}`,
    freightRequestId: `freight-request-fixture-${requestCode}`,
    requestCode,
    startedAt: "2026-09-02T14:00:00.000Z",
    completedAt: scenario === "loading" || scenario === "evaluating" ? null : "2026-09-02T14:02:30.000Z",
    candidateCount: attempts.length,
    completedCandidateCount,
    attempts,
    warnings: [],
  };
}

function rankingFor(offers: RankedOfferView[], confidence: number) {
  return {
    orchestrationRunId: "run-fixture",
    strategy: "BALANCED" as const,
    recommendedOfferId: offers.find((offer) => offer.recommended)?.offerId ?? null,
    decisionConfidence: confidence,
    options: offers.map((offer) => ({
      offerId: offer.offerId,
      rank: offer.rank,
      rawScore: offer.score,
      roundedScore: offer.score,
      eligible: offer.eligible,
      reasons: offer.reasons,
    })),
  };
}

export function getDispatchFixture(
  scenario: DispatchFixtureScenario,
  requestCode: string,
): OrchestrationViewModel {
  const pendingAttempts = candidateFixtures.map((_, index) => attempt(index, "PENDING"));

  if (scenario === "loading") {
    return { ...baseFixture(scenario, requestCode, pendingAttempts, 0), status: "loading", ranking: null, offers: [] };
  }
  if (scenario === "evaluating") {
    const attempts = [
      attempt(0, "QUOTED", [...allTools]),
      attempt(1, "RUNNING", ["check_service_coverage", "check_capacity"]),
      attempt(2, "RUNNING", ["check_service_coverage"]),
      attempt(3, "PENDING"),
    ];
    return { ...baseFixture(scenario, requestCode, attempts, 1), status: "loading", ranking: null, offers: [] };
  }
  if (scenario === "error") {
    const attempts = [
      attempt(0, "FAILED", ["check_service_coverage"], "La consulta del provider no terminó correctamente."),
      attempt(1, "PENDING"),
    ];
    return {
      ...baseFixture(scenario, requestCode, attempts, 1),
      status: "error",
      error: {
        code: "RUN_FAILED",
        message: "La consulta terminó de forma controlada. Revisa la solicitud o vuelve a intentarlo.",
        retryable: true,
      },
      ranking: null,
      offers: [],
    };
  }
  if (scenario === "no-match") {
    const attempts = candidateFixtures.slice(0, 3).map((_, index) =>
      attempt(index, "REJECTED", ["check_service_coverage"], "El provider no cubre la solicitud."),
    );
    const base = baseFixture(scenario, requestCode, attempts, attempts.length);
    return {
      ...base,
      status: "NO_MATCH",
      reason: "No compatible provider produced an eligible offer.",
      ranking: { ...rankingFor([], 0), orchestrationRunId: base.runId },
      offers: [],
    };
  }

  const offerCount = scenario === "one" ? 1 : scenario === "four" ? 4 : 3;
  const selected = scenario === "four"
    ? [offerFixtures[0], offerFixtures[1], offerFixtures[3], offerFixtures[2]].map((offer, index) => ({ ...offer, rank: index + 1 }))
    : offerFixtures.slice(0, offerCount).map((offer, index) => ({ ...offer, rank: index + 1 }));
  const attempts = selected.map((offer) => {
    const candidateIndex = candidateFixtures.findIndex((candidate) => candidate.carrierId === offer.carrierId);
    return attempt(candidateIndex, "QUOTED", [...allTools]);
  });
  const base = baseFixture(scenario, requestCode, attempts, attempts.length);
  const confidence = offerCount === 1 ? 71 : offerCount === 4 ? 86 : 88;
  return {
    ...base,
    status: "success",
    offers: selected,
    ranking: { ...rankingFor(selected, confidence), orchestrationRunId: base.runId },
  };
}
