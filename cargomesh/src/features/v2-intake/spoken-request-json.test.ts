import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_PROTOTYPE_DRAFT, buildPrototypeExample } from "./prototype-model";
import { getIntakeOptionsFixture } from "./intake-options";
import { prepareSpokenRequestJson } from "./spoken-request-json";

test("spoken request cannot produce a create JSON while required fields are missing", () => {
  assert.equal(prepareSpokenRequestJson(EMPTY_PROTOTYPE_DRAFT, getIntakeOptionsFixture().data, false), null);
});

test("the reviewed voice JSON uses the canonical intake payload and preserves a route conflict guard", () => {
  const options = getIntakeOptionsFixture().data;
  const draft = buildPrototypeExample(options);
  const payload = prepareSpokenRequestJson(draft, options, false);
  assert.ok(payload);
  assert.equal(payload.schemaVersion, "2.0");
  assert.equal(payload.origin.facilityId, draft.originFacilityId);
  assert.equal(payload.destination.facilityId, draft.destinationFacilityId);
  assert.equal(payload.cargoSpecification.units[0].quantity, Number(draft.unitQuantity));
  assert.equal(prepareSpokenRequestJson(draft, options, true), null);
  assert.equal(prepareSpokenRequestJson(draft, options, false, Number(draft.totalWeightKg) + 100), null);
  assert.ok(prepareSpokenRequestJson(draft, options, false, Number(draft.totalWeightKg)));
});
