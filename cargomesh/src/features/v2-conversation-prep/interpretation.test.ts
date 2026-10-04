import assert from "node:assert/strict";
import test from "node:test";
import { InterpretationResponseSchema, interpretDeterministically } from "./interpretation";

test("local parser extracts an explicit route and quantity without inventing a facility ID", () => {
  const result = interpretDeterministically({ schemaVersion: "2.0", text: "Ship 2 pallets from Lima to Arequipa", currentField: "originFacilityId" });
  assert.equal(result.intent, "PROVIDE");
  assert.deepEqual(result.fields, [
    { field: "originFacilityId", value: "Lima" },
    { field: "destinationFacilityId", value: "Arequipa" },
    { field: "unitQuantity", value: "2" },
    { field: "packaging", value: "PALLET" },
  ]);
});

test("per-unit measurements require explicit wording; totals are not silently reinterpreted", () => {
  const total = interpretDeterministically({ schemaVersion: "2.0", text: "1200 kg total", currentField: "unitWeightPerUnitKg" });
  assert.deepEqual(total.fields, [{ field: "unitWeightPerUnitKg", value: "1200 kg total" }]);
  const units = interpretDeterministically({ schemaVersion: "2.0", text: "1200 kg each, 2.4 m3 per unit, 120 x 80 x 90 cm", currentField: "unitWeightPerUnitKg" });
  assert.deepEqual(units.fields.map((field) => field.field), ["unitWeightPerUnitKg", "unitVolumePerUnitM3", "unitLengthCm", "unitWidthCm", "unitHeightCm"]);
});

test("price and booking never become create or evaluation effects", () => {
  assert.equal(interpretDeterministically({ schemaVersion: "2.0", text: "what is the price?", currentField: null }).intent, "PRICE");
  assert.equal(interpretDeterministically({ schemaVersion: "2.0", text: "book this now", currentField: null }).intent, "BOOKING");
});

test("a named correction changes the requested field, not the current prompt", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "change origin to Piura", currentField: "cargoDescription" });
  assert.deepEqual(turn, { intent: "CORRECT", fields: [{ field: "originFacilityId", value: "Piura" }] });
});

test("untrusted model output must use the versioned bounded response contract", () => {
  assert.equal(InterpretationResponseSchema.safeParse({
    schemaVersion: "2.0", mode: "BEDROCK", telemetry: null,
    interpretation: { intent: "PROVIDE", fields: [{ field: "organizationId", value: "forged" }] },
  }).success, false);
});
