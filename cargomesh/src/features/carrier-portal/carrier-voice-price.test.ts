import assert from "node:assert/strict";
import test from "node:test";
import { carrierSpokenOfferSeed, carrierVoicePrice } from "./carrier-voice-price";
import { CommercialEvidenceV2Schema } from "@/shared/schemas/v2/commercial";

test("a carrier's explicit spoken USD amount becomes only a proposed form value", () => {
  assert.equal(carrierVoicePrice("I would quote $1,250.50 for this route"), 1250.5);
  assert.equal(carrierVoicePrice("Change the price to 1400 dollars"), 1400);
  assert.equal(carrierVoicePrice("1200"), 1200);
});

test("ambiguous, invalid, and context-only speech never becomes an offer amount", () => {
  for (const phrase of ["accept the opportunity", "the cargo weighs 1200 kg", "price 1200 plus fuel 200 dollars", "price 0", "price 12,34", "quote 1,200.999"]) {
    assert.equal(carrierVoicePrice(phrase), null, phrase);
  }
});

test("a spoken price seeds an editable total but leaves evidence unverified", () => {
  const seed = carrierSpokenOfferSeed(1250);
  assert.equal(seed.price.amount, seed.breakdown[0].amount.amount);
  assert.equal(CommercialEvidenceV2Schema.safeParse(seed.breakdown[0].source).success, false);
  assert.throws(() => carrierSpokenOfferSeed(0));
});
