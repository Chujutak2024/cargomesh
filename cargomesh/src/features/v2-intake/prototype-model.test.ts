import assert from "node:assert/strict";
import test from "node:test";

import { v2FacilitySchema } from "@/types/v2-road-network";
import {
  EMPTY_PROTOTYPE_DRAFT,
  PROTOTYPE_FACILITIES,
  PROTOTYPE_SCENARIO,
  PROVISIONAL_PROTOTYPE_DRAFT,
  getPrototypeFacilityScenarioRole,
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

test("the catalog is aligned to the synthetic HAC-23 V2 ROAD baseline", () => {
  assert.equal(PROTOTYPE_SCENARIO.packageName, "HAC-23-V2-ROAD-BASELINE");
  assert.equal(PROTOTYPE_SCENARIO.provenance, "SYNTHETIC_DEMO_ONLY");
  assert.deepEqual(
    PROTOTYPE_FACILITIES.map(({ id, code, city }) => ({ id, code, city })),
    [
      { id: "c2330000-0000-4000-8000-000000000001", code: "QA-A-LIMA", city: "Lima" },
      { id: "c2330000-0000-4000-8000-000000000002", code: "QA-A-AREQUIPA", city: "Arequipa" },
      { id: "c2330000-0000-4000-8000-000000000003", code: "QA-A-PIURA", city: "Piura" },
    ],
  );
  assert.equal(getPrototypeFacilityScenarioRole(PROTOTYPE_FACILITIES[2].id), "NO_DECLARED_COVERAGE");
});

test("the visible prototype fixture contains no FR-1042 or ACME corridor markers", () => {
  const fixture = JSON.stringify({
    scenario: PROTOTYPE_SCENARIO,
    facilities: PROTOTYPE_FACILITIES,
    draft: PROVISIONAL_PROTOTYPE_DRAFT,
  });
  assert.doesNotMatch(fixture, /ACME|Callao|Santiago|FR-1042/i);
  assert.equal(findCity(PROVISIONAL_PROTOTYPE_DRAFT.originFacilityId), "Lima");
  assert.equal(findCity(PROVISIONAL_PROTOTYPE_DRAFT.destinationFacilityId), "Arequipa");
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
  assert.equal(evidence.route.reason, "FACILITY_SELECTION_ONLY");
  assert.equal(evidence.coverage.value, null);
  assert.equal(evidence.capacity.value, null);
  assert.equal(evidence.distance.value, null);
  assert.equal(evidence.estimatedTransit.value, null);
  assert.equal(evidence.carrierAvailability.value, null);
  assert.equal(evidence.price.value, null);
  assert.equal(evidence.persistence.value, "NOT_CONNECTED");
  assert.equal("offers" in evidence, false);
});

function findCity(id: string) {
  return PROTOTYPE_FACILITIES.find((facility) => facility.id === id)?.city ?? null;
}
