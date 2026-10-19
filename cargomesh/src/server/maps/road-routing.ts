import { z } from "zod";
import type { Point, RoadAlternative, RoadCalculation, RouteObjective, TrafficPreference } from "@/features/road-route-lab/contract";
import { decodeRoutePolyline } from "./local-road-preview";

const routeSchema = z.object({
  distanceMeters: z.number().positive().finite(),
  duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
  polyline: z.object({ encodedPolyline: z.string().min(1).max(1_000_000) }),
  legs: z.array(z.object({ steps: z.array(z.object({
    travelMode: z.string(),
    navigationInstruction: z.object({ maneuver: z.string().min(1) }),
  })).min(1) })).min(1),
  warnings: z.array(z.string().max(4000)).max(30).optional(),
  travelAdvisory: z.object({ routeRestrictionsPartiallyIgnored: z.boolean().optional() }).optional(),
});

/** Exact lexicographic minimum over supplied candidates; never a claim about the full road graph. */
export function selectRoadAlternative(routes: readonly RoadAlternative[], objective: RouteObjective) {
  return [...routes].sort((a, b) => objective === "FASTEST"
    ? a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters || a.providerIndex - b.providerIndex
    : a.distanceMeters - b.distanceMeters || a.durationSeconds - b.durationSeconds || a.providerIndex - b.providerIndex)[0] ?? null;
}

function distanceMeters(a: Point, b: Point) {
  const radians = (n: number) => n * Math.PI / 180;
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function evaluateRoadAlternatives(payload: unknown, input: {
  origin: Point & {maxSnapMeters?:number}; destination: Point & {maxSnapMeters?:number}; objective: RouteObjective; traffic: TrafficPreference; calculatedAt: string;
}): RoadCalculation {
  const envelope = z.object({ routes: z.array(z.unknown()).max(4).optional() }).safeParse(payload);
  const failure = (reason: "NO_ROUTE" | "NO_VALID_ROAD_ROUTE"): RoadCalculation => ({ status: "unavailable", reason, alternatives: [] });
  if (!envelope.success) return failure("NO_VALID_ROAD_ROUTE");
  if (!envelope.data.routes?.length) return failure("NO_ROUTE");
  const alternatives: RoadAlternative[] = [];
  const rejected: { providerIndex: number; reason: string }[] = [];
  envelope.data.routes.forEach((raw, providerIndex) => {
    const reject = (reason: string) => rejected.push({ providerIndex, reason });
    const parsed = routeSchema.safeParse(raw);
    if (!parsed.success) { reject("INCOMPLETE_PROVIDER_DATA"); return; }
    const route = parsed.data;
    const durationSeconds = Number(route.duration.slice(0, -1));
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) { reject("INVALID_DURATION"); return; }
    if (route.travelAdvisory?.routeRestrictionsPartiallyIgnored) { reject("RESTRICTIONS_PARTIALLY_IGNORED"); return; }
    if (route.legs.some(leg => leg.steps.some(step => step.travelMode !== "DRIVE"
      || ["FERRY", "FERRY_TRAIN"].includes(step.navigationInstruction.maneuver)))) { reject("NON_ROAD_SEGMENT"); return; }
    let points: Point[];
    try { points = decodeRoutePolyline(route.polyline.encodedPolyline); }
    catch { reject("INVALID_GEOMETRY"); return; }
    // Routing snaps a city reference to a road. Reject unrelated/reversed geometry,
    // rather than connecting the city reference to the returned path by a made-up segment.
    if (distanceMeters(input.origin, points[0]) > (input.origin.maxSnapMeters ?? 5000)
      || distanceMeters(input.destination, points[points.length - 1]) > (input.destination.maxSnapMeters ?? 5000)) { reject("ENDPOINT_MISMATCH"); return; }
    alternatives.push({ id: `google-${providerIndex}`, providerIndex, distanceMeters: route.distanceMeters,
      durationSeconds, points, warnings: route.warnings ?? [] });
  });
  const selected = selectRoadAlternative(alternatives, input.objective);
  if (!selected) return failure("NO_VALID_ROAD_ROUTE");
  return { status: "estimated", source: "GOOGLE_ROUTES_API", calculatedAt: input.calculatedAt,
    policyVersion: "returned-road-alternatives/v1", scope: "RETURNED_ALTERNATIVES_ONLY", truckAccess: "UNVERIFIED",
    objective: input.objective, traffic: input.traffic, selectedId: selected.id, alternatives, rejected };
}

export async function calculateRoadRoutes(input: {
  origin: Point & {placeId?:string;maxSnapMeters?:number}; destination: Point & {placeId?:string;maxSnapMeters?:number}; objective: RouteObjective; traffic: TrafficPreference;
  apiKey?: string; fetcher?: typeof fetch; departureTime?: string;
}): Promise<RoadCalculation> {
  const fail = (reason: "SERVER_KEY_MISSING" | "PROVIDER_DENIED" | "PROVIDER_UNAVAILABLE"): RoadCalculation => ({ status: "unavailable", reason, alternatives: [] });
  if (!input.apiKey?.trim()) return fail("SERVER_KEY_MISSING");
  const waypoint = (p: Point & {placeId?:string}) => p.placeId ? {placeId:p.placeId} : { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
  try {
    const response = await (input.fetcher ?? fetch)("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction.maneuver,routes.warnings,routes.travelAdvisory" },
      body: JSON.stringify({ origin: waypoint(input.origin), destination: waypoint(input.destination),
        travelMode: "DRIVE", routingPreference: input.traffic, computeAlternativeRoutes: true,
        ...(input.departureTime && input.traffic !== "TRAFFIC_UNAWARE" ? { departureTime: input.departureTime } : {}),
        polylineQuality: "HIGH_QUALITY", polylineEncoding: "ENCODED_POLYLINE", units: "METRIC", languageCode: "en",
        routeModifiers: { avoidFerries: true } }), signal: AbortSignal.timeout(15_000), cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return fail("PROVIDER_DENIED");
    if (!response.ok) return fail("PROVIDER_UNAVAILABLE");
    return evaluateRoadAlternatives(await response.json(), { ...input, calculatedAt: new Date().toISOString() });
  } catch {
    // No provider response, credentials or transport error details escape the adapter.
    return fail("PROVIDER_UNAVAILABLE");
  }
}
