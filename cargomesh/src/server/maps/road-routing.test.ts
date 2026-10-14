import assert from "node:assert/strict";
import test from "node:test";
import { findRoadLocation } from "@/features/v2-workspace/road-locations";
import { calculateRoadRoutes, evaluateRoadAlternatives, selectRoadAlternative } from "./road-routing";
import { createRoadRoutingHandler } from "./road-routing-http";
import type { Point } from "@/features/road-route-lab/contract";

// Synthetic transport-contract fixtures only; these two-point shapes are not real roads
// and are never served by the application. Live geometry must come from Google.
function encode(points: Point[]) {
  let lat = 0, lng = 0, encoded = "";
  const component = (n: number) => {
    let v = n < 0 ? ~(n << 1) : n << 1; let out = "";
    while (v >= 32) { out += String.fromCharCode((32 | (v & 31)) + 63); v >>>= 5; }
    return out + String.fromCharCode(v + 63);
  };
  for (const point of points) {
    const nextLat = Math.round(point.lat * 100000), nextLng = Math.round(point.lng * 100000);
    encoded += component(nextLat - lat) + component(nextLng - lng); lat = nextLat; lng = nextLng;
  }
  return encoded;
}
const origin = findRoadLocation("lima")!, destination = findRoadLocation("arequipa")!;
const input = { origin, destination, objective: "FASTEST" as const, traffic: "TRAFFIC_AWARE_OPTIMAL" as const, calculatedAt: "2026-10-14T00:00:00Z" };
const candidate = (distanceMeters = 1000, seconds = 100, points: Point[] = [origin, destination]) => ({ distanceMeters, duration: `${seconds}s`,
  polyline: { encodedPolyline: encode(points) }, legs: [{ steps: [{ travelMode: "DRIVE", navigationInstruction: { maneuver: "DEPART" } }] }] });
const response = (routes: unknown[]) => ({ routes });
const request = (body: unknown = { originId: "lima", destinationId: "arequipa", objective: "FASTEST", traffic: "TRAFFIC_AWARE_OPTIMAL" }, overrides: Record<string, string> = {}) => new Request("http://localhost:8080/api/local/route-lab", {
  method: "POST", headers: { Host: "127.0.0.1:8080", Origin: "http://127.0.0.1:8080", "Content-Type": "application/json", ...overrides }, body: JSON.stringify(body),
});

test("selection minimizes the declared objective, not provider order", () => {
  const payload = response([candidate(1000, 100), candidate(1200, 80), candidate(900, 110)]);
  const fastest = evaluateRoadAlternatives(payload, input);
  const shortest = evaluateRoadAlternatives(payload, { ...input, objective: "SHORTEST_RETURNED" });
  assert.equal(fastest.status, "estimated"); assert.equal(shortest.status, "estimated");
  if (fastest.status !== "estimated" || shortest.status !== "estimated") return;
  assert.equal(fastest.selectedId, "google-1"); assert.equal(shortest.selectedId, "google-2");
  assert.equal(fastest.scope, "RETURNED_ALTERNATIVES_ONLY"); assert.equal(fastest.truckAccess, "UNVERIFIED");
  assert.equal(fastest.policyVersion, "returned-road-alternatives/v1");
  assert.deepEqual(fastest.alternatives[0].points, [origin, destination].map(({ lat, lng }) => ({ lat, lng })));
});

test("tie breaks by the secondary metric then original index, independent of input ordering", () => {
  const result = evaluateRoadAlternatives(response([candidate(), candidate(), candidate(1200)]), input);
  assert.equal(result.status, "estimated"); if (result.status !== "estimated") return;
  assert.equal(selectRoadAlternative([...result.alternatives].reverse(), "FASTEST")?.id, "google-0");
  assert.equal(selectRoadAlternative([], "FASTEST"), null);
});

test("malformed alternatives cannot hide a later valid route; original index retained", () => {
  const result = evaluateRoadAlternatives(response([null, { ...candidate(), duration: "0s" }, candidate()]), input);
  assert.equal(result.status, "estimated"); if (result.status !== "estimated") return;
  assert.equal(result.selectedId, "google-2"); assert.equal(result.rejected.length, 2);
});

test("all legs must be road-only; ferry preference alone is not proof", () => {
  for (const [travelMode, maneuver] of [["DRIVE", "FERRY"], ["DRIVE", "FERRY_TRAIN"], ["WALK", "STRAIGHT"]]) {
    const invalid = candidate(); invalid.legs.push({ steps: [{ travelMode, navigationInstruction: { maneuver } }] });
    const result = evaluateRoadAlternatives(response([invalid, candidate()]), input);
    assert.equal(result.status, "estimated"); if (result.status === "estimated") assert.equal(result.rejected[0].reason, "NON_ROAD_SEGMENT");
  }
});

test("rejects wrong, reversed or broken geometry and ignored restrictions without fallback", () => {
  for (const bad of [candidate(1000, 100, [destination, origin]), candidate(1000, 100, [{ lat: 40, lng: 1 }, { lat: 41, lng: 2 }]),
    { ...candidate(), polyline: { encodedPolyline: "_" } },
    { ...candidate(), travelAdvisory: { routeRestrictionsPartiallyIgnored: true } }, { ...candidate(), legs: [] }]) {
    const result = evaluateRoadAlternatives(response([bad]), input);
    assert.deepEqual(result, { status: "unavailable", reason: "NO_VALID_ROAD_ROUTE", alternatives: [] });
  }
  assert.equal(evaluateRoadAlternatives(response([]), input).status, "unavailable");
  assert.equal(evaluateRoadAlternatives(response(Array(5).fill(candidate())), input).status, "unavailable");
});

test("server requests high-quality alternatives with the chosen traffic model and no truck claim", async () => {
  const result = await calculateRoadRoutes({ ...input, apiKey: "test-only-secret", fetcher: async (url, options) => {
    assert.equal(url, "https://routes.googleapis.com/directions/v2:computeRoutes");
    const body = JSON.parse(options?.body as string);
    assert.equal(body.travelMode, "DRIVE"); assert.equal(body.routingPreference, input.traffic);
    assert.equal(body.computeAlternativeRoutes, true); assert.equal(body.polylineQuality, "HIGH_QUALITY");
    assert.equal(body.polylineEncoding, "ENCODED_POLYLINE"); assert.equal(body.routeModifiers.avoidFerries, true);
    assert.equal(body.origin.location.latLng.latitude, origin.lat);
    assert.equal(body.intermediates, undefined); assert.equal(options?.cache, "no-store");
    assert.match((options?.headers as Record<string, string>)["X-Goog-FieldMask"], /routes.travelAdvisory/);
    return Response.json(response([candidate()]));
  } });
  assert.equal(result.status, "estimated"); assert.doesNotMatch(JSON.stringify(result), /test-only-secret|Api-Key/);
});

test("missing server key, denial, timeout, malformed JSON and upstream errors expose no credential or geometry", async () => {
  const noKey = await calculateRoadRoutes({ ...input, fetcher: async () => { assert.fail("should not call Google"); } });
  assert.equal(noKey.status === "unavailable" && noKey.reason, "SERVER_KEY_MISSING");
  for (const fetcher of [async () => Response.json({ error: "secret" }, { status: 403 }),
    async () => Response.json({ error: "secret" }, { status: 500 }), async () => new Response("bad json"),
    async () => { throw new Error("timeout contains secret"); }]) {
    const result = await calculateRoadRoutes({ ...input, apiKey: "secret", fetcher });
    assert.equal(result.status, "unavailable"); assert.deepEqual(result.alternatives, []);
    assert.doesNotMatch(JSON.stringify(result), /secret/);
  }
});

test("local disabled/origin/Host/content/body validation prevent paid calls", async () => {
  let calls = 0; const config = { enabled: true, apiKey: "test", fetcher: async () => { calls++; return Response.json(response([candidate()])); } };
  assert.equal((await createRoadRoutingHandler({ ...config, enabled: false })(request())).status, 404);
  assert.equal((await createRoadRoutingHandler({ ...config, localOrigin: "https://app.example" })(request())).status, 404);
  const handler = createRoadRoutingHandler(config);
  assert.equal((await handler(request(undefined, { Origin: "https://foreign.example" }))).status, 403);
  assert.equal((await handler(request(undefined, { Host: "foreign.example" }))).status, 404);
  assert.equal((await handler(request(undefined, { "Content-Type": "text/plain" }))).status, 400);
  for (const body of [null, { originId: "lima", destinationId: "lima", objective: "FASTEST", traffic: input.traffic },
    { originId: "unknown", destinationId: "arequipa", objective: "FASTEST", traffic: input.traffic },
    { originId: "lima", destinationId: "arequipa", objective: "BAD", traffic: input.traffic }, { extra: "x".repeat(600) }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  assert.equal(calls, 0);
});

test("city scenarios use catalog coordinates; synthetic responses test plumbing, not real road access", async () => {
  for (const [originId, destinationId] of [["lima", "arequipa"], ["lima", "huancayo"], ["cl-santiago", "buenos-aires"], ["madrid", "barcelona"], ["los-angeles", "las-vegas"]]) {
    const a = findRoadLocation(originId)!, b = findRoadLocation(destinationId)!;
    const handler = createRoadRoutingHandler({ enabled: true, apiKey: "test", fetcher: async (_url, options) => {
      const query = JSON.parse(options?.body as string);
      assert.deepEqual(query.origin.location.latLng, { latitude: a.lat, longitude: a.lng });
      assert.deepEqual(query.destination.location.latLng, { latitude: b.lat, longitude: b.lng });
      return Response.json(response([candidate(1000, 100, [a, b])]));
    } });
    const res = await handler(request({ originId, destinationId, objective: "FASTEST", traffic: input.traffic }));
    assert.equal(res.status, 200); assert.equal((await res.json()).status, "estimated");
  }
});

test("disconnected city networks block before missing credentials or paid calls", async () => {
  const handler = createRoadRoutingHandler({ enabled: true, fetcher: async () => { assert.fail("no call"); } });
  for (const [originId, destinationId] of [["bogota", "houston"], ["lima", "madrid"], ["sydney", "singapore"]]) {
    assert.equal((await (await handler(request({ originId, destinationId, objective: "FASTEST", traffic: input.traffic }))).json()).reason, "DISCONNECTED_NETWORKS");
  }
  assert.equal((await handler(request())).status, 503);
});

test("deduplicates only simultaneous identical queries; objectives and cities never share a result", async () => {
  let calls = 0;
  const handler = createRoadRoutingHandler({ enabled: true, apiKey: "test", fetcher: async () => {
    calls++; await new Promise(resolve => setTimeout(resolve, 15)); return Response.json(response([candidate(1000, 100), candidate(1200, 80)]));
  } });
  const results = await Promise.all([handler(request()), handler(request()), handler(request({ originId: "lima", destinationId: "arequipa", objective: "SHORTEST_RETURNED", traffic: input.traffic }))]);
  assert.equal(calls, 2); const data = await Promise.all(results.map(res => res.json()));
  assert.equal(data[0].selectedId, "google-1"); assert.equal(data[2].selectedId, "google-0");
  await handler(request()); assert.equal(calls, 3); // no completed-result cache
});

test("ten calls per process per minute budget and reset", async () => {
  let now = 0;
  const handler = createRoadRoutingHandler({ enabled: true, apiKey: "test", now: () => now,
    fetcher: async () => Response.json(response([candidate()])) });
  for (let i = 0; i < 10; i++) assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 429);
  now = 60_000; assert.equal((await handler(request())).status, 200);
});
