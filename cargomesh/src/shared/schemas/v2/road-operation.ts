import { z } from 'zod';
import { CarrierRoadInputV2Schema, CarrierRoadAssessmentV2Schema } from './carrier-road-routing';
import { CarrierOperationalAssessmentInputV2Schema, CarrierOperationalAssessmentV2Schema } from './operational-assessment';
import { EquipmentCodeV2Schema, TimeWindowV2Schema } from './freight-request';

const Id = z.string().uuid();
const Seconds = z.number().int().nonnegative().max(7 * 86400).nullable();
const Temperature = z.object({ minCelsius: z.number().finite(), maxCelsius: z.number().finite() })
  .strict().refine(v => v.minCelsius <= v.maxCelsius, 'Invalid temperature range.');
const Dimensions = z.object({ length: z.number().finite().positive(), width: z.number().finite().positive(),
  height: z.number().finite().positive() }).strict();

/** Operator planning inputs are estimates, never an authoritative Client request or legal policy. */
export const RoadOperationInputV2Schema = z.object({
  schemaVersion: z.literal('2.0'), road: CarrierRoadInputV2Schema,
  assetId: Id, driverId: Id,
  expectedAssetVersion: z.number().int().positive().optional(),
  expectedDriverVersion: z.number().int().positive().optional(),
  cargo: z.object({ categoryId: Id, weightKg: z.number().finite().positive(),
    volumeM3: z.number().finite().positive(), requiredEquipment: EquipmentCodeV2Schema.nullable(),
    largestPieceCm: Dimensions.nullable(), temperatureRange: Temperature.nullable(),
    certifications: z.array(z.string().trim().min(1).max(100)).max(30),
    hazardous: z.boolean(), fragile: z.boolean(), oversized: z.boolean(),
  }).strict(),
  planning: z.object({ reference: z.string().trim().min(1).max(500),
    provenanceStatus: z.enum(['ESTIMATED', 'SIMULATED']),
    loadingSeconds: Seconds, unloadingSeconds: Seconds, restSeconds: Seconds,
    borderSeconds: Seconds, repositionBeforeSeconds: Seconds, repositionAfterSeconds: Seconds,
  }).strict(),
  depots: CarrierOperationalAssessmentInputV2Schema.innerType().shape.depots.max(6),
}).strict();
export type RoadOperationInputV2 = z.infer<typeof RoadOperationInputV2Schema>;

export const OperationDecisionV2Schema = z.object({ status: z.enum(['eligible', 'ineligible', 'unknown']),
  reasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/)).max(100) }).strict();
export type OperationDecisionV2 = z.infer<typeof OperationDecisionV2Schema>;
export const OperationTimelineV2Schema = z.object({
  basis: z.enum(['OPERATOR_ESTIMATE', 'LOWER_BOUND_WITH_MISSING_DURATIONS']),
  workWindow: TimeWindowV2Schema, loadingWindow: TimeWindowV2Schema.nullable(),
  departureAt: z.string().datetime({ offset: true }), arrivalAt: z.string().datetime({ offset: true }),
  unloadingStartsAt: z.string().datetime({ offset: true }), unloadingEndsAt: z.string().datetime({ offset: true }),
  drivingSeconds: z.number().finite().positive(), waitingSeconds: z.number().finite().nonnegative(),
  totalOccupiedSeconds: z.number().finite().positive(), decision: OperationDecisionV2Schema,
}).strict();
export type OperationTimelineV2 = z.infer<typeof OperationTimelineV2Schema>;
export const RoadOperationAssessmentV2Schema = z.object({
  schemaVersion: z.literal('2.0'), carrierId: Id, serviceId: Id, assetId: Id, driverId: Id,
  scope: z.literal('SINGLE_ROAD_ASSET_DRIVER_ESTIMATE'), policyVersion: z.literal('road-operation/v1'),
  startedAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }),
  status: z.enum(['ineligible', 'unknown']), reasons: z.array(z.string()).max(100),
  compatibility: OperationDecisionV2Schema,
  road: CarrierRoadAssessmentV2Schema.nullable(),
  alternatives: z.array(z.object({ id: z.string(), distanceMeters: z.number().positive(),
    timeline: OperationTimelineV2Schema, resources: CarrierOperationalAssessmentV2Schema.nullable(),
    modeledDecision: OperationDecisionV2Schema,
  }).strict()).max(4),
  selectedForReviewId: z.string().nullable(),
  selectionScope: z.literal('NON_BLOCKED_MODELED_CHECKS_ONLY'),
  planning: RoadOperationInputV2Schema.shape.planning,
  references: z.array(z.object({ kind: z.string(), id: Id, version: z.number().int().positive() }).strict()).max(2003),
  consistency: z.literal('NON_ATOMIC_READ_RESOURCES_RECHECKED'),
  physicalReadiness: z.literal('UNKNOWN'), legalDrivingPolicy: z.literal('UNKNOWN'),
  truckAccess: z.literal('UNVERIFIED'), travelAuthorization: z.literal('UNKNOWN'),
  clientRequestValidated: z.literal(false), fullEligibilityEvaluated: z.literal(false),
  capacityReserved: z.literal(false), requiresCommitRevalidation: z.literal(true),
}).strict();
