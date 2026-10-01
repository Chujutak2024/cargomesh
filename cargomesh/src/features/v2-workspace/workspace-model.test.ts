import assert from "node:assert/strict";
import test from "node:test";
import { getMapPresentation } from "@/features/v2-road-map/road-map-model";
import { applyDraftChange, initialDraft, mapPropsForDraft, readDraft, validateStep } from "./workspace-model";

test("the V2 workspace never restores the legacy Callao to Santiago draft", () => {
  const restored = readDraft(JSON.stringify({
    originId: "callao", destinationId: "santiago", quantity: 10,
    cargoDescription: "Maquinaria", unitWeightKg: 800,
  }));
  assert.equal(restored.destinationId, "arequipa");
  assert.equal(restored.originId, "callao");
});

test("the workspace never substitutes synthetic geometry for a missing road preview", () => {
  const scenario = mapPropsForDraft(initialDraft, "road-scenario", () => {});
  assert.equal(scenario.overallStatus, "unknown");
  assert.equal(scenario.candidates[0].status, "unknown");
  assert.equal(scenario.candidates[0].routePreview, null);
  assert.equal(getMapPresentation(scenario).paths.length, 0);
  assert.equal(getMapPresentation(scenario).distanceKm, null);

  const english = mapPropsForDraft(initialDraft, "road-scenario", () => {}, "en");
  assert.equal(english.origin.label, "Callao · scenario location");
  assert.equal(english.candidates[0].carrierName, "Road preview · no carrier");

  const reversed = mapPropsForDraft({ ...initialDraft, originId: "arequipa", destinationId: "callao" }, null, () => {});
  assert.equal(reversed.candidates.length, 0);
  assert.equal(getMapPresentation(reversed).paths.length, 0);
});

test("a provider preview keeps eligibility unknown and requires controlled selection", () => {
  const preview = {
    corridorCode: null, distanceKm: 10, estimatedTransitHours: 1,
    geometrySource: "GOOGLE_ROUTES_API", provenanceStatus: "ESTIMATED" as const,
    legs: [{ sequence: 1, mode: "ROAD" as const, originLabel: "Callao", destinationLabel: "Arequipa",
      waypoints: [{ lat: -12.0464, lng: -77.1181 }, { lat: -16.409, lng: -71.5375 }], conditions: [] }],
  };
  const props = mapPropsForDraft(initialDraft, "road-scenario", () => {}, "es", preview);
  assert.equal(props.candidates[0].status, "unknown");
  assert.equal(props.overallStatus, "unknown");
  assert.equal(getMapPresentation(props).geometrySource, "GOOGLE_ROUTES_API");
  assert.equal(getMapPresentation(props).provenanceStatus, "ESTIMATED");
  assert.equal(getMapPresentation({ ...props, selectedCandidateId: null }).paths.length, 0);
});

test("review requires distinct locations, valid cargo and ordered dates", () => {
  assert.equal(validateStep(initialDraft, "review"), false);
  const valid = { ...initialDraft, pickupDate: "2026-10-01", deliveryDate: "2026-10-03" };
  assert.equal(validateStep(valid, "review"), true);
  assert.equal(validateStep({ ...valid, destinationId: "callao" }, "context"), false);
  assert.equal(validateStep({ ...valid, unitWeightKg: 0 }, "cargo"), false);
  assert.equal(validateStep({ ...valid, deliveryDate: "2026-09-30" }, "schedule"), false);
});

test("editing a saved route invalidates completion and a malformed saved review is downgraded", () => {
  const reviewed = {
    ...initialDraft, pickupDate: "2026-10-01", deliveryDate: "2026-10-03",
    completedStep: 5, savedForReview: true,
  };
  const changed = applyDraftChange(reviewed, { destinationId: "piura" });
  assert.equal(changed.completedStep, 0);
  assert.equal(changed.savedForReview, false);
  assert.equal(mapPropsForDraft(changed, "road-scenario", () => {}).candidates.length, 0);

  const invalid = readDraft(JSON.stringify({ ...reviewed, deliveryDate: "2026-09-30" }));
  assert.equal(invalid.completedStep, 3);
  assert.equal(invalid.savedForReview, false);
});
