import type { MapPresentation } from "@/features/v2-road-map/road-map-model";
import { validCoordinate } from "@/features/v2-road-map/road-map-model";
import type { WorkflowRecordV2 } from "./shipper-model";

type RouteRecord = Extract<WorkflowRecordV2, { kind: "routes" }>;

export function routeRecordToPresentation(route: RouteRecord | null): MapPresentation {
  if (!route) return emptyPresentation();
  const points = route.data.legs.map((leg) => [leg.origin, ...leg.waypoints.map((waypoint) => waypoint.location), leg.destination]);
  const complete = points.length > 0 && points.every((leg) => leg.length >= 2 && leg.every((point) =>
    validCoordinate(point.lat, point.lng)));
  if (!complete || route.data.confidence === "UNKNOWN") return {
    ...emptyPresentation(), provenanceStatus: "UNKNOWN", geometrySource: "PUBLISHED_CORRIDORS",
  };
  const first = points[0][0], last = points[points.length - 1][points[points.length - 1].length - 1];
  return {
    selectedCandidate: null,
    markers: [
      { kind: "origin", point: { lat: first.lat!, lng: first.lng! }, label: first.label },
      { kind: "destination", point: { lat: last.lat!, lng: last.lng! }, label: last.label },
    ],
    paths: points.map((leg) => leg.map((point) => ({ lat: point.lat!, lng: point.lng! }))),
    provenanceStatus: route.data.confidence,
    geometrySource: "PUBLISHED_CORRIDORS",
    distanceKm: route.data.estimatedDistanceKm,
    estimatedTransitHours: route.data.estimatedDurationSeconds === null ? null : route.data.estimatedDurationSeconds / 3600,
  };
}

function emptyPresentation(): MapPresentation {
  return { selectedCandidate: null, markers: [], paths: [], provenanceStatus: "UNKNOWN", geometrySource: null,
    distanceKm: null, estimatedTransitHours: null };
}

