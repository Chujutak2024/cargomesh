import assert from "node:assert/strict";
import test from "node:test";
import { planConversationTurn } from "./conversation-machine";

const id = "123e4567-e89b-42d3-a456-426614174000";
const state = { schemaVersion: "2.0-draft", conversationId: id,
  organizationId: id, authUserId: id, requestId: null, draftVersion: null,
  phase: "COLLECTING", slots: [], pendingSlot: "origin", eligibility: null,
  commercial: { price: "DISABLED_NO_V2_OFFER_SERVICE", booking: "DISABLED_NO_V2_BOOKING_SERVICE" } };
const turn = { schemaVersion: "2.0-draft", locale: "es", inputMode: "TEXT" };

test("collects multiple provisional turns and replaces a corrected field", () => {
  const origin = planConversationTurn(state, { ...turn, intent: "PROVIDE_SLOT",
    slotValue: { slot: "origin", value: "Lima" } });
  const destination = planConversationTurn(origin.state, { ...turn, intent: "PROVIDE_SLOT",
    slotValue: { slot: "destination", value: "Arequipa" } });
  const corrected = planConversationTurn(destination.state, { ...turn, intent: "CORRECT_SLOT",
    slotValue: { slot: "origin", value: "Callao" } });
  assert.equal(corrected.state.slots.length, 2);
  assert.equal(corrected.state.slots.find((slot) => slot.value.slot === "origin")?.value.value, "Callao");
  assert.equal(corrected.effect, "NONE");
});

test("booking and price remain unavailable even after a spoken yes", () => {
  const result = planConversationTurn(state, { ...turn, inputMode: "EDITED_VOICE_TRANSCRIPT",
    intent: "ASK_BOOKING", text: "sí" });
  assert.equal(result.effect, "NONE");
  assert.match(result.reply, /no hay oferta V2/i);
  assert.equal(planConversationTurn(state, { ...turn, intent: "ASK_PRICE" }).effect, "NONE");
});

test("English-first clarification and commercial refusal", () => {
  const first = planConversationTurn(state, { schemaVersion: "2.0-draft", inputMode: "TEXT",
    intent: "PROVIDE_SLOT", slotValue: { slot: "origin", value: "Lima" } });
  assert.match(first.reply, /Provisional detail saved/);
  assert.match(first.reply, /delivery location/);
  const blocked = planConversationTurn(first.state, { schemaVersion: "2.0-draft", inputMode: "TEXT",
    intent: "ASK_BOOKING", text: "Yes, book it" });
  assert.match(blocked.reply, /no attributable V2 offer/i);
  assert.equal(blocked.effect, "NONE");
});

test("correction invalidates prior eligibility instead of retaining stale recommendation", () => {
  const prior = { ...state, phase: "RESULT", eligibility: { status: "eligible", reasonCodes: [],
    source: "HAC-12", evaluatedAt: "2026-10-03T10:00:00-05:00", evaluatedDraftVersion: 2 } };
  const result = planConversationTurn(prior, { ...turn, intent: "CORRECT_SLOT",
    slotValue: { slot: "weightKg", value: 1000 } });
  assert.equal(result.state.eligibility, null);
});

test("cannot issue draft creation effect from incomplete conversation", () => {
  const result = planConversationTurn(state, { ...turn, intent: "CREATE_DRAFT", idempotencyKey: id });
  assert.equal(result.effect, "NONE");
  assert.match(result.reply, /requiere todos los campos/i);
});

test("read and evaluation reject a mismatched request reference before any effect", () => {
  const own = { ...state, requestId: id, draftVersion: 1, phase: "DRAFT" };
  const foreign = "123e4567-e89b-42d3-a456-426614174001";
  assert.throws(() => planConversationTurn(own, { ...turn, intent: "READ_DRAFT", requestId: foreign }), /REQUEST_MISMATCH/);
  assert.throws(() => planConversationTurn(own, { ...turn, intent: "EVALUATE_ROAD", requestId: foreign }), /REQUEST_MISMATCH/);
});

test("place confirmation refuses an obsolete draft version", () => {
  const own = { ...state, requestId: id, draftVersion: 2, phase: "DRAFT" };
  const placeChoice = { kind: "FACILITY", reference: id, label: "Sede Callao",
    source: "HAC-33", precision: "EXACT", observedAt: "2026-10-03T10:00:00-05:00" };
  assert.throws(() => planConversationTurn(own, { ...turn, intent: "CONFIRM_PLACE",
    requestId: id, expectedDraftVersion: 1, placeChoice }), /STALE_DRAFT/);
});
