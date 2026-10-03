/**
 * Presentation types for HAC-27 §6.1 (document d2a9ef6d0876), accepting
 * HAC-12's executable nullable regions and open condition severity strings.
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
      // HAC-12's executable schema accepts non-empty provider severity strings.
      severity: string;
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
