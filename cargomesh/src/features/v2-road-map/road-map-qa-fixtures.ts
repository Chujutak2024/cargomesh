import type { RoadCandidateMapViewProps } from "./road-map-contract";

/** Local presentation fixtures, not API responses or carrier/road evidence. */
const base: Omit<RoadCandidateMapViewProps, "selectedCandidateId" | "onSelectCandidate"> = {
  origin: { label: "Planta Callao Norte", city: "Callao", countryCode: "PE", lat: -12.0464, lng: -77.1181 },
  destination: { label: "Centro de distribución Arequipa", city: "Arequipa", countryCode: "PE", lat: -16.409, lng: -71.5375 },
  overallStatus: "eligible",
  candidates: [{
    candidateId: "road-a", status: "eligible",
    carrier: { id: "carrier-a", code: "TEST-A", commercialName: "Transportista de escenario A" },
    service: { id: "service-a", code: "ROAD-SUR", mode: "ROAD" },
    carrierName: "Transportista de escenario A", serviceCode: "ROAD-SUR",
    routePreview: {
      corridorCode: "PE-PANAM-SUR-1S", distanceKm: 1015, estimatedTransitHours: 18.5,
      geometrySource: "SCENARIO_SYNTHETIC_GEOMETRY", provenanceStatus: "SIMULATED",
      legs: [{ sequence: 1, mode: "ROAD", originLabel: "Callao", destinationLabel: "Arequipa",
        waypoints: [{ lat: -12.0464, lng: -77.1181 }, { lat: -14.0678, lng: -75.7286 }, { lat: -16.409, lng: -71.5375 }], conditions: [] }],
    },
  }, {
    candidateId: "road-b", status: "unknown",
    carrier: { id: "carrier-b", code: "TEST-B", commercialName: "Transportista de escenario B" },
    service: { id: "service-b", code: "ROAD-SUR-B", mode: "ROAD" },
    carrierName: "Transportista de escenario B", serviceCode: "ROAD-SUR-B", routePreview: null,
  }],
};

export type Scenario = "eligible" | "unknown" | "empty-legs" | "unknown-points" | "zero" | "missing" | "missing-both" | "google-source";

export const scenarios: Scenario[] = ["eligible", "unknown", "empty-legs", "unknown-points", "zero", "missing", "missing-both", "google-source"];

export function scenarioData(scenario: Scenario): Omit<RoadCandidateMapViewProps, "selectedCandidateId" | "onSelectCandidate"> {
  if (scenario === "zero") return {
    ...base,
    origin: { label: "Sede de escenario Piura", city: "Piura", countryCode: "PE", lat: -5.1945, lng: -80.6328 },
    candidates: [], overallStatus: "ineligible",
  };
  if (scenario === "unknown") return { ...base, candidates: base.candidates.slice(1), overallStatus: "unknown" };
  if (scenario === "missing" || scenario === "missing-both") return {
    ...base, origin: { ...base.origin, lat: null, lng: null },
    destination: scenario === "missing-both" ? { ...base.destination, lat: null, lng: null } : base.destination,
  };
  if (scenario === "empty-legs" || scenario === "unknown-points" || scenario === "google-source") {
    const candidate = base.candidates[0];
    const preview = candidate.routePreview!;
    return { ...base, candidates: [{ ...candidate, routePreview: {
      ...preview,
      legs: scenario === "unknown-points" ? preview.legs : [],
      provenanceStatus: scenario === "empty-legs" ? "SIMULATED" : "UNKNOWN",
      geometrySource: scenario === "google-source" ? "GOOGLE_ROUTES" : preview.geometrySource,
      distanceKm: null, estimatedTransitHours: null,
    } }] };
  }
  return base;
}
