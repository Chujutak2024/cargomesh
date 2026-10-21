import assert from "node:assert/strict";
import test from "node:test";
import { InterpretationRequestSchema, InterpretationResponseSchema, guardExplicitCorrection, interpretDeterministically } from "./interpretation";

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
  for (const text of ["is it booked?", "show reservations", "is it reserved?"]) {
    assert.equal(interpretDeterministically({ schemaVersion: "2.0", text, currentField: "originFacilityId" }).intent, "BOOKING");
  }
});

test("product questions receive grounded guidance even without Bedrock", () => {
  const purpose = interpretDeterministically({ schemaVersion: "2.0", text: "¿Para qué sirve CargoMesh?", currentField: "originFacilityId" });
  assert.equal(purpose.intent, "HELP");
  assert.match(purpose.acknowledgment ?? "", /freight request/);
  const choice = interpretDeterministically({ schemaVersion: "2.0", text: "¿Y cómo me ayuda a escoger?", currentField: "originFacilityId" });
  assert.equal(choice.intent, "HELP");
  assert.match(choice.acknowledgment ?? "", /carrier-authored offers/);
  assert.doesNotMatch(choice.acknowledgment ?? "", /confirmed price/);
  const followUp = interpretDeterministically({ schemaVersion: "2.0", text: "¿Y eso?", currentField: "originFacilityId", context: { knownFields: [], lastAskedField: "originFacilityId", failedAttempts: 0, previousHelpTopic: "SELECTION" } });
  assert.equal(followUp.intent, "HELP");
  assert.match(followUp.acknowledgment ?? "", /carrier-authored offers/);
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

test("request guidance never becomes a pickup answer", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "hi can you tell me to make a request", currentField: "originFacilityId" });
  assert.equal(turn.intent, "HELP");
  assert.deepEqual(turn.fields, []);
  assert.match(turn.acknowledgment ?? "", /prepare a freight request/);
  const openQuestion = interpretDeterministically({ schemaVersion: "2.0", text: "How does this work?", currentField: "originFacilityId" });
  assert.equal(openQuestion.intent, "HELP");
  assert.deepEqual(openQuestion.fields, []);
});

test("spoken quantity and cargo are provisional facts, not invented coverage", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "I need to ship two pallets of machinery from Lima to Arequipa", currentField: "originFacilityId" });
  assert.deepEqual(turn.fields, [
    { field: "originFacilityId", value: "Lima" },
    { field: "destinationFacilityId", value: "Arequipa" },
    { field: "unitQuantity", value: "2" },
    { field: "packaging", value: "PALLET" },
    { field: "categoryCode", value: "machinery" },
  ]);
});

test("service questions distinguish current ROAD from future modes", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "¿Qué servicios ofrecen?", currentField: "originFacilityId" });
  assert.equal(turn.intent, "HELP");
  assert.match(turn.acknowledgment ?? "", /ROAD freight request/);
  assert.match(turn.acknowledgment ?? "", /not operational/);
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

test("a natural Spanish turn captures only explicit cargo and route facts", () => {
  const turn = interpretDeterministically({ schemaVersion: "2.0", text: "Necesito enviar 10 pallets desde nuestra sede de Callao hasta Santiago el próximo viernes", currentField: "originFacilityId" });
  assert.deepEqual(turn.fields, [
    { field: "originFacilityId", value: "Callao" },
    { field: "destinationFacilityId", value: "Santiago" },
    { field: "unitQuantity", value: "10" },
    { field: "packaging", value: "PALLET" },
  ]);
  assert.match(turn.acknowledgment ?? "", /exact pickup and delivery dates/);
  assert.equal(turn.fields.some((field) => field.field.endsWith("At")), false);
});

test("natural corrections target one field and never guess a relative date", () => {
  const input = { schemaVersion: "2.0" as const, currentField: "recipientContactName" as const };
  assert.deepEqual(interpretDeterministically({ ...input, text: "Son 12 pallets, no 10" }), { intent: "CORRECT", fields: [{ field: "unitQuantity", value: "12" }] });
  assert.deepEqual(interpretDeterministically({ ...input, text: "Cambia el origen a Arequipa" }), { intent: "CORRECT", fields: [{ field: "originFacilityId", value: "Arequipa" }] });
  const date = interpretDeterministically({ ...input, text: "Mejor hazlo el martes" });
  assert.equal(date.intent, "CORRECT");
  assert.deepEqual(date.fields, []);
  assert.match(date.acknowledgment ?? "", /exact pickup and delivery dates/);
});

test("model output cannot expand a clear correction to unrelated fields or invent Tuesday", () => {
  const proposal = { intent: "CORRECT" as const, fields: [
    { field: "unitQuantity" as const, value: "12" },
    { field: "destinationFacilityId" as const, value: "other-tenant-id" },
  ] };
  assert.deepEqual(guardExplicitCorrection("Son 12 pallets, no 10", "categoryCode", proposal), {
    intent: "CORRECT", fields: [{ field: "unitQuantity", value: "12" }],
  });
  assert.deepEqual(guardExplicitCorrection("Cambia el origen a Arequipa", "categoryCode", proposal), {
    intent: "CORRECT", fields: [{ field: "originFacilityId", value: "Arequipa" }],
  });
  const date = guardExplicitCorrection("Mejor hazlo el martes", "pickupWindowStartsAt", {
    intent: "CORRECT", fields: [{ field: "pickupWindowStartsAt", value: "2026-10-13T08:00" }],
  });
  assert.deepEqual(date.fields, []);
  assert.match(date.acknowledgment ?? "", /confirm the exact/);
});

test("untrusted model output must use the versioned bounded response contract", () => {
  assert.equal(InterpretationResponseSchema.safeParse({
    schemaVersion: "2.0", mode: "BEDROCK", telemetry: null,
    interpretation: { intent: "PROVIDE", fields: [{ field: "organizationId", value: "forged" }] },
  }).success, false);
});

test("mixed commercial question preserves explicit quantity and packaging", () => {
  const result=interpretDeterministically({schemaVersion:"2.0",text:"¿Cuánto cuesta enviar 10 pallets de 100 kg cada uno?",currentField:null,language:"es"});
  assert.equal(result.intent,"PROVIDE");
  assert.ok(result.fields.some(f=>f.field==="unitQuantity"&&f.value==="10"));
  assert.ok(result.fields.some(f=>f.field==="unitWeightPerUnitKg"&&f.value==="100"));
});

test("Spanish spoken numbers are captured without assigning a cargo category",()=>{
  const result=interpretDeterministically({schemaVersion:"2.0",text:"diez pallets",currentField:null,language:"es"});
  assert.ok(result.fields.some(f=>f.field==="unitQuantity"&&f.value==="10"));
  assert.equal(result.fields.some(f=>f.field==="categoryCode"),false);
});

test("comparison questions with explicit cargo do not discard intake facts",()=>{
  const result=interpretDeterministically({schemaVersion:"2.0",text:"compare prices for 10 pallets from Lima to Arequipa",currentField:null});
  assert.equal(result.intent,"PROVIDE");
  assert.ok(result.fields.some(f=>f.field==="unitQuantity"&&f.value==="10"));
  assert.ok(result.fields.some(f=>f.field==="originFacilityId"&&f.value==="Lima"));
});

test('urgency and commercial load size are explicit hints, never truck capacities',()=>{
 const result=interpretDeterministically({schemaVersion:'2.0',text:'Es urgente, carga pesada.',currentField:null,language:'es'});
 assert.deepEqual(result.fields,[{field:'urgency',value:'URGENT'},{field:'loadSize',value:'HEAVY'}]);
 const scheduled=interpretDeterministically({schemaVersion:'2.0',text:'No es urgente.',currentField:'urgency',language:'es'});assert.equal(scheduled.fields[0]?.value,'SCHEDULED');
});
