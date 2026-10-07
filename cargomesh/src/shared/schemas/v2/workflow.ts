import { z } from "zod";
import { CanonicalLocationV2Schema, TimeWindowV2Schema, TransportModeV2Schema } from "./freight-request";
import { CarrierOfferV2Schema, CommercialEvidenceV2Schema, ScoringPolicyV2Schema } from "./commercial";

const Id = z.string().uuid();
const Text = z.string().trim().min(1).max(2000);
const Instant = z.string().datetime({ offset: true });
const Evidence = CommercialEvidenceV2Schema;
const Location = CanonicalLocationV2Schema.omit({ facilityId: true });
const Dimensions = z.object({ length: z.number().positive(), width: z.number().positive(), height: z.number().positive() }).strict();
const Rules = z.array(z.object({ code: Text, description: Text, required: z.boolean(), evidence: Evidence.nullable() }).strict()).max(100);
const UniqueIds = z.array(Id).min(1).max(100).refine(v => new Set(v).size === v.length, "Duplicate references.");
const Revision = { expectedVersion: z.number().int().positive() };
const Audit = { ...Revision, note: Text, evidence: Evidence };
const Base = { schemaVersion: z.literal("2.0") };
const Publishing = { ...Base, active: z.boolean() };
const PlanResourceInput = z.object({ calendarId: Id, assetId: Id.nullable(), capacityPoolId: Id.nullable(), combinationId: Id.nullable(),
  role: z.enum(["LOAD_BEARING", "AUXILIARY"]),
  allocations: z.array(z.object({ unitIndex: z.number().int().nonnegative(), quantity: z.number().int().positive() }).strict()).max(100)
}).strict().refine(v => (v.assetId === null) !== (v.capacityPoolId === null))
  .refine(v => v.role !== "AUXILIARY" || v.allocations.length === 0);
const GroupedPlanAssignmentInput = z.object({ legSequence: z.number().int().positive(), serviceId: Id, laneId: Id,
  window: TimeWindowV2Schema, resources: z.array(PlanResourceInput).min(1).max(100) }).strict()
  .refine(v => new Set(v.resources.map(r => r.assetId ?? r.capacityPoolId)).size === v.resources.length,
    "A physical capacity source cannot occur twice in one assignment.");
export const WorkflowInputsV2 = {
  "nodes.publish": z.object({ ...Publishing, kind: z.enum(["PORT", "TERMINAL", "BORDER", "HUB"]), name: Text,
    location: Location, jurisdiction: Text.nullable(), source: Evidence, verifiedAt: Instant.nullable() }).strict(),
  "corridors.publish": z.object({ ...Publishing, originNodeId: Id, destinationNodeId: Id, mode: TransportModeV2Schema,
    estimatedDistanceKm: z.number().nonnegative().nullable(), estimatedDurationSeconds: z.number().positive().nullable(),
    restrictions: Rules, source: Evidence, version: Text, validUntil: Instant.nullable(),
    grossWeightLimitKg: z.number().positive().nullable(), payloadLimitKg: z.number().positive().nullable(),
    usableDimensions: Dimensions.nullable(), limitsEvidence: Evidence.nullable(),
    waypoints: z.array(z.object({ kind: z.enum(["FUEL", "REST", "BORDER", "TRANSFER"]), location: Location,
      source: Evidence, verifiedAt: Instant.nullable() }).strict()).max(100) }).strict()
    .refine(v => v.originNodeId !== v.destinationNodeId, "Directed corridor endpoints must differ."),
  "route-policies.publish": z.object({ ...Publishing, version: Text, objective: z.enum(["SHORTEST", "FASTEST", "WEIGHTED"]),
    constraints: Rules, weights: z.object({ distance: z.number().min(0).max(1), duration: z.number().min(0).max(1) }).strict(),
    missingDataRule: z.literal("UNKNOWN") }).strict().refine(v => Math.abs(v.weights.distance + v.weights.duration - 1) < 1e-9),
  "conditions.publish": z.object({ ...Publishing, corridorId: Id, kind: z.enum(["CLOSURE", "DELAY", "HAZARD", "RESTRICTION"]),
    location: Location, observedAt: Instant, validUntil: Instant.nullable(), source: Evidence,
    confidence: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]) }).strict()
    .refine(v => v.validUntil === null || Date.parse(v.validUntil) > Date.parse(v.observedAt)),
  "limits.publish": z.object({ ...Publishing, serviceId: Id, assetId: Id.nullable(), combinationId: Id.nullable(),
    corridorId: Id, manufacturerPayloadLimitKg: z.number().positive(), routeGrossLimitKg: z.number().positive(),
    combinedTareKg: z.number().nonnegative(), usableVolumeM3: z.number().positive(), usableDimensions: Dimensions,
    compatibilityConfirmed: z.boolean(), source: Evidence }).strict()
    .refine(v => (v.assetId === null) !== (v.combinationId === null), "Exactly one physical source required.")
    .refine(v => v.combinedTareKg < v.routeGrossLimitKg),
  "scoring-policies.publish": z.object({ ...Publishing, policy: ScoringPolicyV2Schema }).strict(),
  "metrics.publish": z.object({ ...Base, period: TimeWindowV2Schema, corridorId: Id.nullable(), mode: TransportModeV2Schema.nullable(),
    sampleSize: z.number().int().positive(), onTimeRate: z.number().min(0).max(1).nullable(),
    successfulDeliveryRate: z.number().min(0).max(1).nullable(), source: Evidence }).strict(),
  "routes.create": z.object({ ...Base, corridorIds: UniqueIds, policyId: Id }).strict(),
  "plans.create": z.object({ ...Base, routeId: Id, assignments: z.array(z.union([GroupedPlanAssignmentInput, z.object({ legSequence: z.number().int().positive(),
    serviceId: Id, laneId: Id, calendarId: Id, assetId: Id.nullable(), capacityPoolId: Id.nullable(), combinationId: Id.nullable(),
    role: z.enum(["LOAD_BEARING", "AUXILIARY"]), window: TimeWindowV2Schema,
    allocations: z.array(z.object({ unitIndex: z.number().int().nonnegative(), quantity: z.number().int().positive() }).strict()).max(100)
  }).strict().refine(v => (v.assetId === null) !== (v.capacityPoolId === null))
    .refine(v => v.role !== "AUXILIARY" || v.allocations.length === 0)])).min(1).max(100) }).strict(),
  "opportunities.create": z.object({ ...Base, planId: Id, carrierId: Id, assignmentIds: UniqueIds,
    responseDeadline: Instant, responseChannel: z.enum(["MANUAL", "API", "MCP"]) }).strict(),
  "opportunities.respond": z.object({ ...Base, ...Audit, response: z.enum(["ACCEPTED", "DECLINED"]) }).strict(),
  "offers.create": CarrierOfferV2Schema.innerType().omit({ id: true, requestId: true, opportunityId: true, carrierId: true,
    source: true, status: true, offerVersion: true }).extend({ ...Base,
      source: z.object({ channel: z.enum(["MANUAL", "API", "MCP"]), evidence: Evidence }).strict() }).strict().superRefine((value, ctx) => {
      const { schemaVersion: _transportVersion, ...offer } = value;
      const placeholder = "00000000-0000-4000-8000-000000000001";
      const checked = CarrierOfferV2Schema.safeParse({ ...offer, id: placeholder, requestId: placeholder,
        opportunityId: placeholder, carrierId: placeholder, source: { ...offer.source, issuerId: placeholder },
        status: "RECEIVED", offerVersion: offer.supersedesOfferId === null ? 1 : 2 });
      if (!checked.success) for (const issue of checked.error.issues) ctx.addIssue(issue);
    }),
  "offers.withdraw": z.object({ ...Base, ...Audit }).strict(),
  "ranking.create": z.object({ ...Base, policyId: Id }).strict(),
  "decisions.create": z.object({ ...Base, planId: Id, selectedOfferIds: UniqueIds, rationale: Text,
    policyId: Id.nullable(), consideredOfferIds: z.array(Id).max(100), evidence: z.array(Evidence).min(1).max(100) }).strict(),
  "decisions.revoke": z.object({ ...Base, ...Audit }).strict(),
  "bookings.create": z.object({ ...Base, decisionId: Id, offerId: Id, authorization: z.literal("AUTHORIZE"),
    evidence: Evidence }).strict(),
  "bookings.confirm": z.object({ ...Base, ...Audit, carrierReference: Text, confirmation: z.enum(["CONFIRMED", "REJECTED"]) }).strict(),
  "bookings.cancel": z.object({ ...Base, ...Audit }).strict(),
  "consolidations.create": z.object({ ...Base, serviceId: Id, calendarId: Id, routeId: Id, window: TimeWindowV2Schema,
    cargoCategoryIds: UniqueIds, compatibleRequirementCodes: z.array(Text).max(100), evidence: Evidence }).strict(),
  "consolidations.close": z.object({ ...Base, ...Audit }).strict(),
  "consolidations.start": z.object({ ...Base, ...Audit }).strict(),
  "consolidations.complete": z.object({ ...Base, ...Audit }).strict(),
  "consolidations.cancel": z.object({ ...Base, ...Audit }).strict(),
  "consolidations.position": z.object({ ...Base, ...Audit, location: Location, observedAt: Instant, correlationId: Text }).strict(),
  "holds.create": z.object({ ...Base, bookingId: Id, assignmentId: Id, planResourceId: Id.optional(), expiresAt: Instant,
    consolidationId: Id.nullable().default(null), evidence: Evidence }).strict(),
  "holds.confirm": z.object({ ...Base, ...Audit }).strict(),
  "holds.release": z.object({ ...Base, ...Audit }).strict(),
  "executions.create": z.object({ ...Base, bookingId: Id, serviceId: Id }).strict(),
  "executions.start": z.object({ ...Base, ...Audit }).strict(),
  "executions.complete": z.object({ ...Base, ...Audit }).strict(),
  "executions.cancel": z.object({ ...Base, ...Audit }).strict(),
  "executions.position": z.object({ ...Base, ...Audit, location: Location, observedAt: Instant, correlationId: Text }).strict(),
  "incidents.create": z.object({ ...Base, kind: Text, severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
    occurredAt: Instant, location: Location.nullable(), description: Text, evidence: z.array(Evidence).min(1).max(100) }).strict(),
  "incidents.update": z.object({ ...Base, ...Audit, action: z.enum(["NOTE", "RESOLVE", "REOPEN"]) }).strict(),
  "asset-events.create": z.object({ ...Base, ...Audit, next: z.enum(["AVAILABLE", "IN_SERVICE", "MAINTENANCE", "OUT_OF_SERVICE"]), reason: Text }).strict(),
} as const;
export type WorkflowActionV2 = keyof typeof WorkflowInputsV2;
export type WorkflowValueV2 = z.infer<(typeof WorkflowInputsV2)[WorkflowActionV2]>;
const Verification = z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]);
const Capacity = z.object({ weightKg: z.number().nonnegative(), volumeM3: z.number().nonnegative() }).strict();
const Metadata = { id: Id, organizationId: Id.nullable(), carrierId: Id.nullable(), requestId: Id.nullable(),
  version: z.number().int().positive(), status: Text, createdAt: Instant, updatedAt: Instant };
const StoredEvidence = z.object({ reference: Text, verifiedAt: Instant, validUntil: Instant.nullable(), provenanceStatus: Verification }).strict();
const HoldData = z.object({ bookingId: Id, assignmentId: Id, planResourceId: Id, calendarId: Id, window: TimeWindowV2Schema,
  expiresAt: Instant.nullable(), active: z.boolean(), consolidationId: Id.nullable(), parentReservationId: Id.nullable(),
  capacityCommitted: Capacity, evidence: StoredEvidence }).strict();
const HoldRecord = z.object({ ...Metadata, kind: z.literal("holds"), data: HoldData }).strict();
const Leg = z.object({ id: Id, corridorId: Id, sequence: z.number().int().positive(), mode: TransportModeV2Schema,
  origin: Location, destination: Location, borderRequirements: Rules, estimatedDistanceKm: z.number().nonnegative().nullable(),
  estimatedDurationSeconds: z.number().positive().nullable(), source: Evidence, corridorVersion: z.number().int().positive(),
  waypoints: WorkflowInputsV2["corridors.publish"].innerType().shape.waypoints,
  conditions: z.array(WorkflowInputsV2["conditions.publish"]),
  originNodeVersion: z.number().int().positive(), destinationNodeVersion: z.number().int().positive() }).strict();
const VerificationSource = z.object({ calendarId: Id, calendarVersion: z.number().int().positive(), limitsId: Id.nullable(),
  limitsVersion: z.number().int().nullable(), corridorId: Id, source: Evidence.nullable(), laneId: Id }).strict();
const EffectiveCapacity = Capacity.extend({ usableDimensions: Dimensions.nullable() }).strict();
const Resource = z.object({ assetId: Id.nullable(), poolId: Id.nullable(), calendarId: Id, combinationId: Id.nullable(),
  role: z.enum(["LOAD_BEARING", "AUXILIARY"]), equipment: Text, units: z.number().int().positive(),
  window: TimeWindowV2Schema, availability: Verification, applicableCapacity: EffectiveCapacity.nullable(),
  verificationSource: VerificationSource.nullable() }).strict();
const Allocation = z.object({ unitIndex: z.number().int().nonnegative(), quantity: z.number().int().positive(),
  assignedWeightKg: z.number().positive(), assignedVolumeM3: z.number().positive(), handlingRequirements: z.array(Text),
  verification: Verification, indivisible: z.boolean(), dimensionsCm: Dimensions }).strict();
const Assignment = z.object({ id: Id, legAssignmentId: Id, resourceId: Id, serviceId: Id, carrierId: Id, sequence: z.number().int().positive(),
  window: TimeWindowV2Schema, responsibility: z.object({ carrierId: Id, serviceId: Id }).strict(), coverage: Verification,
  availability: Verification, capacityNeeded: Capacity, evidence: z.array(Evidence), resource: Resource,
  allocations: z.array(Allocation) }).strict();
const LegAssignment = z.object({ id: Id, serviceId: Id, carrierId: Id, sequence: z.number().int().positive(),
  window: TimeWindowV2Schema, responsibility: z.object({ carrierId: Id, serviceId: Id }).strict(), coverage: Verification,
  availability: Verification, capacityNeeded: Capacity, evidence: z.array(Evidence),
  resources: z.array(z.object({ bindingId: Id, resourceId: Id, resource: Resource, allocations: z.array(Allocation) }).strict()).min(1),
}).strict();
const RankingOption = z.object({ offerId: Id, offerIds: z.array(Id).min(1), planId: Id, assignments: z.array(Id).min(1),
  costCents: z.number().nonnegative(), transit: z.number().nonnegative().nullable(), reliability: z.number().min(0).max(1).nullable(),
  metrics: z.array(Id.nullable()), policyVersion: Text, transitAggregation: z.literal("SUM_ISSUER_DURATIONS"),
  reliabilityAggregation: z.literal("MIN_CARRIER_ON_TIME"), position: z.number().int().positive(), score: z.number().min(0).max(1),
  explanation: z.object({ weights: z.object({ cost: z.number(), transit: z.number(), reliability: z.number() }).strict(),
    dimensions: z.object({ cost: z.number(), transit: z.number().nullable(), reliability: z.number().nullable() }).strict() }).strict(),
  missingData: z.array(Text) }).strict();
// Each record has a closed kind and explicit nested domain fields. Auditable transition additions
// remain forward compatible; they are written exclusively by the closed native commands.
const Stored = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
export const WorkflowRecordV2Schema = z.discriminatedUnion("kind", [
  z.object({ ...Metadata, kind: z.literal("nodes"), data: WorkflowInputsV2["nodes.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("corridors"), data: WorkflowInputsV2["corridors.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("route-policies"), data: WorkflowInputsV2["route-policies.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("conditions"), data: WorkflowInputsV2["conditions.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("limits"), data: WorkflowInputsV2["limits.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("scoring-policies"), data: WorkflowInputsV2["scoring-policies.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("metrics"), data: WorkflowInputsV2["metrics.publish"] }).strict(),
  z.object({ ...Metadata, kind: z.literal("consolidations"), data: Stored(WorkflowInputsV2["consolidations.create"].shape) }).strict(),
  z.object({ ...Metadata, kind: z.literal("routes"), data: Stored({ origin: Location, destination: Location,
    copiedFromRouteId: Id.optional(), corridorIds: z.array(Id), policyId: Id, policyVersion: z.number().int().positive(), estimatedDistanceKm: z.number().nullable(),
    estimatedDurationSeconds: z.number().nullable(), geographicSource: z.object({ kind: z.literal("PUBLISHED_CORRIDORS"), references: z.array(Id) }).strict(),
    planner: z.object({ algorithmVersion: z.literal("PUBLISHED_ITINERARY_VALIDATOR_V1"),
      graphVersion: z.string().regex(/^[0-9a-f]{64}$/),
      source: z.object({ kind: z.literal("PUBLISHED_CORRIDORS"), scope: z.literal("SELECTED_ITINERARY_SNAPSHOT"),
        references: z.array(Id) }).strict() }).strict(),
    confidence: Verification, estimatedTolls: z.null(), borderCostEstimate: z.null(), reasons: z.array(Text), legs: z.array(Leg) }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("plans"), data: Stored({ routeId: Id, requestVersion: z.number().int().positive(),
    eligibility: z.enum(["eligible", "unknown", "ineligible"]), evaluatedAt: Instant, exclusionReasons: z.array(Text),
    pendingRequirements: z.array(Text), provenance: Verification, proposedWindow: TimeWindowV2Schema,
    coverage: Verification, availability: Verification, assignments: z.array(Assignment), legAssignments: z.array(LegAssignment).min(1), resourceAssessments: z.array(z.object({
      assignmentId: Id, resourceId: Id, applicableCapacity: EffectiveCapacity, verificationSource: VerificationSource }).strict()) }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("opportunities"), data: Stored({ ...WorkflowInputsV2["opportunities.create"].shape,
    sentAt: Instant, cargoSpecification: z.object({ categoryCode: Text }).passthrough(), origin: CanonicalLocationV2Schema,
    destination: CanonicalLocationV2Schema, assignmentSnapshots: z.array(z.object({ id: Id, serviceId: Id }).passthrough()) }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("offers"), data: Stored(CarrierOfferV2Schema.innerType().shape) }).strict(),
  z.object({ ...Metadata, kind: z.literal("ranking"), data: Stored({ policyId: Id, policyVersion: Text, evaluatedAt: Instant,
    algorithmVersion: z.literal("DISJOINT_COVER_V1"), universe: z.literal("CURRENT_PERSISTED_OFFERS"), completeWithinUniverse: z.literal(true),
    options: z.array(RankingOption), excluded: z.array(z.object({ offerId: Id.optional(), planId: Id.optional(), reason: Text }).strict()) }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("decisions"), data: Stored({ planId: Id, selectedPlanId: Id, selectedOfferIds: z.array(Id).min(1),
    rationale: Text, policyId: Id.nullable(), policyVersion: Text.nullable(), consideredOfferIds: z.array(Id), evidence: z.array(Evidence),
    selectedAt: Instant, selectedBy: Id, status: z.enum(["SELECTED", "REVOKED"]) }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("bookings"), data: Stored({ carrierReference: Text.nullable(), confirmedAt: Instant.nullable(),
    authorizedAt: Instant, authorizedBy: Id, authorizationStatus: z.enum(["AUTHORIZED", "REVOKED"]),
    carrierConfirmationStatus: z.enum(["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"]), capacityEvidence: z.array(HoldRecord), authorizationEvidence: Evidence }) }).strict(),
  HoldRecord,
  z.object({ ...Metadata, kind: z.literal("executions"), data: Stored({ createdBy: Id, bookingId: Id, serviceId: Id,
    consolidationId: Id.nullable().optional(), plannedWindow: TimeWindowV2Schema, actualStartedAt: Instant.nullable(), actualCompletedAt: Instant.nullable(), lastKnownPosition: Location.nullable() }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("incidents"), data: Stored({ ...WorkflowInputsV2["incidents.create"].shape,
    reportedBy: Id, status: z.enum(["OPEN", "RESOLVED"]) }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("incident-updates"), data: Stored({ ...WorkflowInputsV2["incidents.update"].shape, at: Instant, actorId: Id }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("execution-events"), data: Stored({ ...Base, ...Audit,
    consolidationId: Id.nullable().optional(), physicalEventId: Id.nullable().optional(),
    action: z.enum(["executions.start", "executions.complete", "executions.cancel", "executions.position"]), at: Instant, actorId: Id }) }).strict(),
  z.object({ ...Metadata, kind: z.literal("asset-events"), data: Stored({ at: Instant, previous: Text,
    next: WorkflowInputsV2["asset-events.create"].shape.next, reason: Text, evidence: Evidence, actorId: Id }) }).strict(),
]);
export const WorkflowContextV2Schema = z.object({ requestId: Id.nullable(), carrierId: Id.nullable(),
  parentId: Id.nullable(), id: Id.nullable() }).strict();
export type WorkflowContextV2 = z.infer<typeof WorkflowContextV2Schema>;
