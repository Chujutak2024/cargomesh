import assert from "node:assert/strict";
import test from "node:test";
import type { FreightLocationV2, RoadServiceabilityEvaluationV2Data } from "@/features/v2-intake/contracts";
import { compareEvaluations, endpointChanged, manualLocation } from "./hac35-model";

const original: FreightLocationV2 = { facilityId: "a", label: "Callao", city: "Callao", countryCode: "PE", region: "Lima", lat: -12, lng: -77 };
test("manual changes do not retain stale facility IDs or canonical area", () => {
  const edit = { label: "Otro almacén", city: "Piura", countryCode: "PE", lat: "-5.1", lng: "-80.6" };
  assert.equal(endpointChanged(original, edit), true);
  const next = manualLocation(original, edit);
  assert.equal(next.facilityId, null);
  assert.equal(next.region, null);
  assert.equal(next.lat, -5.1);
  assert.equal(next.lng, -80.6);
});
test("manual location requires complete and valid metadata", () => {
  assert.throws(() => manualLocation(original, { label: "X", city: "", countryCode: "PE", lat: "", lng: "" }));
  assert.throws(() => manualLocation(original, { label: "X", city: "Lima", countryCode: "PE", lat: "91", lng: "-77" }));
  assert.throws(() => manualLocation(original, { label: "X", city: "Lima", countryCode: "PE", lat: "-12", lng: "" }));
});
test("evaluation comparison describes changes without inventing causes", () => {
  const candidate = { candidateId: "a", status: "unknown", reasons: ["NO_CAPACITY_DATA"] };
  const previous = { candidates: [candidate] } as RoadServiceabilityEvaluationV2Data;
  const current = { candidates: [{ ...candidate, status: "eligible", reasons: ["VERIFIED"] }] } as RoadServiceabilityEvaluationV2Data;
  assert.deepEqual(compareEvaluations(previous, current), [{ candidateId: "a", previous: "unknown", current: "eligible", currentReasons: ["VERIFIED"] }]);
  assert.deepEqual(compareEvaluations(null, current), []);
});
