import test from "node:test";
import assert from "node:assert/strict";
import { truckTypes } from "./local-truck-preference";
import { importLocalDraft, readLocalDraft, changeLocalDraft, canCompleteLocalStep, localMapPresentation,
  isLocalTransfer, LEGACY_ORIGIN, TRANSFER_CHANNEL } from "./local-draft-model";
const timestamp = "2026-10-08T10:00:00.000Z";
// Explicit test data, never a product default or persisted API request.
const data = { originId: "callao", destinationId: "piura", cargoDescription: "Test cargo",
  quantity: 10, unitWeightKg: 800, pickupDate: "2026-07-12", deliveryDate: "2026-09-12",
  completedStep: 1, savedForReview: false, truckPreference: { type: "custom", model: "Test truck", photoDataUrl: "data:image/png;base64,YWJj" } };
test("every expanded catalog choice survives save and reload without changing other request fields",()=>{
  for(const type of truckTypes){
    const record=importLocalDraft(JSON.stringify({...data,truckPreference:{type:type.id,model:"",photoDataUrl:null}}),LEGACY_ORIGIN,timestamp);
    const restored=readLocalDraft(JSON.stringify(record))!;
    assert.equal(restored.draft.truckPreference?.type,type.id);
    assert.equal(restored.draft.quantity,10);assert.equal(restored.draft.unitWeightKg,800);
    assert.equal(restored.draft.pickupDate,data.pickupDate);
  }
});
test("all saved fields, photo, progress and original raw survive the round trip without API identity", () => {
  const raw = JSON.stringify(data); const record = importLocalDraft(raw, LEGACY_ORIGIN, timestamp);
  assert.deepEqual(record.draft, data); assert.equal(record.originalRaw, raw);
  assert.deepEqual(readLocalDraft(JSON.stringify(record)), record);
  assert.equal("id" in record.draft, false); assert.equal("draftVersion" in record.draft, false);
});
test("missing legacy truck preference is unknown, not a default assigned vehicle", () => {
  const { truckPreference, ...previous } = data; void truckPreference;
  assert.equal(importLocalDraft(JSON.stringify(previous), LEGACY_ORIGIN, timestamp).draft.truckPreference, null);
  assert.equal(readLocalDraft(null), null);
});
test("malformed drafts fail closed and never generate a replacement example", () => {
  for (const invalid of ["{}", "null", "{", JSON.stringify({ ...data, originId: "unknown" }),
    JSON.stringify({ ...data, pickupDate: "2026-02-30" }), JSON.stringify({ ...data, quantity: -1 }),
    JSON.stringify({ ...data, completedStep: 6 }), "x".repeat(420001)]) {
    assert.throws(() => importLocalDraft(invalid, LEGACY_ORIGIN, timestamp));
  }
});
test("remote and SVG photos cannot enter restored state", () => {
  for (const photoDataUrl of ["https://example.com/photo.png", "data:image/svg+xml;base64,YWJj", "data:image/png;base64," + "a".repeat(400000)])
    assert.throws(() => importLocalDraft(JSON.stringify({ ...data, truckPreference: { ...data.truckPreference, photoDataUrl } }), LEGACY_ORIGIN, timestamp));
});
test("edits preserve untouched fields and immutable recovery payload; affected progress is invalidated", () => {
  const record = importLocalDraft(JSON.stringify({ ...data, completedStep: 5, savedForReview: true }), LEGACY_ORIGIN, timestamp);
  const next = changeLocalDraft(record, { cargoDescription: "Updated cargo" }, "2026-10-08T11:00:00.000Z");
  assert.equal(next.originalRaw, record.originalRaw); assert.equal(next.draft.completedStep, 2);
  assert.equal(next.draft.savedForReview, false); assert.equal(next.draft.pickupDate, data.pickupDate);
  assert.deepEqual(next.draft.truckPreference, data.truckPreference);
  assert.equal(changeLocalDraft(next, { destinationId: "arequipa" }, timestamp).draft.completedStep, 0);
});
test("custom truck without a model remains preserved but cannot advance route review", () => {
  const record = importLocalDraft(JSON.stringify({ ...data, truckPreference: { type: "custom", model: "", photoDataUrl: null } }), LEGACY_ORIGIN, timestamp);
  assert.equal(record.draft.completedStep, 1); assert.equal(canCompleteLocalStep(record.draft, 1), false);
});
test("missing dates, reverse dates and ocean crossings cannot complete local review", () => {
  assert.equal(canCompleteLocalStep({ ...data, truckPreference: null, deliveryDate: "" }, 4), false);
  assert.equal(canCompleteLocalStep({ ...data, truckPreference: null, deliveryDate: "2026-01-01" }, 3), false);
  assert.equal(canCompleteLocalStep({ ...data, truckPreference: null, destinationId: "madrid" }, 0), false);
});
test("transfer accepts only the expected local origin, source window and nonce", () => {
  const source = {}, nonce = "nonce";
  const event = { origin: LEGACY_ORIGIN, source, data: { channel: TRANSFER_CHANNEL, nonce, raw: JSON.stringify(data) } };
  assert.equal(isLocalTransfer(event, source, nonce), true);
  assert.equal(isLocalTransfer({ ...event, origin: "https://foreign.example" }, source, nonce), false);
  assert.equal(isLocalTransfer(event, {}, nonce), false); assert.equal(isLocalTransfer(event, source, "other"), false);
  assert.equal(isLocalTransfer({ ...event, data: { ...event.data, raw: {} } }, source, nonce), false);
  assert.equal(isLocalTransfer({ ...event, origin: "http://127.0.0.1:8083", data: { ...event.data, recordRaw: JSON.stringify(importLocalDraft(JSON.stringify(data), LEGACY_ORIGIN, timestamp)) } }, source, nonce, "http://127.0.0.1:8083"), true);
  assert.equal(isLocalTransfer({ ...event, data: { ...event.data, recordRaw: "x".repeat(900001) } }, source, nonce), false);
});
test("absent route preview keeps city markers but never draws a straight replacement path", () => {
  const record = importLocalDraft(JSON.stringify(data), LEGACY_ORIGIN, timestamp);
  const map = localMapPresentation(record.draft, null); assert.equal(map.markers.length, 2);
  assert.deepEqual(map.paths, []); assert.equal(map.selectedCandidate, null); assert.equal(map.distanceKm, null);
  assert.equal(map.provenanceStatus, "UNKNOWN");
});
