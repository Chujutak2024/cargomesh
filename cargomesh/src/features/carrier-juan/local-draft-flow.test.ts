import test from "node:test";
import assert from "node:assert/strict";
import { completeLocalDraftStep, localDraftStepFromHash, localDraftStepHref } from "./local-draft-flow";
import { changeLocalDraft, importLocalDraft, LEGACY_ORIGIN } from "./local-draft-model";
const now = "2026-10-08T12:00:00.000Z";
const original = { originId: "callao", destinationId: "piura", cargoDescription: "Test cargo", quantity: 10,
  unitWeightKg: 800, pickupDate: "2026-10-10", deliveryDate: "2026-10-12", completedStep: 0,
  savedForReview: false, truckPreference: { type: "custom", model: "Test truck", photoDataUrl: "data:image/png;base64,YWJj" } };
const record = () => importLocalDraft(JSON.stringify(original), LEGACY_ORIGIN, now);

test("step URLs restore the visible screen independently of checked progress", () => {
  assert.equal(localDraftStepFromHash("#/request/cargo", 0), 2);
  assert.equal(localDraftStepFromHash("#/desk/review", 1), 4);
  assert.equal(localDraftStepFromHash("#/request", 5), 4);
  assert.equal(localDraftStepFromHash("#/request/unknown", 1), 1);
  assert.equal(localDraftStepHref(1), "#/request/route");
});
test("checking all five screens preserves data, photo and immutable recovery payload", () => {
  let current = record();
  for (let index = 0; index < 5; index++) {
    const result = completeLocalDraftStep(current, index, now);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("Unexpected failure");
    current = result.record;
    assert.equal(current.draft.completedStep, index + 1);
    assert.equal(current.draft.savedForReview, index === 4);
  }
  assert.equal(current.originalRaw, JSON.stringify(original));
  assert.deepEqual(current.draft.truckPreference, original.truckPreference);
  assert.equal(current.draft.cargoDescription, original.cargoDescription);
});
test("jumping to review cannot check skipped screens or mark a draft reviewed", () => {
  const initial = record();
  assert.deepEqual(completeLocalDraftStep(initial, 4, now), { ok: false, reason: "previous", step: 0 });
  assert.equal(initial.draft.completedStep, 0);
});
test("going back over a checked screen preserves progress; changing cargo invalidates only the affected prefix", () => {
  const checked = { ...record(), draft: { ...record().draft, completedStep: 5, savedForReview: true } };
  const back = completeLocalDraftStep(checked, 0, now);
  assert.ok(back.ok);
  assert.equal(back.record.draft.completedStep, 5);
  const edited = changeLocalDraft(checked, { quantity: 2 }, now);
  assert.equal(edited.draft.completedStep, 2);
  assert.equal(edited.draft.savedForReview, false);
  assert.deepEqual(completeLocalDraftStep(edited, 4, now), { ok: false, reason: "previous", step: 2 });
  assert.equal(edited.draft.pickupDate, original.pickupDate);
});
test("invalid active fields and stale legacy progress cannot pass review", () => {
  const invalidTruck = { ...record(), draft: { ...record().draft, completedStep: 4,
    truckPreference: { type: "custom" as const, model: "", photoDataUrl: null } } };
  assert.equal(completeLocalDraftStep(invalidTruck, 1, now).ok, false);
  assert.equal(completeLocalDraftStep(invalidTruck, 4, now).ok, false);
  for (const fields of [{ quantity: 0 }, { deliveryDate: "2026-01-01" }, { destinationId: "madrid" }]) {
    const next = changeLocalDraft(record(), fields, now);
    assert.equal(completeLocalDraftStep(next, 4, now).ok, false);
  }
});
