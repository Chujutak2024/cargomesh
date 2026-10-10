import assert from "node:assert/strict";
import test from "node:test";
import { getIntakeOptionsFixture } from "./intake-options";
import { choicesForField, matchingConversationChoices, parseConversationField, resolveConversationSuggestions } from "./conversation-fields";

test("an invalid first suggestion does not prevent later valid details from resolving", () => {
  const result = resolveConversationSuggestions([
    { field: "originFacilityId", value: "unknown place" },
    { field: "unitQuantity", value: "4" },
    { field: "packaging", value: "pallets" },
  ], options);
  assert.deepEqual(result.map(({ parsed }) => parsed), [null, "4", "PALLET"]);
});

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

test("equipment prompts use English labels even when persisted selector copy is Spanish", () => {
  const withSpanishLabel = { ...options, equipmentOptions: [{ code: "BOX_TRUCK", labelEs: "Camión furgón", labelEn: "Camión furgón", verification: "RESOURCE_EVIDENCE" as const }] };
  assert.deepEqual(choicesForField("requiredEquipment", withSpanishLabel), [{ value: "BOX_TRUCK", label: "Box truck" }]);
  assert.equal(parseConversationField("requiredEquipment", "1", withSpanishLabel), "BOX_TRUCK");
});

test("natural English category and packaging values resolve only configured V2 codes", () => {
  assert.equal(parseConversationField("originFacilityId", "Lima", options), options.facilities.find((facility) => facility.city === "Lima")?.facilityId);
  assert.equal(parseConversationField("categoryCode", "general cargo", options), "GENERAL");
  assert.equal(parseConversationField("packaging", "pallets", options), "PALLET");
  assert.equal(parseConversationField("categoryCode", "imaginary cargo", options), null);
});

test("Spanish category and packaging names still resolve only configured V2 codes", () => {
  assert.equal(parseConversationField("categoryCode", "maquinaria", options), "MACHINERY");
  assert.equal(parseConversationField("packaging", "cajas", options), "BOX");
  assert.equal(parseConversationField("categoryCode", "carga inventada", options), null);
});

test("two tenant facilities in one city stay ambiguous until one is selected", () => {
  const lima = options.facilities.find((facility) => facility.city === "Lima")!;
  const ambiguous = { ...options, facilities: [...options.facilities, { ...lima, facilityId: "c2330000-0000-4000-8000-000000000099", code: "QA-A-LIMA-2" }] };
  assert.equal(parseConversationField("originFacilityId", "Lima", ambiguous), null);
  assert.equal(matchingConversationChoices("originFacilityId", "Lima", ambiguous).length, 2);
});
