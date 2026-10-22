import type { MapPresentation } from "@/features/v2-road-map/road-map-model";
import { validCoordinate } from "@/features/v2-road-map/road-map-model";
import type { WorkflowRecordV2 } from "./shipper-model";

type RouteRecord = Extract<WorkflowRecordV2, { kind: "routes" }>;

export function routeRecordToPresentation(route: RouteRecord | null): MapPresentation {
  if (!route) return emptyPresentation();
  const legs = [...route.data.legs].sort((a, b) => a.sequence - b.sequence);
  const firstEndpoint = route.data.origin ?? legs[0]?.origin;
  const lastEndpoint = route.data.destination ?? legs.at(-1)?.destination;
  const markers: MapPresentation["markers"] = [];
  if (firstEndpoint && validCoordinate(firstEndpoint.lat, firstEndpoint.lng)) markers.push({ kind: "origin", point: { lat: firstEndpoint.lat!, lng: firstEndpoint.lng! }, label: firstEndpoint.label });
  if (lastEndpoint && validCoordinate(lastEndpoint.lat, lastEndpoint.lng)) markers.push({ kind: "destination", point: { lat: lastEndpoint.lat!, lng: lastEndpoint.lng! }, label: lastEndpoint.label });
  const points = legs.map((leg) => [leg.origin, ...leg.waypoints.map((waypoint) => waypoint.location), leg.destination]);
  const complete = points.length > 0 && points.every((leg) => leg.length >= 2 && leg.every((point) =>
    validCoordinate(point.lat, point.lng)));
  const source = route.data.geographicSource?.kind ?? null;
  const endpointMismatch = legs.length > 0 && markers.length === 2 && (
    legs[0].origin.lat !== markers[0].point.lat || legs[0].origin.lng !== markers[0].point.lng
    || legs.at(-1)!.destination.lat !== markers[1].point.lat || legs.at(-1)!.destination.lng !== markers[1].point.lng);
  if (endpointMismatch) return emptyPresentation();
  if (!complete || route.data.confidence === "UNKNOWN") return {
    ...emptyPresentation(), markers, geometrySource: source,
  };
  return {
    selectedCandidate: null,
    markers,
    paths: points.map((leg) => leg.map((point) => ({ lat: point.lat!, lng: point.lng! }))),
    provenanceStatus: route.data.confidence,
    geometrySource: source,
    pathProvenance: legs.map(leg => leg.source?.provenanceStatus ?? route.data.confidence),
    distanceKm: route.data.estimatedDistanceKm,
    estimatedTransitHours: route.data.estimatedDurationSeconds === null ? null : route.data.estimatedDurationSeconds / 3600,
  };
}

function emptyPresentation(): MapPresentation {
  return { selectedCandidate: null, markers: [], paths: [], provenanceStatus: "UNKNOWN", geometrySource: null,
    distanceKm: null, estimatedTransitHours: null };
}
