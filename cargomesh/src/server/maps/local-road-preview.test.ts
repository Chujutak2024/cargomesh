import assert from "node:assert/strict";
import test from "node:test";
import { computeRoadPreview, createLocalRoadPreviewHandler, decodeRoutePolyline } from "./local-road-preview";

const polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
const locations = { origin: { lat: -12.0464, lng: -77.1181, city: "Callao" }, destination: { lat: -16.409, lng: -71.5375, city: "Arequipa" } };
const providerBody = { routes: [{ distanceMeters: 1015500, duration: "64800s", polyline: { encodedPolyline: polyline } }] };
const mockFetch = (body: unknown = providerBody, status = 200): typeof fetch => async () => Response.json(body, { status });
const localRequest = (body: unknown = { originId: "callao", destinationId: "arequipa" }, origin = "http://127.0.0.1:8080", url = "http://127.0.0.1:8080/api/local/road-preview") => new Request(url, {
  method: "POST", headers: { "Host": new URL(url).host, "Origin": origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("decodes declared Google polyline points without interpolation", () => {
  assert.deepEqual(decodeRoutePolyline(polyline), [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]);
  for (const malformed of ["", "_", "?", "!!!!!!!!", "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"]) assert.throws(() => decodeRoutePolyline(malformed));
});

test("sends canonical coordinates to Routes from the server and retains estimated provenance", async () => {
  let called = 0;
  const result = await computeRoadPreview({ ...locations, apiKey: "test-only-secret", fetcher: async (url, options) => {
    called++;
    assert.equal(url, "https://routes.googleapis.com/directions/v2:computeRoutes");
    const body = JSON.parse(options?.body as string);
    assert.equal(body.origin.location.latLng.latitude, locations.origin.lat);
    assert.equal(body.destination.location.latLng.longitude, locations.destination.lng);
    assert.equal(body.travelMode, "DRIVE");
    assert.equal(body.polylineQuality, "HIGH_QUALITY");
    assert.equal(body.routingPreference, "TRAFFIC_UNAWARE");
    assert.equal((options?.headers as Record<string, string>)["X-Goog-Api-Key"], "test-only-secret");
    assert.equal(options?.cache, "no-store");
    return Response.json(providerBody);
  } });
  assert.equal(called, 1);
  assert.equal(result.status, "estimated");
  if (result.status !== "estimated") assert.fail("expected provider preview");
  assert.equal(result.routePreview.geometrySource, "GOOGLE_ROUTES_API");
  assert.equal(result.routePreview.provenanceStatus, "ESTIMATED");
  assert.equal(result.routePreview.distanceKm, 1015.5);
  assert.equal(result.routePreview.estimatedTransitHours, 18);
  assert.equal(result.routePreview.legs[0].waypoints.length, 3);
  assert.match(result.calculatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(result.routePreview.legs[0].conditions.some(condition => condition.code === "DRIVING_ROUTE_NOT_TRUCK_VALIDATED"));
  assert.doesNotMatch(JSON.stringify(result), /test-only-secret|X-Goog-Api-Key|SIMULATED/);
});

test("missing key and upstream failure never produce replacement geometry or leak errors", async () => {
  let calls = 0;
  const noKey = await computeRoadPreview({ ...locations, fetcher: async () => { calls++; throw new Error("no key"); } });
  assert.deepEqual(noKey, { status: "unavailable", routePreview: null });
  assert.equal(calls, 0);
  for (const fetcher of [mockFetch({ error: { message: "sensitive upstream response" } }, 403),
    async () => { throw new Error("sensitive credential detail"); }]) {
    const result = await computeRoadPreview({ ...locations, apiKey: "test-only-secret", fetcher });
    assert.deepEqual(result, { status: "unavailable", routePreview: null });
  }
});

test("empty, malformed or incomplete provider responses have no geometry or metrics", async () => {
  for (const body of [{ routes: [] }, { routes: [{ ...providerBody.routes[0], duration: "invalid" }] },
    { routes: [{ ...providerBody.routes[0], distanceMeters: -1 }] },
    { routes: [{ ...providerBody.routes[0], polyline: { encodedPolyline: "_" } }] }]) {
    const result = await computeRoadPreview({ ...locations, apiKey: "test-only-secret", fetcher: mockFetch(body) });
    assert.deepEqual(result, { status: "unavailable", routePreview: null });
  }
});

test("local adapter is disabled by default and rejects non-local or foreign origins before calling Google", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json(providerBody); };
  const disabled = createLocalRoadPreviewHandler({ enabled: false, apiKey: "test", fetcher });
  assert.equal((await disabled(localRequest())).status, 404);
  const handler = createLocalRoadPreviewHandler({ enabled: true, apiKey: "test", fetcher });
  assert.equal((await handler(localRequest(undefined, "https://foreign.example"))).status, 403);
  assert.equal((await handler(localRequest(undefined, "https://app.example", "https://app.example/api/local/road-preview"))).status, 404);
  assert.equal(calls, 0);
});

test("invalid IDs, unsupported pairs and oversize bodies cannot make paid routing calls", async () => {
  let calls = 0;
  const handler = createLocalRoadPreviewHandler({ enabled: true, apiKey: "test", fetcher: async () => { calls++; return Response.json(providerBody); } });
  for (const body of [null, { originId: "callao", destinationId: "piura" }, { originId: "unknown", destinationId: "arequipa" },
    { originId: "callao", destinationId: "arequipa", extra: "a".repeat(300) }]) assert.equal((await handler(localRequest(body))).status, 400);
  assert.equal(calls, 0);
});

test("Next internal URL reconstruction does not reject an authorized local Host and Origin", async () => {
  const handler = createLocalRoadPreviewHandler({ enabled: true, apiKey: "test", fetcher: mockFetch() });
  const request = new Request("http://localhost:8080/api/local/road-preview", {
    method: "POST", headers: { Host: "127.0.0.1:8080", Origin: "http://127.0.0.1:8080", "Content-Type": "application/json" },
    body: JSON.stringify({ originId: "callao", destinationId: "arequipa" }),
  });
  assert.equal((await handler(request)).status, 200);
});

test("duplicate in-flight requests share one call and rapid repeated calls are limited", async () => {
  let calls = 0;
  const handler = createLocalRoadPreviewHandler({ enabled: true, apiKey: "test", fetcher: async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return Response.json(providerBody);
  } });
  const responses = await Promise.all([handler(localRequest()), handler(localRequest())]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(calls, 1);
  assert.equal((await handler(localRequest())).status, 429);
  assert.equal(calls, 1);
});
