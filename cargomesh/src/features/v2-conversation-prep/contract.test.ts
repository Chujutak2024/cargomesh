import assert from "node:assert/strict";
import test from "node:test";
import { ConversationStateV2Schema, ConversationTurnInputV2Schema, GuidedMessageV2Schema } from "./contract";

test("live guided messages validate text and input mode without client identity", () => {
  assert.equal(GuidedMessageV2Schema.safeParse({ schemaVersion: "2.0", text: "  Lima  ", inputMode: "TEXT" }).data?.text, "Lima");
  assert.equal(GuidedMessageV2Schema.safeParse({ schemaVersion: "2.0", text: "Lima", inputMode: "TEXT", organizationId: requestId }).success, false);
});

const base = { schemaVersion: "2.0-draft", locale: "es", inputMode: "TEXT" } as const;
const requestId = "123e4567-e89b-42d3-a456-426614174000";

test("English is the default language for a browser turn", () => {
  const parsed = ConversationTurnInputV2Schema.parse({ schemaVersion: "2.0-draft", inputMode: "TEXT", intent: "HELP" });
  assert.equal(parsed.locale, "en");
});

test("multi-turn provisional slots and correction require explicit slot values", () => {
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "PROVIDE_SLOT",
    slotValue: { slot: "origin", value: "Lima" } }).success, true);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "CORRECT_SLOT",
    slotValue: { slot: "origin", value: "Callao" } }).success, true);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "CORRECT_SLOT" }).success, false);
});

test("explicit place choice and versioned confirmation", () => {
  const placeChoice = { kind: "EXTERNAL_PLACE", reference: "provider:123", label: "Puerto",
    source: "approved-geocoder", precision: "AREA", observedAt: "2026-10-03T10:00:00-05:00" };
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "SELECT_PLACE" }).success, false);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "CONFIRM_PLACE",
    requestId, placeChoice }).success, false);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "CONFIRM_PLACE",
    requestId, expectedDraftVersion: 2, placeChoice }).success, true);
});

test("draft creation needs retry key and evaluation needs request identity", () => {
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "CREATE_DRAFT" }).success, false);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "CREATE_DRAFT",
    idempotencyKey: requestId }).success, true);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "EVALUATE_ROAD" }).success, false);
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "EVALUATE_ROAD", requestId }).success, true);
});

test("browser turn rejects client-supplied tenant, scope and booking consent", () => {
  for (const extra of [{ organizationId: requestId }, { scope: "mcp:tools" }, { bookingConsent: true }]) {
    assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "HELP", ...extra }).success, false);
  }
  assert.equal(ConversationTurnInputV2Schema.safeParse({ ...base, intent: "ASK_BOOKING", text: "sí" }).success, true);
});

test("conversation state fixes commercial capabilities as disabled", () => {
  const state = { schemaVersion: "2.0-draft", conversationId: requestId,
    organizationId: requestId, authUserId: requestId, requestId: null, draftVersion: null,
    phase: "COLLECTING", slots: [], pendingSlot: "origin", eligibility: null,
    commercial: { price: "DISABLED_NO_V2_OFFER_SERVICE", booking: "DISABLED_NO_V2_BOOKING_SERVICE" } };
  assert.equal(ConversationStateV2Schema.safeParse(state).success, true);
  assert.equal(ConversationStateV2Schema.safeParse({ ...state, commercial: {
    price: "USD 3200", booking: "CONFIRMED" } }).success, false);
});
