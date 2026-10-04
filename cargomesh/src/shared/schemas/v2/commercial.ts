import { z } from "zod";
import { TimeWindowV2Schema } from "./freight-request";

const Id = z.string().uuid();
const Instant = z.string().datetime({ offset: true });
export const CommercialEvidenceV2Schema = z.object({
  reference: z.string().trim().min(1).max(500), provider: z.string().trim().min(1).max(150),
  observedAt: Instant, validUntil: Instant.nullable(),
  provenanceStatus: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]),
}).strict().refine((item) => item.validUntil === null || Date.parse(item.validUntil) > Date.parse(item.observedAt));
export const UsdMoneyV2Schema = z.object({
  amount: z.number().finite().min(0).max(1e10).refine((value) =>
    Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use at most two decimal places."),
  currency: z.literal("USD"),
}).strict();
export const OfferCostComponentV2Schema = z.object({
  kind: z.enum(["TRANSPORT", "FUEL", "TOLL", "HANDLING", "SPECIAL_EQUIPMENT", "BORDER", "TAX", "DISCOUNT", "OTHER"]),
  amount: UsdMoneyV2Schema.nullable(),
  treatment: z.enum(["INCLUDED", "QUOTED", "ESTIMATED", "EXCLUDED", "UNKNOWN"]),
  source: CommercialEvidenceV2Schema, observedAt: Instant, details: z.string().max(1000).nullable(),
}).strict().refine((item) => !["QUOTED", "INCLUDED"].includes(item.treatment) || item.amount !== null, {
  message: "A quoted/included component requires an amount.", path: ["amount"],
});
export const CarrierOfferV2Schema = z.object({
  id: Id, carrierReference: z.string().trim().min(1).max(200),
  requestId: Id, planCandidateId: Id, opportunityId: Id, carrierId: Id,
  coveredServiceIds: z.array(Id).min(1), coveredAssignmentIds: z.array(Id).min(1),
  price: UsdMoneyV2Schema.refine((price) => price.amount > 0),
  breakdown: z.array(OfferCostComponentV2Schema).min(1), validity: TimeWindowV2Schema,
  source: z.object({ channel: z.enum(["MANUAL", "API", "MCP"]), issuerId: Id,
    evidence: CommercialEvidenceV2Schema }).strict(),
  status: z.enum(["RECEIVED", "WITHDRAWN", "SUPERSEDED"]), issuedAt: Instant,
  estimatedPickupAt: Instant.nullable(), estimatedDeliveryAt: Instant.nullable(),
  transitDurationSeconds: z.number().finite().positive().nullable(),
  reservableCapacity: z.object({ weightKg: z.number().finite().nonnegative(),
    volumeM3: z.number().finite().nonnegative().nullable() }).strict().nullable(),
  commercialTerms: z.array(z.object({ code: z.string().min(1), description: z.string().min(1).max(2000) }).strict()),
  evidence: z.array(CommercialEvidenceV2Schema).min(1), offerVersion: z.number().int().positive(),
  supersedesOfferId: Id.nullable(),
}).strict().superRefine((offer, ctx) => {
  if (new Set(offer.coveredAssignmentIds).size !== offer.coveredAssignmentIds.length
    || new Set(offer.coveredServiceIds).size !== offer.coveredServiceIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate service/assignment references." });
  }
  if (Date.parse(offer.issuedAt) > Date.parse(offer.validity.endsAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Offer validity precedes issuance." });
  }
  if (offer.estimatedPickupAt && offer.estimatedDeliveryAt
    && Date.parse(offer.estimatedDeliveryAt) <= Date.parse(offer.estimatedPickupAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Delivery must follow pickup." });
  }
  if (offer.offerVersion === 1 && offer.supersedesOfferId !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The first offer version cannot supersede another." });
  }
  const quoted = offer.breakdown.filter((item) => item.treatment === "QUOTED");
  const quotedCents = quoted.reduce((sum, item) => sum + (item.kind === "DISCOUNT" ? -1 : 1)
    * Math.round((item.amount?.amount ?? 0) * 100), 0);
  if (!quoted.length || quotedCents !== Math.round(offer.price.amount * 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["breakdown"],
      message: "Quoted components, less discounts, must equal the issuer's total; included components are not added twice." });
  }
});
export const ScoringPolicyV2Schema = z.object({
  version: z.string().trim().min(1).max(100),
  objective: z.enum(["LOWEST_COST", "FASTEST", "WEIGHTED"]),
  weights: z.object({ cost: z.number().min(0).max(1), transit: z.number().min(0).max(1),
    reliability: z.number().min(0).max(1) }).strict(),
  missingDataRule: z.literal("EXCLUDE"), tieBreaker: z.literal("OFFER_ID_ASC"),
}).strict().superRefine((policy, ctx) => {
  if (Math.abs(policy.weights.cost + policy.weights.transit + policy.weights.reliability - 1) > 1e-9
    || (policy.objective === "LOWEST_COST" && policy.weights.cost !== 1)
    || (policy.objective === "FASTEST" && policy.weights.transit !== 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Weights must sum to one and match the objective." });
  }
});
export type CarrierOfferV2 = z.infer<typeof CarrierOfferV2Schema>;
export type ScoringPolicyV2 = z.infer<typeof ScoringPolicyV2Schema>;
