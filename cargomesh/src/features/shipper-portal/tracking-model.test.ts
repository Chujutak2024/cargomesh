import assert from "node:assert/strict";
import test from "node:test";
import { routeRecordToPresentation } from "./tracking-model";
import type { WorkflowRecordV2 } from "./shipper-model";

test("missing route never produces geometry", () => {
  const presentation = routeRecordToPresentation(null);
  assert.deepEqual(presentation.paths, []);
  assert.equal(presentation.provenanceStatus, "UNKNOWN");
});

test("unknown provenance or out-of-range coordinates never draw a route", () => {
  const route = { data: { confidence: "VERIFIED", legs: [{ origin: { lat: -12, lng: -77, label: "Lima" },
    waypoints: [], destination: { lat: -16, lng: -71, label: "Arequipa" } }], estimatedDistanceKm: 100,
  estimatedDurationSeconds: 7200 } } as unknown as Extract<WorkflowRecordV2, { kind: "routes" }>;
  assert.equal(routeRecordToPresentation(route).paths.length, 1);
  assert.deepEqual(routeRecordToPresentation({ ...route, data: { ...route.data, confidence: "UNKNOWN" } }).paths, []);
  const bad = { ...route, data: { ...route.data, legs: [{ ...route.data.legs[0], destination: { ...route.data.legs[0].destination, lat: 200 } }] } };
  assert.deepEqual(routeRecordToPresentation(bad).paths, []);
});
