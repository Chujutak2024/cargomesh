import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBalancedOffers } from "./balanced";
import type { BalancedOfferInput } from "./contracts";

const RUN_ID = "90000000-0000-0000-0000-000000000001";

function offer(
  overrides: Partial<BalancedOfferInput> & Pick<BalancedOfferInput, "offerId" | "carrierId">,
): BalancedOfferInput {
  return {
    orchestrationRunId: RUN_ID,
    providerOfferReference: `REF-${overrides.offerId}`,
    totalPrice: 1760,
    currency: "USD",
    transitHours: 31,
    status: "RECEIVED",
    availabilityClass: "AVAILABLE_IN_WINDOW",
    reliabilityScore: 96,
    routeOperations: 100,
    organizationHistoryScore: 50,
    historicalAveragePrice: 1732,
    eligible: true,
    ineligibilityReasons: [],
    ...overrides,
  };
}

test("zero offers produces NO_MATCH without a synthetic recommendation", () => {
  const result = evaluateBalancedOffers(RUN_ID, []);

  assert.equal(result.runStatus, "NO_MATCH");
  assert.equal(result.ranking.recommendedOfferId, null);
  assert.equal(result.ranking.decisionConfidence, 0);
  assert.deepEqual(result.ranking.options, []);
  assert.equal(result.requiresReview, true);
});

test("one offer is explainable but requires assisted review", () => {
  const result = evaluateBalancedOffers(RUN_ID, [
    offer({ offerId: "offer-1", carrierId: "carrier-1" }),
  ]);

  assert.equal(result.runStatus, "OPTIONS_READY");
  assert.equal(result.ranking.recommendedOfferId, "offer-1");
  assert.equal(result.ranking.options[0].rank, 1);
  assert.equal(result.ranking.options[0].rawScore, 93);
  assert.equal(result.ranking.decisionConfidence, 84);
  assert.equal(result.confidenceComponents.candidateSeparation, 0);
  assert.equal(result.requiresReview, true);
  assert.ok(result.ranking.options[0].reasons.length >= 7);
});

test("Golden Flow reproduces 89/84/72 from data without carrier-specific rules", () => {
  const result = evaluateBalancedOffers(RUN_ID, [
    offer({
      offerId: "offer-a",
      carrierId: "carrier-a",
      totalPrice: 1760,
      transitHours: 31,
      reliabilityScore: 96,
      routeOperations: 100,
      historicalAveragePrice: 1732,
    }),
    offer({
      offerId: "offer-b",
      carrierId: "carrier-b",
      totalPrice: 1920,
      transitHours: 29,
      reliabilityScore: 98,
      routeOperations: 50,
      historicalAveragePrice: 1880,
    }),
    offer({
      offerId: "offer-c",
      carrierId: "carrier-c",
      totalPrice: 1590,
      transitHours: 60,
      reliabilityScore: 86,
      routeOperations: 50,
      availabilityClass: "LIMITED_WINDOW",
      historicalAveragePrice: 1650,
    }),
  ]);

  assert.deepEqual(
    result.ranking.options.map((item) => item.offerId),
    ["offer-a", "offer-b", "offer-c"],
  );
  assert.deepEqual(
    result.ranking.options.map((item) => item.rawScore),
    [89.2949, 84.2031, 72.1667],
  );
  assert.deepEqual(
    result.ranking.options.map((item) => item.roundedScore),
    [89, 84, 72],
  );
  assert.equal(result.ranking.decisionConfidence, 88);
  assert.equal(result.confidenceComponents.rawDecisionConfidence, 88.0188);
  assert.equal(result.ranking.recommendedOfferId, "offer-a");
});

test("ineligible offers remain explainable and do not affect relative normalization", () => {
  const result = evaluateBalancedOffers(RUN_ID, [
    offer({ offerId: "eligible", carrierId: "carrier-z" }),
    offer({
      offerId: "unavailable",
      carrierId: "carrier-a",
      totalPrice: 1,
      availabilityClass: "UNAVAILABLE",
    }),
    offer({
      offerId: "over-budget",
      carrierId: "carrier-b",
      totalPrice: 100,
      eligible: false,
      ineligibilityReasons: ["El precio supera el presupuesto máximo."],
    }),
  ]);

  assert.equal(result.ranking.recommendedOfferId, "eligible");
  assert.equal(result.ranking.options[0].rawScore, 93);
  assert.equal(result.ranking.options[1].eligible, false);
  assert.equal(result.ranking.options[1].rank, 0);
  assert.equal(result.ranking.options[2].eligible, false);
  assert.match(result.ranking.options[1].reasons.join(" "), /no disponible/i);
});

test("ties use reliability, price, transit and carrierId in deterministic order", () => {
  const same = {
    totalPrice: 1700,
    transitHours: 30,
    reliabilityScore: 95,
    routeOperations: 80,
    historicalAveragePrice: 1700,
  };
  const result = evaluateBalancedOffers(RUN_ID, [
    offer({ offerId: "offer-z", carrierId: "carrier-z", ...same }),
    offer({ offerId: "offer-a", carrierId: "carrier-a", ...same }),
  ]);

  assert.deepEqual(
    result.ranking.options.map((item) => item.offerId),
    ["offer-a", "offer-z"],
  );
  assert.equal(result.confidenceComponents.candidateSeparation, 0);
});

test("unknown availability classes are rejected instead of producing NaN scores", () => {
  const invalid = offer({ offerId: "invalid", carrierId: "carrier-invalid" });
  invalid.availabilityClass = "LEGACY_UNKNOWN" as BalancedOfferInput["availabilityClass"];

  const result = evaluateBalancedOffers(RUN_ID, [invalid]);

  assert.equal(result.runStatus, "NO_MATCH");
  assert.equal(result.ranking.recommendedOfferId, null);
  assert.equal(result.ranking.options[0].eligible, false);
  assert.match(result.ranking.options[0].reasons.join(" "), /contrato BALANCED/i);
});

test("offers already marked INELIGIBLE cannot re-enter the ranking", () => {
  const result = evaluateBalancedOffers(RUN_ID, [
    offer({
      offerId: "ineligible-status",
      carrierId: "carrier-ineligible",
      status: "INELIGIBLE",
      eligible: true,
    }),
  ]);

  assert.equal(result.runStatus, "NO_MATCH");
  assert.equal(result.ranking.recommendedOfferId, null);
  assert.equal(result.ranking.options[0].eligible, false);
  assert.match(result.ranking.options[0].reasons.join(" "), /estado INELIGIBLE/i);
});
