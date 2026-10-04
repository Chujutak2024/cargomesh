import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CarrierOfferV2Schema } from "@/shared/schemas/v2/commercial";
import { rankCommercialOffers, validateAttributableOffer, validateOfferSelection, offerIsCurrent } from "./offer-policy";
const uuid = (n: number) => `d0440000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-10-05T00:00:00Z";
const evidence = { reference: "carrier:quote", provider: "QA issuer", observedAt: "2026-10-04T00:00:00Z",
  validUntil: "2026-10-06T00:00:00Z", provenanceStatus: "VERIFIED" as const };
function offer(n = 1, price = 100) {
  return CarrierOfferV2Schema.parse({ id: uuid(n), carrierReference: `QUOTE-${n}`,
    requestId: uuid(10), planCandidateId: uuid(11), opportunityId: uuid(12), carrierId: uuid(13),
    coveredServiceIds: [uuid(14)], coveredAssignmentIds: [uuid(15)],
    price: { amount: price, currency: "USD" },
    breakdown: [{ kind: "TRANSPORT", amount: { amount: price, currency: "USD" }, treatment: "QUOTED",
      source: evidence, observedAt: evidence.observedAt, details: null },
    { kind: "FUEL", amount: { amount: 10, currency: "USD" }, treatment: "INCLUDED",
      source: evidence, observedAt: evidence.observedAt, details: null }],
    validity: { startsAt: "2026-10-04T00:00:00Z", endsAt: "2026-10-06T00:00:00Z" },
    source: { channel: "MANUAL", issuerId: uuid(16), evidence }, status: "RECEIVED", issuedAt: "2026-10-04T00:00:00Z",
    estimatedPickupAt: null, estimatedDeliveryAt: null, transitDurationSeconds: null,
    reservableCapacity: null, commercialTerms: [], evidence: [evidence], offerVersion: 1, supersedesOfferId: null });
}
const policy = { version: "cost-v1", objective: "LOWEST_COST", weights: { cost: 1, transit: 0, reliability: 0 },
  missingDataRule: "EXCLUDE", tieBreaker: "OFFER_ID_ASC" };
const assignments = [{ id: uuid(15), carrierId: uuid(13), serviceId: uuid(14) }];
describe("V2 attributable offers, ranking and separate commercial commitments", () => {
  it("included amounts are not charged twice; contradicting quoted total is rejected", () => {
    const value = offer(); assert.equal(value.price.amount, 100);
    assert.equal(CarrierOfferV2Schema.safeParse({ ...value, price: { amount: 110, currency: "USD" } }).success, false);
    assert.equal(CarrierOfferV2Schema.safeParse({ ...value, price: { amount: 100, currency: "PEN" } }).success, false);
  });
  it("checks issuer, request, plan, opportunity, assignments and services", () => {
    const value = offer();
    const context = { requestId: uuid(10), planCandidateId: uuid(11), opportunityId: uuid(12), carrierId: uuid(13), assignments };
    assert.equal(validateAttributableOffer(value, context).id, value.id);
    assert.throws(() => validateAttributableOffer({ ...value, carrierId: uuid(99) }, context), { code: "OFFER_CONTEXT_MISMATCH" });
    assert.throws(() => validateAttributableOffer({ ...value, coveredServiceIds: [uuid(99)] }, context), { code: "OFFER_SERVICE_MISMATCH" });
  });
  it("ranks only current eligible comparable quotes, with stable ties independent of input order", () => {
    const candidates = [offer(2, 100), offer(1, 100), offer(3, 150)].map((item) => ({ offer: item,
      eligibility: "eligible" as const, reliability: null }));
    const ranked = rankCommercialOffers(candidates, policy, at);
    assert.deepEqual(ranked, rankCommercialOffers([...candidates].reverse(), policy, at));
    assert.deepEqual(ranked.options.map((item) => item.offerId), [uuid(1), uuid(2), uuid(3)]);
    assert.equal(ranked.options[0].explanation.dimensions.transit, null);
    assert.equal(offerIsCurrent(offer(), "2026-10-06T00:00:00Z"), false);
    const conditional = { ...candidates[0], eligibility: "unknown" as const };
    assert.deepEqual(rankCommercialOffers([conditional], policy, at).excluded,
      [{ offerId: uuid(2), reason: "PLAN_NOT_ELIGIBLE" }]);
  });
  it("missing transit/metrics exclude under a weighted policy rather than receive invented scores", () => {
    const candidate = { offer: offer(), eligibility: "eligible" as const, reliability: null };
    const timePolicy = { ...policy, objective: "FASTEST", weights: { cost: 0, transit: 1, reliability: 0 } };
    assert.equal(rankCommercialOffers([candidate], timePolicy, at).excluded[0].reason, "TRANSIT_UNKNOWN");
    const weighted = { ...policy, objective: "WEIGHTED", weights: { cost: 0.5, transit: 0, reliability: 0.5 } };
    assert.equal(rankCommercialOffers([candidate], weighted, at).excluded[0].reason, "RELIABILITY_UNKNOWN");
  });
  it("multiple offers produce separate commitments and must cover every assignment exactly once", () => {
    const first = offer();
    const second = { ...offer(2), carrierId: uuid(23), opportunityId: uuid(22),
      coveredServiceIds: [uuid(24)], coveredAssignmentIds: [uuid(25)] };
    const context = { requestId: uuid(10), planCandidateId: uuid(11), eligibility: "eligible" as const,
      assignments: [...assignments, { id: uuid(25), carrierId: uuid(23), serviceId: uuid(24) }] };
    const commitments = validateOfferSelection([first, second], context, at);
    assert.equal(commitments.length, 2); assert.deepEqual(commitments.map((item) => item.carrierId), [uuid(13), uuid(23)]);
    assert.throws(() => validateOfferSelection([first], context, at), { code: "INCOMPLETE_OFFER_COVERAGE" });
    assert.throws(() => validateOfferSelection([first, offer(3)], { ...context, assignments }, at), { code: "OVERLAPPING_OFFER_COVERAGE" });
    assert.throws(() => validateOfferSelection([first, second], context, "2026-10-07T00:00:00Z"), { code: "OFFER_NOT_CURRENT" });
  });
});
