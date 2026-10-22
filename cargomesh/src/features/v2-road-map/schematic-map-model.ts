import { validCoordinate, type Coordinate, type MapPresentation } from "./road-map-model";

export type MapFailure = "not-authorized" | "timed-out" | "not-configured" | "unavailable";

/** Display only stable categories, never provider messages or URLs containing a key. */
export function mapFailureCategory(error: unknown): MapFailure {
  const code = error instanceof Error ? error.message : error;
  if (code === "MAP_PROVIDER_AUTH_FAILED") return "not-authorized";
  if (code === "MAP_PROVIDER_TIMEOUT") return "timed-out";
  if (code === "MAP_PROVIDER_NOT_CONFIGURED") return "not-configured";
  return "unavailable";
}

export function mapFailureLabel(failure: MapFailure, locale: "es" | "en") {
  const labels = {
    "not-authorized": ["No autorizado para este sitio", "Not authorized for this site"],
    "timed-out": ["Tiempo de espera agotado", "Timed out"],
    "not-configured": ["No configurado", "Not configured"],
    unavailable: ["Proveedor no disponible", "Provider unavailable"],
  };
  return labels[failure][locale === "es" ? 0 : 1];
}

/** The same operation-only point set drives Google fitBounds and the SVG projection. */
export function operationMapPoints(presentation: MapPresentation): Coordinate[] {
  return [...presentation.markers.map(marker => marker.point), ...presentation.paths.flat()]
    .filter(point => validCoordinate(point.lat, point.lng));
}

export function schematicMapModel(presentation: MapPresentation) {
  const points = operationMapPoints(presentation);
  if (!points.length) return null;
  const minLat = Math.min(...points.map(point => point.lat)), maxLat = Math.max(...points.map(point => point.lat));
  const minLng = Math.min(...points.map(point => point.lng)), maxLng = Math.max(...points.map(point => point.lng));
  const project = (point: Coordinate) => ({
    x: maxLng === minLng ? 400 : 70 + (point.lng - minLng) / (maxLng - minLng) * 660,
    y: maxLat === minLat ? 150 : 50 + (maxLat - point.lat) / (maxLat - minLat) * 200,
  });
  const markers = presentation.markers.filter(marker => validCoordinate(marker.point.lat, marker.point.lng))
    .map(marker => ({ ...marker, ...project(marker.point) }));
  const paths = presentation.paths.flatMap((path, index) => path.length >= 2 && path.every(point => validCoordinate(point.lat, point.lng))
    ? [{ points: path.map(point => { const p = project(point); return `${p.x},${p.y}`; }).join(" "),
      provenance: presentation.pathProvenance?.[index] ?? presentation.provenanceStatus, sequence: index + 1 }] : []);
  // This is explicitly a connection between endpoints, never a declared road leg.
  const connection = !paths.length && markers.length === 2
    ? `${markers[0].x},${markers[0].y} ${markers[1].x},${markers[1].y}` : null;
  return { markers, paths, connection };
}
