import assert from "node:assert/strict";
import test from "node:test";
import { InterpretationRequestSchema, InterpretationResponseSchema, interpretDeterministically } from "./interpretation";

test("bounded conversation context accepts provisional facts but rejects contacts and extra authority", () => {
  const request = { schemaVersion: "2.0", text: "Change it to Piura", currentField: "destinationFacilityId", context: {
    knownFields: [{ field: "originFacilityId", value: "Lima" }], lastAskedField: "destinationFacilityId", failedAttempts: 1,
  } };
  assert.equal(InterpretationRequestSchema.safeParse(request).success, true);
  assert.equal(InterpretationRequestSchema.safeParse({ ...request, context: { ...request.context, knownFields: [{ field: "pickupContactEmail", value: "person@example.com" }] } }).success, false);
  assert.equal(InterpretationRequestSchema.safeParse({ ...request, context: { ...request.context, organizationId: "forged" } }).success, false);
  assert.equal(InterpretationRequestSchema.safeParse({ ...request, context: { ...request.context, failedAttempts: 99 } }).success, false);
});

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

test("product questions receive grounded guidance even without Bedrock", () => {
  const purpose = interpretDeterministically({ schemaVersion: "2.0", text: "¿Para qué sirve CargoMesh?", currentField: "originFacilityId" });
  assert.equal(purpose.intent, "HELP");
  assert.match(purpose.acknowledgment ?? "", /solicitud de transporte/);
  const choice = interpretDeterministically({ schemaVersion: "2.0", text: "¿Y cómo me ayuda a escoger?", currentField: "originFacilityId" });
  assert.equal(choice.intent, "HELP");
  assert.match(choice.acknowledgment ?? "", /ofertas emitidas por carriers/);
  assert.doesNotMatch(choice.acknowledgment ?? "", /precio confirmado/);
  const followUp = interpretDeterministically({ schemaVersion: "2.0", text: "¿Y eso?", currentField: "originFacilityId", context: { knownFields: [], lastAskedField: "originFacilityId", failedAttempts: 0, previousHelpTopic: "SELECTION" } });
  assert.equal(followUp.intent, "HELP");
  assert.match(followUp.acknowledgment ?? "", /ofertas emitidas/);
});

test("a noisy dictated greeting is not treated as a saved pickup location", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "Hello Hello Hello Hello Can You Feel a water you do a How can you Tell me", currentField: "originFacilityId" });
  assert.equal(turn.intent, "HELP");
  assert.deepEqual(turn.fields, []);
  assert.match(turn.acknowledgment ?? "", /transcript is unclear/);
});

test("a bare facility answer still works but a conversational question is not a facility", () => {
  const base = { schemaVersion: "2.0" as const, currentField: "originFacilityId" as const };
  assert.deepEqual(interpretDeterministically({ ...base, text: "Lima" }).fields, [{ field: "originFacilityId", value: "Lima" }]);
  assert.deepEqual(interpretDeterministically({ ...base, text: "Can you tell me what this service does?" }).fields, []);
});

test("service questions distinguish current ROAD from future modes", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "¿Qué servicios ofrecen?", currentField: "originFacilityId" });
  assert.equal(turn.intent, "HELP");
  assert.match(turn.acknowledgment ?? "", /solicitud ROAD/);
  assert.match(turn.acknowledgment ?? "", /aún no operan/);
});

test("Spanish freight turns keep their explicit values and never imply a booking", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "Quiero 2 pallets de Lima a Piura", currentField: "originFacilityId" });
  assert.deepEqual(turn, {
    intent: "PROVIDE",
    fields: [
      { field: "originFacilityId", value: "Lima" },
      { field: "destinationFacilityId", value: "Piura" },
      { field: "unitQuantity", value: "2" },
      { field: "packaging", value: "PALLET" },
    ],
  });
  assert.equal(interpretDeterministically({ schemaVersion: "2.0", text: "quiero una cotización", currentField: null }).intent, "PRICE");
  assert.equal(interpretDeterministically({ schemaVersion: "2.0", text: "reserva el camión", currentField: null }).intent, "BOOKING");
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
