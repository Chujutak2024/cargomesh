import { findRoadLocation, landRoutePolicy } from "@/features/v2-workspace/road-locations";
import type { RoadRoutePreviewDto } from "@/features/v2-road-map/road-map-contract";

type Point = { lat: number; lng: number };
type Location = Point & { city: string };
type RouteResult = {
  status: "estimated";
  routePreview: RoadRoutePreviewDto;
  calculatedAt: string;
} | { status: "unavailable"; routePreview: null; reason?: "non_road_route" }
  | { status: "blocked"; routePreview: null; reason: "no_land_connection" };

/** Decode Google's declared geometry; never interpolate a missing segment. */
export function decodeRoutePolyline(encoded: string): Point[] {
  if (!encoded.length || encoded.length > 1_000_000) throw new Error("INVALID_GEOMETRY");
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points: Point[] = [];
  const delta = () => {
    let value = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length || shift > 30) throw new Error("INVALID_GEOMETRY");
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error("INVALID_GEOMETRY");
      value += (byte & 31) * 2 ** shift;
      shift += 5;
    } while (byte >= 32);
    return value % 2 ? -(Math.floor(value / 2) + 1) : value / 2;
  };
  while (index < encoded.length) {
    lat += delta();
    lng += delta();
    const point = { lat: lat / 100_000, lng: lng / 100_000 };
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) throw new Error("INVALID_GEOMETRY");
    points.push(point);
  }
  if (points.length < 2) throw new Error("INVALID_GEOMETRY");
  return points;
}

export async function computeRoadPreview({ origin, destination, apiKey, fetcher = fetch }: {
  origin: Location;
  destination: Location;
  apiKey?: string;
  fetcher?: typeof fetch;
}): Promise<RouteResult> {
  if (!apiKey?.trim()) return { status: "unavailable", routePreview: null };
  const waypoint = (point: Point) => ({ location: { latLng: { latitude: point.lat, longitude: point.lng } } });
  try {
    const response = await fetcher("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction.maneuver",
      },
      body: JSON.stringify({
        origin: waypoint(origin), destination: waypoint(destination),
        travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE",
        routeModifiers: { avoidFerries: true },
        computeAlternativeRoutes: false, polylineQuality: "HIGH_QUALITY", units: "METRIC",
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return { status: "unavailable", routePreview: null };
    const payload = await response.json();
    const route = payload?.routes?.[0];
    const seconds = typeof route?.duration === "string" && /^\d+(?:\.\d+)?s$/.test(route.duration)
      ? Number(route.duration.slice(0, -1)) : NaN;
    if (!Number.isFinite(route?.distanceMeters) || route.distanceMeters <= 0 || !Number.isFinite(seconds) || seconds <= 0
      || typeof route?.polyline?.encodedPolyline !== "string") return { status: "unavailable", routePreview: null };
    // avoidFerries is only a preference. Inspect every returned step and fail
    // closed if the provider omits step modes or includes ferries/rail/transit.
    if (!Array.isArray(route.legs) || !route.legs.length
      || route.legs.some((leg: { steps?: unknown[] }) => !Array.isArray(leg?.steps) || !leg.steps.length)) {
      return { status: "unavailable", routePreview: null };
    }
    const steps = route.legs.flatMap((leg: { steps: { travelMode?: string; navigationInstruction?: { maneuver?: string } }[] }) => leg.steps);
    if (steps.some((step: { navigationInstruction?: { maneuver?: string } }) =>
      !step || typeof step.navigationInstruction?.maneuver !== "string" || !step.navigationInstruction.maneuver.length)) {
      return { status: "unavailable", routePreview: null };
    }
    if (steps.some((step: { travelMode?: string; navigationInstruction?: { maneuver?: string } }) =>
      !step || step.travelMode !== "DRIVE" || ["FERRY", "FERRY_TRAIN"].includes(step.navigationInstruction?.maneuver ?? ""))) {
      return { status: "unavailable", routePreview: null, reason: "non_road_route" };
    }
    const waypoints = decodeRoutePolyline(route.polyline.encodedPolyline);
    return {
      status: "estimated", calculatedAt: new Date().toISOString(),
      routePreview: {
        corridorCode: null,
        distanceKm: Math.round(route.distanceMeters / 100) / 10,
        estimatedTransitHours: Math.round(seconds / 36) / 100,
        geometrySource: "GOOGLE_ROUTES_API", provenanceStatus: "ESTIMATED",
        legs: [{ sequence: 1, mode: "ROAD", originLabel: origin.city, destinationLabel: destination.city, waypoints,
          conditions: [{ code: "DRIVING_ROUTE_NOT_TRUCK_VALIDATED", severity: "WARNING", provenanceStatus: "ESTIMATED",
            description: "Driving estimate; truck restrictions and commercial facilities have not been verified." }] }],
      },
    };
  } catch {
    // Never return/log provider errors, credential headers, or raw responses.
    return { status: "unavailable", routePreview: null };
  }
}

/** Local workspace adapter, separate from HAC-12 serviceability and HAC-14. */
export function createLocalRoadPreviewHandler({ enabled, apiKey, fetcher = fetch }: {
  enabled: boolean;
  apiKey?: string;
  fetcher?: typeof fetch;
}) {
  const pending = new Map<string, Promise<RouteResult>>();
  let requestTimes: number[] = [];
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  return async (request: Request) => {
    const url = new URL(request.url);
    // Next may reconstruct request.url with an internal host. Validate the
    // actual HTTP Host and browser Origin instead of that internal URL origin.
    const localOrigin = "http://127.0.0.1:8080";
    if (!enabled || url.protocol !== "http:" || request.headers.get("host") !== "127.0.0.1:8080") return json({ error: "NOT_AVAILABLE" }, 404);
    if (request.headers.get("origin") !== localOrigin) return json({ error: "FORBIDDEN" }, 403);
    if (request.method !== "POST" || !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "INVALID_REQUEST" }, 400);
    const text = await request.text();
    if (text.length > 256) return json({ error: "INVALID_REQUEST" }, 400);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ error: "INVALID_REQUEST" }, 400); }
    if (!body || typeof body !== "object") return json({ error: "INVALID_REQUEST" }, 400);
    const { originId, destinationId } = body as Record<string, unknown>;
    const policy = landRoutePolicy(originId, destinationId);
    if (policy === "invalid_location" || policy === "same_location") return json({ error: "INVALID_ROUTE" }, 400);
    if (policy === "disconnected_networks") return json({ status: "blocked", routePreview: null, reason: "no_land_connection" });
    const origin = findRoadLocation(originId)!;
    const destination = findRoadLocation(destinationId)!;
    const pair = `${origin.id}:${destination.id}`;
    // Deduplicate only the same pair. A response for Madrid must never be
    // returned to a simultaneous request for Callao. Bound paid calls locally.
    let calculation = pending.get(pair);
    if (!calculation) {
      const now = Date.now();
      requestTimes = requestTimes.filter(time => now - time < 60_000);
      if (requestTimes.length >= 20) return json({ status: "unavailable", routePreview: null }, 429);
      requestTimes.push(now);
      calculation = computeRoadPreview({ origin, destination, apiKey, fetcher });
      pending.set(pair, calculation);
      void calculation.finally(() => { if (pending.get(pair) === calculation) pending.delete(pair); });
    }
    return json(await calculation);
  };
}
