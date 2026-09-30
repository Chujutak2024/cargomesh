/**
 * Type-only mirror of HAC-27 §6.1 (document d2a9ef6d0876, 26 Sep 2026).
 * HAC-12 owns the executable Zod schema under shared/schemas/v2. Replace this
 * import with that canonical type when its branch reaches the integration base.
 * No runtime validation or business rule is defined here.
 */
export type ProvenanceStatusV2 = "VERIFIED" | "ESTIMATED" | "SIMULATED" | "UNKNOWN";

export interface RoadRoutePreviewDto {
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
}

export interface RoadCandidateMapViewProps {
  origin: {
    facilityId?: string | null;
    label: string;
    city: string;
    region?: string | null;
    countryCode: string;
    lat: number | null;
    lng: number | null;
  };
  destination: {
    facilityId?: string | null;
    label: string;
    city: string;
    region?: string | null;
    countryCode: string;
    lat: number | null;
    lng: number | null;
  };
  overallStatus: "eligible" | "ineligible" | "unknown";
  candidates: Array<{
    candidateId: string;
    status: "eligible" | "ineligible" | "unknown";
    carrier: { id: string; code: string; commercialName: string };
    service: { id: string; code: string; mode: "ROAD" };
    carrierName: string;
    serviceCode: string;
    routePreview: RoadRoutePreviewDto | null;
  }>;
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
}
