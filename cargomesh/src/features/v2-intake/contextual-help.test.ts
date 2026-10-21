import assert from "node:assert/strict";
import test from "node:test";
import { getIntakeOptionsFixture } from "./intake-options";
import { EMPTY_PROTOTYPE_DRAFT } from "./prototype-model";
import { contextualHelpReply } from "./contextual-help";

test("fallback help acknowledges only verified provisional details and asks the next step", () => {
  const options = getIntakeOptionsFixture().data;
  const origin = options.facilities[0];
  assert.ok(origin);
  const start = contextualHelpReply(EMPTY_PROTOTYPE_DRAFT, options, "originFacilityId");
  assert.match(start ?? "", /ROAD freight request/);
  assert.match(start ?? "", /planning to ship/);
  assert.doesNotMatch(start ?? "", /confirmed|booked|available carrier/i);
  const reply = contextualHelpReply({ ...EMPTY_PROTOTYPE_DRAFT, originFacilityId: origin.facilityId }, options, "destinationFacilityId");
  assert.match(reply ?? "", new RegExp(`pickup at ${origin.city}`));
  assert.match(reply ?? "", /delivered/i);
  assert.doesNotMatch(reply ?? "", /confirmed|booked|available carrier/i);
});

test("how-to question gets a conversational explanation before a form prompt", () => {
  const reply = contextualHelpReply(EMPTY_PROTOTYPE_DRAFT, getIntakeOptionsFixture().data, "originFacilityId", "hi can you tell me to make a request");
  assert.match(reply ?? "", /tell me what you need to ship/i);
  assert.match(reply ?? "", /only save it when you confirm/i);
  assert.doesNotMatch(reply ?? "", /could not match|saved facilit|where should the cargo be picked up/i);
});

test("Spanish guidance keeps confirmed totals and asks what pallets contain", () => {
  const reply=contextualHelpReply({...EMPTY_PROTOTYPE_DRAFT,packaging:"PALLET",unitQuantity:"10",unitWeightPerUnitKg:"100"},getIntakeOptionsFixture().data,"categoryCode","no sé la categoría","es");
  assert.match(reply??"",/categorías disponibles/);
  const next=contextualHelpReply({...EMPTY_PROTOTYPE_DRAFT,packaging:"PALLET",unitQuantity:"10",unitWeightPerUnitKg:"100"},getIntakeOptionsFixture().data,"categoryCode","","es");
  assert.match(next??"",/1000 kg/);
  assert.match(next??"",/vacíos.*mercancía/);
});
