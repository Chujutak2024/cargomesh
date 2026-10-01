import { facilities } from "@/features/v2-workspace/workspace-model";
import type { RoadRoutePreviewDto } from "@/features/v2-road-map/road-map-contract";

type Point = { lat: number; lng: number };
type Location = Point & { city: string };
type RouteResult = {
  status: "estimated";
  routePreview: RoadRoutePreviewDto;
  calculatedAt: string;
} | { status: "unavailable"; routePreview: null };

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
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(origin), destination: waypoint(destination),
        travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE",
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
  let lastRequestAt = 0;
  let pending: Promise<RouteResult> | null = null;
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
    // This adapter can only preview the existing local scenario. It does not
    // create carrier candidates or turn other pairs into eligible services.
    if (originId !== "callao" || destinationId !== "arequipa") return json({ error: "INVALID_ROUTE" }, 400);
    if (!pending && Date.now() - lastRequestAt < 5000) return json({ status: "unavailable", routePreview: null }, 429);
    if (!pending) {
      lastRequestAt = Date.now();
      pending = computeRoadPreview({ origin: facilities[0], destination: facilities[1], apiKey, fetcher });
    }
    try { return json(await pending); } finally { pending = null; }
  };
}
