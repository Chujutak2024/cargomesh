import assert from "node:assert/strict";
import test from "node:test";
import { inspectOffer, inspectRankedOption, opportunityTargets } from "./commercial-context";
import { commercialFixture, id, at } from "./commercial-context.test-fixtures";
import { buildOfferBriefing } from "./offer-briefing";
const now = Date.parse(at);

test("links the same request, organization, plan, opportunity, Carrier and native assignments", () => {
  const context = commercialFixture();
  assert.equal(inspectOffer(context.offers[0], context, now).linked, true);
  assert.equal(inspectRankedOption(context.ranking!.data.options[0], context, now).available, true);
  assert.equal(buildOfferBriefing(context.offers, context.ranking, now, context).recommended?.position, 1);
});
for (const change of ["organization", "request", "carrier", "embeddedId", "opportunity", "plan", "assignment", "service", "total"]) test(`unverifiable ${change} cannot become a selectable/recommended offer`, () => {
  const context = commercialFixture(), f = context.offers[0];
  if (change === "organization") f.organizationId = id(90);
  if (change === "request") f.data.requestId = id(90);
  if (change === "carrier") f.data.carrierId = id(90);
  if (change === "embeddedId") f.data.id = id(90);
  if (change === "opportunity") f.data.opportunityId = id(90);
  if (change === "plan") f.data.planCandidateId = id(90);
  if (change === "assignment") f.data.coveredAssignmentIds = [id(90)];
  if (change === "service") f.data.coveredServiceIds = [id(90)];
  if (change === "total") f.data.price.amount += 1;
  assert.equal(inspectRankedOption(context.ranking!.data.options[0], context, now).available, false);
  assert.equal(buildOfferBriefing(context.offers, context.ranking, now, context).recommended, null);
});
test("plan eligibility comes from the backend, not equipment or a matching Carrier name", () => {
  const context = commercialFixture();
  context.plans[0].data.eligibility = "unknown";
  assert.ok(inspectOffer(context.offers[0], context, now).reasons.includes("PLAN_ELIGIBILITY_UNKNOWN"));
  assert.equal(opportunityTargets(context)[0].current, false);
  context.plans[0].data.eligibility = "ineligible";
  assert.equal(inspectRankedOption(context.ranking!.data.options[0], context, now).available, false);
});
test("a request revision invalidates the old plan and recommendation without rewriting history", () => {
  const context = commercialFixture(); context.request.draftVersion++;
  assert.ok(inspectOffer(context.offers[0], context, now).reasons.includes("STALE_REQUEST_VERSION"));
  assert.equal(buildOfferBriefing(context.offers, context.ranking, now, context).recommended, null);
  assert.equal(context.offers[0].data.offerVersion, 1);
});
for (const status of ["WITHDRAWN", "SUPERSEDED"] as const) test(`${status} remains historical, not a selectable quote`, () => {
  const context = commercialFixture(); context.offers[0].status = status; context.offers[0].data.status = status;
  assert.equal(inspectOffer(context.offers[0], context, now).linked, true);
  assert.equal(inspectRankedOption(context.ranking!.data.options[0], context, now).available, false);
});
test("expiry and future issuance are enforced at review time", () => {
  const context = commercialFixture();
  assert.equal(inspectOffer(context.offers[0], context, Date.parse("2026-10-21T00:00:00Z")).current, false);
  context.offers[0].data.issuedAt = "2026-10-16T00:00:00Z";
  assert.ok(inspectOffer(context.offers[0], context, now).reasons.includes("NOT_STARTED"));
});
test("ranking price, policy and assignment mismatches do not trigger a local rerank", () => {
  for (const field of ["cost", "policy", "assignments"] as const) {
    const context = commercialFixture(), option = context.ranking!.data.options[0];
    if (field === "cost") option.costCents++;
    if (field === "policy") option.policyVersion = "another-policy";
    if (field === "assignments") option.assignments = [id(90)];
    assert.equal(inspectRankedOption(option, context, now).available, false);
    assert.equal(option.position, 1); assert.equal(option.score, 1);
  }
});
test("empty and missing collections never invent offers, plans or opportunities", () => {
  const context = commercialFixture(); context.plans = []; context.opportunities = [];
  assert.equal(inspectOffer(context.offers[0], context, now).linked, false);
  assert.deepEqual(opportunityTargets(context), []);
  context.offers = []; context.ranking = null;
  assert.equal(buildOfferBriefing([], null, now, context).recommended, null);
});
test("opportunity targets retain native grouped assignments and do not mix tenants", () => {
  const context = commercialFixture(), target = opportunityTargets(context)[0];
  assert.deepEqual(target.assignmentIds, context.opportunities[0].data.assignmentIds);
  assert.equal(target.existing.length, 1);
  context.plans[0].organizationId = id(90);
  assert.deepEqual(opportunityTargets(context), []);
});
test("an otherwise valid quote cannot use another tenant's ranking or opportunity", () => {
  for (const target of ["ranking", "opportunity", "plan"] as const) {
    const context = commercialFixture();
    if (target === "ranking") context.ranking!.organizationId = id(90);
    if (target === "opportunity") context.opportunities[0].organizationId = id(90);
    if (target === "plan") context.plans[0].requestId = id(90);
    assert.equal(inspectRankedOption(context.ranking!.data.options[0], context, now).available, false);
  }
});
test("native envelope supersession/withdrawal is authoritative over the immutable issuer snapshot", () => {
  for (const status of ["SUPERSEDED", "WITHDRAWN"] as const) {
    const context = commercialFixture(), offer = context.offers[0]; offer.status = status; offer.version++;
    assert.equal(offer.data.status, "RECEIVED");
    const inspected = inspectOffer(offer, context, now);
    assert.equal(inspected.linked, true); assert.equal(inspected.current, false); assert.ok(inspected.reasons.includes(status));
    assert.equal(buildOfferBriefing(context.offers, context.ranking, now, context).recommended, null);
  }
});
