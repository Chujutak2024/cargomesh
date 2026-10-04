import { CarrierOfferV2Schema, ScoringPolicyV2Schema, type CarrierOfferV2,
  type ScoringPolicyV2 } from "@/shared/schemas/v2/commercial";

export class CommercialPolicyError extends Error {
  constructor(public readonly code: string) { super(code); }
}
export type QuotedAssignment = { id: string; carrierId: string; serviceId: string };
export type OfferContext = { requestId: string; planCandidateId: string; opportunityId: string;
  carrierId: string; assignments: QuotedAssignment[] };
export function validateAttributableOffer(raw: unknown, context: OfferContext): CarrierOfferV2 {
  const offer = CarrierOfferV2Schema.parse(raw);
  if (offer.requestId !== context.requestId || offer.planCandidateId !== context.planCandidateId
    || offer.opportunityId !== context.opportunityId || offer.carrierId !== context.carrierId) {
    throw new CommercialPolicyError("OFFER_CONTEXT_MISMATCH");
  }
  const assignments = new Map(context.assignments.map((assignment) => [assignment.id, assignment]));
  const services = new Set<string>();
  for (const id of offer.coveredAssignmentIds) {
    const assignment = assignments.get(id);
    if (!assignment || assignment.carrierId !== offer.carrierId) {
      throw new CommercialPolicyError("OFFER_ASSIGNMENT_MISMATCH");
    }
    services.add(assignment.serviceId);
  }
  if (services.size !== offer.coveredServiceIds.length || offer.coveredServiceIds.some((id) => !services.has(id))) {
    throw new CommercialPolicyError("OFFER_SERVICE_MISMATCH");
  }
  return offer;
}
export function offerIsCurrent(offer: CarrierOfferV2, at: string): boolean {
  const instant = Date.parse(at);
  if (!Number.isFinite(instant)) throw new CommercialPolicyError("INVALID_CLOCK");
  return offer.status === "RECEIVED" && Date.parse(offer.issuedAt) <= instant
    && Date.parse(offer.validity.startsAt) <= instant && instant < Date.parse(offer.validity.endsAt);
}
export type RankingCandidate = { offer: CarrierOfferV2; eligibility: "eligible" | "ineligible" | "unknown";
  reliability: { rate: number; sampleSize: number; periodEndsAt: string; validUntil: string } | null };
export function rankCommercialOffers(candidates: RankingCandidate[], rawPolicy: unknown, at: string) {
  const policy = ScoringPolicyV2Schema.parse(rawPolicy);
  const excluded: { offerId: string; reason: string }[] = [];
  const accepted = candidates.filter((candidate) => {
    const offer = CarrierOfferV2Schema.parse(candidate.offer);
    let reason: string | null = candidate.eligibility !== "eligible" ? "PLAN_NOT_ELIGIBLE" : null;
    if (!reason && !offerIsCurrent(offer, at)) reason = "OFFER_NOT_CURRENT";
    if (!reason && offer.breakdown.some((cost) => ["UNKNOWN", "ESTIMATED", "EXCLUDED"].includes(cost.treatment))) {
      reason = "TOTAL_COST_NOT_COMPARABLE";
    }
    if (!reason && policy.weights.transit > 0 && offer.transitDurationSeconds === null) reason = "TRANSIT_UNKNOWN";
    const metric = candidate.reliability;
    if (!reason && policy.weights.reliability > 0 && (!metric || !Number.isFinite(metric.rate)
      || metric.rate < 0 || metric.rate > 1 || !Number.isInteger(metric.sampleSize) || metric.sampleSize <= 0
      || !Number.isFinite(Date.parse(metric.periodEndsAt)) || Date.parse(metric.periodEndsAt) > Date.parse(at)
      || !Number.isFinite(Date.parse(metric.validUntil)) || Date.parse(metric.validUntil) <= Date.parse(at))) reason = "RELIABILITY_UNKNOWN";
    if (reason) excluded.push({ offerId: offer.id, reason });
    return reason === null;
  });
  const duplicateIds = new Set(accepted.map((candidate) => candidate.offer.id));
  if (duplicateIds.size !== accepted.length) throw new CommercialPolicyError("DUPLICATE_OFFER");
  const costs = accepted.map((candidate) => Math.round(candidate.offer.price.amount * 100));
  const transits = accepted.map((candidate) => candidate.offer.transitDurationSeconds ?? 0);
  const normalizeLower = (values: number[], index: number) => {
    const min = Math.min(...values), max = Math.max(...values);
    return max === min ? 1 : (max - values[index]) / (max - min);
  };
  const options = accepted.map((candidate, index) => {
    const dimensions = { cost: normalizeLower(costs, index),
      transit: candidate.offer.transitDurationSeconds === null ? null : normalizeLower(transits, index),
      reliability: candidate.reliability?.rate ?? null };
    const score = dimensions.cost * policy.weights.cost + (dimensions.transit ?? 0) * policy.weights.transit
      + (dimensions.reliability ?? 0) * policy.weights.reliability;
    return { offerId: candidate.offer.id, score, explanation: { dimensions, weights: policy.weights },
      missingData: [], policyVersion: policy.version };
  }).sort((a, b) => b.score - a.score || (a.offerId < b.offerId ? -1 : a.offerId > b.offerId ? 1 : 0));
  return { policyVersion: policy.version, options: options.map((option, i) => ({ ...option, position: i + 1 })), excluded };
}

/** Multi-offer selection creates distinct attributable commitments per offer. */
export function validateOfferSelection(offers: CarrierOfferV2[], context: {
  requestId: string; planCandidateId: string; assignments: QuotedAssignment[];
  eligibility: "eligible" | "ineligible" | "unknown";
}, at: string) {
  if (context.eligibility !== "eligible") throw new CommercialPolicyError("PLAN_NOT_ELIGIBLE");
  if (!offers.length || new Set(offers.map((offer) => offer.id)).size !== offers.length) {
    throw new CommercialPolicyError("INVALID_OFFER_SELECTION");
  }
  const covered = new Set<string>();
  for (const raw of offers) {
    const offer = validateAttributableOffer(raw, { ...context, carrierId: raw.carrierId, opportunityId: raw.opportunityId });
    if (!offerIsCurrent(offer, at)) throw new CommercialPolicyError("OFFER_NOT_CURRENT");
    if (offer.breakdown.some((item) => ["UNKNOWN", "ESTIMATED", "EXCLUDED"].includes(item.treatment))) {
      throw new CommercialPolicyError("TOTAL_COST_NOT_COMPARABLE");
    }
    for (const id of offer.coveredAssignmentIds) {
      if (covered.has(id)) throw new CommercialPolicyError("OVERLAPPING_OFFER_COVERAGE");
      covered.add(id);
    }
  }
  if (covered.size !== context.assignments.length || context.assignments.some((assignment) => !covered.has(assignment.id))) {
    throw new CommercialPolicyError("INCOMPLETE_OFFER_COVERAGE");
  }
  return offers.map((offer) => ({ requestId: context.requestId, planCandidateId: context.planCandidateId,
    offerId: offer.id, carrierId: offer.carrierId, assignmentIds: [...offer.coveredAssignmentIds] }));
}
