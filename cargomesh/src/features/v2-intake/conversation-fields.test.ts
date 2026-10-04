import assert from "node:assert/strict";
import test from "node:test";
import { getIntakeOptionsFixture } from "./intake-options";
import { choicesForField, parseConversationField } from "./conversation-fields";

const options = getIntakeOptionsFixture().data;

test("facility and category choices resolve only published V2 options", () => {
  const pickup = choicesForField("originFacilityId", options);
  assert.ok(pickup.length > 1);
  assert.equal(parseConversationField("originFacilityId", "1", options), pickup[0].value);
  assert.equal(parseConversationField("originFacilityId", "99", options), null);
  assert.equal(parseConversationField("originFacilityId", pickup[0].label, options), pickup[0].value);
  const category = choicesForField("categoryCode", options);
  assert.equal(parseConversationField("categoryCode", "1", options), category[0].value);
  assert.equal(parseConversationField("categoryCode", "unknown category", options), null);
});

test("quantity, dimensions and dates reject invalid provisional turns", () => {
  assert.equal(parseConversationField("unitQuantity", "0", options), null);
  assert.equal(parseConversationField("unitQuantity", "2.5", options), null);
  assert.equal(parseConversationField("unitQuantity", "8", options), "8");
  assert.equal(parseConversationField("unitLengthCm", "-1", options), null);
  assert.equal(parseConversationField("pickupWindowStartsAt", "tomorrow", options), null);
});
