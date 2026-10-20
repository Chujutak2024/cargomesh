import { CarrierOfferV2Schema } from "@/shared/schemas/v2/commercial";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { WorkflowRecordV2 } from "./shipper-model";
import { offerAvailability } from "./commercial-view";

export type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
export type Plan = Extract<WorkflowRecordV2, { kind: "plans" }>;
export type Opportunity = Extract<WorkflowRecordV2, { kind: "opportunities" }>;
export type Ranking = Extract<WorkflowRecordV2, { kind: "ranking" }>;
export type RankedOption = Ranking["data"]["options"][number];
export type CommercialContext = { request: FreightRequestV2Data; plans: Plan[]; opportunities: Opportunity[]; offers: Offer[]; ranking: Ranking | null };

const inRequest = (row: WorkflowRecordV2, request: FreightRequestV2Data) => row.requestId === request.id && row.organizationId === request.organizationId;
const sameIds = (a: string[], b: string[]) => new Set(a).size === a.length && new Set(b).size === b.length
  && a.length === b.length && a.every(id => b.includes(id));

/** Projection integrity only. Eligibility and rank are read from backend records, never recomputed. */
export function inspectOffer(offer: Offer, context: CommercialContext, now = Date.now()) {
  const reasons: string[] = [];
  const raw = Object.fromEntries(Object.keys(CarrierOfferV2Schema.innerType().shape).map(key => [key, offer.data[key]]));
  if (!CarrierOfferV2Schema.safeParse(raw).success) reasons.push("OFFER_CONTRACT_INVALID");
  if (!inRequest(offer, context.request) || offer.data.id !== offer.id || offer.data.requestId !== offer.requestId
    || offer.data.carrierId !== offer.carrierId || offer.status !== offer.data.status) reasons.push("OFFER_SCOPE_MISMATCH");
  const plan = context.plans.find(row => row.id === offer.data.planCandidateId);
  const opportunity = context.opportunities.find(row => row.id === offer.data.opportunityId);
  if (!plan) reasons.push("PLAN_NOT_LOADED");
  else if (!inRequest(plan, context.request)) reasons.push("PLAN_SCOPE_MISMATCH");
  if (!opportunity) reasons.push("OPPORTUNITY_NOT_LOADED");
  else {
    if (!inRequest(opportunity, context.request) || opportunity.carrierId !== offer.carrierId
      || opportunity.data.carrierId !== offer.carrierId || opportunity.data.planId !== offer.data.planCandidateId) reasons.push("OPPORTUNITY_SCOPE_MISMATCH");
    if (offer.data.coveredAssignmentIds.some(id => !opportunity.data.assignmentIds.includes(id))) reasons.push("OPPORTUNITY_ASSIGNMENT_MISMATCH");
  }
  if (plan) {
    const legs = offer.data.coveredAssignmentIds.map(id => plan.data.legAssignments.find(leg => leg.id === id));
    if (legs.some(leg => !leg || leg.carrierId !== offer.carrierId)) reasons.push("PLAN_ASSIGNMENT_MISMATCH");
    const serviceIds = [...new Set(legs.flatMap(leg => leg ? [leg.serviceId] : []))];
    if (!sameIds(serviceIds, offer.data.coveredServiceIds)) reasons.push("OFFER_SERVICE_MISMATCH");
  }
  const linked = reasons.length === 0;
  if (plan && plan.data.requestVersion !== context.request.draftVersion) reasons.push("STALE_REQUEST_VERSION");
  if (plan && plan.data.eligibility !== "eligible") reasons.push(plan.data.eligibility === "unknown" ? "PLAN_ELIGIBILITY_UNKNOWN" : "PLAN_INELIGIBLE");
  const availability = offerAvailability(offer, now);
  if (availability !== "AVAILABLE") reasons.push(availability);
  return { linked, current: reasons.length === 0, reasons: [...new Set(reasons)], plan, opportunity, availability };
}

export function inspectRankedOption(option: RankedOption | null, context: CommercialContext, now = Date.now()) {
  if (!option) return { available: false, reasons: ["NO_SELECTION"] };
  const reasons: string[] = [];
  if (!context.ranking || !inRequest(context.ranking, context.request)) reasons.push("RANKING_SCOPE_MISMATCH");
  if (option.policyVersion !== context.ranking?.data.policyVersion) reasons.push("RANKING_POLICY_MISMATCH");
  const plan = context.plans.find(row => row.id === option.planId);
  if (!plan) reasons.push("PLAN_NOT_LOADED");
  const selected = option.offerIds.map(id => context.offers.find(row => row.id === id));
  if (!option.offerIds.length || new Set(option.offerIds).size !== option.offerIds.length || selected.some(row => !row)) reasons.push("OFFER_NOT_LOADED");
  for (const offer of selected) if (offer) {
    reasons.push(...inspectOffer(offer, context, now).reasons);
    if (offer.data.planCandidateId !== option.planId) reasons.push("RANKING_PLAN_MISMATCH");
  }
  const covered = selected.flatMap(row => row?.data.coveredAssignmentIds ?? []);
  if (plan && (!sameIds(covered, plan.data.legAssignments.map(leg => leg.id)) || !sameIds(option.assignments, covered))) reasons.push("RANKING_COVERAGE_MISMATCH");
  if (selected.every((row): row is Offer => Boolean(row))
    && Math.round(selected.reduce((sum, row) => sum + row.data.price.amount, 0) * 100) !== Math.round(option.costCents)) reasons.push("RANKING_PRICE_MISMATCH");
  return { available: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** The backend's grouped assignment IDs, not client-generated resources or guessed coverage. */
export function opportunityTargets(context: CommercialContext) {
  return context.plans.filter(plan => inRequest(plan, context.request)).flatMap(plan => {
    const carrierIds = [...new Set(plan.data.legAssignments.map(leg => leg.carrierId))];
    return carrierIds.map(carrierId => {
      const legs = plan.data.legAssignments.filter(leg => leg.carrierId === carrierId);
      const existing = context.opportunities.filter(row => inRequest(row, context.request) && row.data.planId === plan.id && row.carrierId === carrierId);
      return { key: `${plan.id}:${carrierId}`, plan, carrierId, assignmentIds: legs.map(leg => leg.id),
        serviceIds: [...new Set(legs.map(leg => leg.serviceId))], existing,
        current: plan.data.eligibility === "eligible" && plan.data.requestVersion === context.request.draftVersion };
    });
  });
}
