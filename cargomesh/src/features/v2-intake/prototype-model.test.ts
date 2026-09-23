import assert from "node:assert/strict";
import test from "node:test";

import { v2FacilitySchema } from "@/types/v2-road-network";
import {
  EMPTY_PROTOTYPE_DRAFT,
  PROTOTYPE_FACILITIES,
  PROVISIONAL_PROTOTYPE_DRAFT,
  getPrototypeEvidence,
  validatePrototypeDraft,
  validatePrototypeReview,
  validatePrototypeStep,
} from "./prototype-model";

test("provisional facilities conform to the HAC-21 V2Facility contract", () => {
  for (const facility of PROTOTYPE_FACILITIES) {
    assert.equal(v2FacilitySchema.safeParse(facility).success, true);
  }
});

test("step one rejects an identical origin and destination", () => {
  const draft = {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    destinationFacilityId: PROVISIONAL_PROTOTYPE_DRAFT.originFacilityId,
  };
  assert.deepEqual(validatePrototypeStep(1, draft), [
    { field: "destinationFacilityId", code: "same-facility" },
  ]);
});

test("cargo requires its taxonomy, description, weight, and volume", () => {
  const issues = validatePrototypeStep(2, EMPTY_PROTOTYPE_DRAFT);
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ["cargoType", "packagingType", "cargoDescription", "weightKg", "volumeM3"],
  );
});

test("weight and volume must be positive numbers", () => {
  const issues = validatePrototypeStep(2, {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    weightKg: "0",
    volumeM3: "not-a-number",
  });
  assert.deepEqual(issues.map((issue) => issue.code), ["positive-number", "positive-number"]);
});

test("the complete provisional scenario can reach review", () => {
  assert.deepEqual(validatePrototypeDraft(PROVISIONAL_PROTOTYPE_DRAFT), []);
});

test("review is blocked when a previously valid field is cleared after reaching summary", () => {
  assert.equal(validatePrototypeReview(PROVISIONAL_PROTOTYPE_DRAFT).valid, true);

  const editedAfterReview = {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    cargoDescription: "",
  };

  assert.deepEqual(validatePrototypeReview(editedAfterReview), {
    valid: false,
    invalidStep: 2,
    issues: [{ field: "cargoDescription", code: "required" }],
  });
});

test("prototype evidence never promotes unknown map or carrier facts", () => {
  const evidence = getPrototypeEvidence(PROVISIONAL_PROTOTYPE_DRAFT);
  assert.equal(evidence.formData.status, "preliminary");
  assert.equal(evidence.facilityContract.status, "confirmed");
  assert.equal(evidence.transportMode.value, "ROAD");
  assert.equal(evidence.route.status, "unknown");
  assert.equal(evidence.distance.value, null);
  assert.equal(evidence.estimatedTransit.value, null);
  assert.equal(evidence.carrierAvailability.value, null);
  assert.equal("price" in evidence, false);
  assert.equal("offers" in evidence, false);
});
