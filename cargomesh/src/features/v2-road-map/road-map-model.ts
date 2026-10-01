import type { RoadCandidateMapViewProps, RoadRoutePreviewDto } from "./road-map-contract";

export type MapProvider = "google" | "openstreetmap" | "none" | "loading";
export type Coordinate = { lat: number; lng: number };
export function isGoogleRoutesSource(source: string | null): boolean {
  return source?.trim().toUpperCase().startsWith("GOOGLE_ROUTES") ?? false;
}
export function canRenderGeometry(provider: MapProvider, source: string | null): boolean {
  return provider === "google" || (provider === "openstreetmap" && !isGoogleRoutesSource(source));
}
export type MapPresentation = {
  selectedCandidate: RoadCandidateMapViewProps["candidates"][number] | null;
  markers: Array<{ kind: "origin" | "destination"; point: Coordinate; label: string }>;
  paths: Coordinate[][];
  provenanceStatus: RoadRoutePreviewDto["provenanceStatus"];
  geometrySource: string | null;
  distanceKm: number | null;
  estimatedTransitHours: number | null;
};

export function validCoordinate(lat: number | null, lng: number | null): lat is number {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function getMapPresentation(props: RoadCandidateMapViewProps): MapPresentation {
  const selectedCandidate = props.candidates.find((candidate) => candidate.candidateId === props.selectedCandidateId) ?? null;
  const markers: MapPresentation["markers"] = [];
  if (validCoordinate(props.origin.lat, props.origin.lng)) {
    markers.push({ kind: "origin", point: { lat: props.origin.lat, lng: props.origin.lng! }, label: props.origin.label });
  }
  if (validCoordinate(props.destination.lat, props.destination.lng)) {
    markers.push({ kind: "destination", point: { lat: props.destination.lat, lng: props.destination.lng! }, label: props.destination.label });
  }

  const preview = selectedCandidate?.routePreview ?? null;
  const declaredSource = preview?.geometrySource.trim() || null;
  const hasEndpointCoordinates = markers.length === 2;
  const hasDeclaredGeometry = preview !== null && preview.provenanceStatus !== "UNKNOWN"
    && declaredSource !== null && !declaredSource.toUpperCase().startsWith("NONE") && preview.legs.length > 0;
  const completeLegs = hasDeclaredGeometry && preview.legs.every((leg) =>
    leg.waypoints.length >= 2 && leg.waypoints.every((point) => validCoordinate(point.lat, point.lng)));
  // Each declared leg is drawn independently: no invented segment bridges gaps.
  const paths = hasEndpointCoordinates && completeLegs
    ? preview.legs.map((leg) => leg.waypoints.map(({ lat, lng }) => ({ lat, lng })))
    : [];
  const hasUsableRoute = paths.length > 0;

  return {
    selectedCandidate,
    markers,
    paths,
    provenanceStatus: hasUsableRoute ? preview!.provenanceStatus : "UNKNOWN",
    geometrySource: declaredSource,
    distanceKm: hasUsableRoute && preview?.distanceKm !== null && Number.isFinite(preview?.distanceKm) && preview!.distanceKm! >= 0
      ? preview!.distanceKm : null,
    estimatedTransitHours: hasUsableRoute && preview?.estimatedTransitHours !== null && Number.isFinite(preview?.estimatedTransitHours) && preview!.estimatedTransitHours! >= 0
      ? preview!.estimatedTransitHours : null,
  };
}

export function routeSourceLabel(source: string | null, locale: "es" | "en"): string | null {
  if (!source || source.toUpperCase().startsWith("NONE")) return null;
  if (isGoogleRoutesSource(source)) return "Google Routes";
  if (source === "SCENARIO_SYNTHETIC_GEOMETRY") return locale === "es" ? "escenario simulado" : "simulated scenario";
  // Unknown internal adapter identifiers must not be leaked into user-facing text.
  return locale === "es" ? "fuente no identificada" : "unidentified source";
}

export function providerNote(provider: MapProvider, presentation: MapPresentation, locale: "es" | "en"): string {
  const es = locale === "es";
  if (provider === "loading") return es ? "Cargando proveedor cartográfico…" : "Loading map provider…";
  if (provider === "none") return es ? "Proveedor cartográfico: no disponible" : "Map provider: unavailable";
  const mapName = provider === "google" ? "Google Maps Platform" : "OpenStreetMap";
  const prefix = es ? `Mapa: ${mapName}` : `Map: ${mapName}`;
  if (presentation.paths.length === 0 || !canRenderGeometry(provider, presentation.geometrySource)) {
    return `${prefix} · ${es ? "Geometría de ruta no disponible" : "Route geometry unavailable"}`;
  }
  if (presentation.provenanceStatus === "SIMULATED") {
    return `${prefix} · ${es ? "Geometría simulada" : "Simulated geometry"}`;
  }
  const source = routeSourceLabel(presentation.geometrySource, locale);
  const status = presentation.provenanceStatus === "VERIFIED"
    ? (es ? "Datos verificados" : "Verified data")
    : (es ? "Datos estimados" : "Estimated data");
  return `${prefix} · ${es ? "Ruta" : "Route"}: ${source ?? (es ? "fuente no identificada" : "unidentified source")} · ${status}`;
}
