import { z } from 'zod';
import { TimeWindowV2Schema } from './freight-request';

const Id = z.string().uuid();
const Instant = z.string().datetime({ offset: true });
const Status = z.enum(['eligible', 'ineligible', 'unknown']);
const Reason = z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/);
export const CarrierRoadInputV2Schema = z.object({
  schemaVersion: z.literal('2.0'), serviceId: Id,
  expectedServiceVersion: z.number().int().positive().optional(),
  originReferenceId: z.string().min(1).max(50), destinationReferenceId: z.string().min(1).max(50),
  pickupWindow: TimeWindowV2Schema, deliveryWindow: TimeWindowV2Schema,
  objective: z.enum(['FASTEST', 'SHORTEST_RETURNED']),
  traffic: z.enum(['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE_OPTIMAL']),
}).strict().refine(x => Date.parse(x.pickupWindow.startsAt) <= Date.parse(x.deliveryWindow.startsAt)
  && Date.parse(x.pickupWindow.endsAt) <= Date.parse(x.deliveryWindow.endsAt)
  && Date.parse(x.deliveryWindow.endsAt) - Date.parse(x.pickupWindow.startsAt) <= 31 * 86400000,
  'Ordered activity windows, at most 31 days, are required.');
export type CarrierRoadInputV2 = z.infer<typeof CarrierRoadInputV2Schema>;

export const CoverageCheckV2Schema = z.object({ status: Status, reasons: z.array(Reason).max(30),
  recordIds: z.array(Id).max(1000) }).strict();
export const CoverageReferenceV2Schema = z.object({
  kind: z.enum(['carriers', 'services', 'areas', 'lanes', 'partners']), id: Id,
  version: z.number().int().positive(), evidence: z.string().max(500).nullable(),
  verifiedAt: Instant.nullable(), validFrom: Instant.nullable(), validUntil: Instant.nullable(),
  source: z.enum(['OWN', 'PARTNER', 'CATALOG']),
}).strict();
export const CarrierCoverageDecisionV2Schema = z.object({
  status: Status, reasons: z.array(Reason).max(100),
  pickup: CoverageCheckV2Schema, delivery: CoverageCheckV2Schema, lane: CoverageCheckV2Schema,
  selectedLaneId: Id.nullable(), borderReviewRequired: z.boolean(),
  references: z.array(CoverageReferenceV2Schema).max(3002),
  policyVersion: z.enum(['carrier-city-coverage/v1','carrier-point-coverage/v1']),
  scope: z.enum(['PUBLISHED_CITY_REFERENCE_COVERAGE_ONLY','PUBLISHED_POINT_COVERAGE_ONLY']),
}).strict();
export type CarrierCoverageDecisionV2 = z.infer<typeof CarrierCoverageDecisionV2Schema>;

const Point = z.object({lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180)}).strict();
const Alternative = z.object({id: z.string().min(1).max(30), providerIndex: z.number().int().nonnegative().max(3),
  distanceMeters: z.number().finite().positive(), durationSeconds: z.number().finite().positive(),
  points: z.array(Point).min(2).max(200000), warnings: z.array(z.string().max(4000)).max(30)}).strict();
export const ProviderRoadCalculationV2Schema = z.union([
  z.object({status: z.literal('estimated'), source: z.literal('GOOGLE_ROUTES_API'), calculatedAt: Instant,
    policyVersion: z.literal('returned-road-alternatives/v1'), scope: z.literal('RETURNED_ALTERNATIVES_ONLY'),
    truckAccess: z.literal('UNVERIFIED'), objective: z.enum(['FASTEST', 'SHORTEST_RETURNED']),
    traffic: z.enum(['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE_OPTIMAL']), selectedId: z.string().min(1).max(30),
    alternatives: z.array(Alternative).min(1).max(4),
    rejected: z.array(z.object({providerIndex: z.number().int().nonnegative().max(3), reason: Reason}).strict()).max(4),
  }).strict().refine(x => x.alternatives.some(r => r.id === x.selectedId)
    && new Set(x.alternatives.map(r => r.id)).size === x.alternatives.length, 'Invalid route selection.'),
  z.object({status: z.enum(['unavailable', 'blocked']), reason: z.enum(['SERVER_KEY_MISSING', 'PROVIDER_DENIED',
    'PROVIDER_UNAVAILABLE', 'NO_ROUTE', 'NO_VALID_ROAD_ROUTE', 'DISCONNECTED_NETWORKS', 'INVALID_ROUTE', 'RATE_LIMITED']),
    alternatives: z.tuple([])}).strict(),
]);
const CityReference = z.object({id: z.string().min(1).max(50), city: z.string().min(1).max(200).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/), lat: Point.shape.lat, lng: Point.shape.lng}).strict();
export const CarrierRoadAssessmentV2Schema = z.object({
  schemaVersion: z.literal('2.0'), carrierId: Id, serviceId: Id, checkedAt: Instant,
  scope: z.literal('COVERAGE_AND_ROAD_ESTIMATE_ONLY'), evidenceScope: z.literal('PUBLISHED_CARRIER_CATALOG'),
  origin: CityReference, destination: CityReference,
  pickupWindow: TimeWindowV2Schema, deliveryWindow: TimeWindowV2Schema,
  catalogFingerprint: z.string().regex(/^[a-f0-9]{64}$/), coverage: CarrierCoverageDecisionV2Schema,
  routing: ProviderRoadCalculationV2Schema.nullable(),
  notCalculatedReason: z.enum(['COVERAGE_NOT_ESTABLISHED', 'SAME_CITY_REFERENCE', 'SAME_STOP', 'DISCONNECTED_NETWORKS']).nullable(),
  requestedDepartureTime: Instant.nullable(),
  timeBasis: z.enum(['PICKUP_WINDOW_START_ESTIMATE_ONLY', 'TRAFFIC_UNAWARE_BASELINE']),
  consistency: z.literal('NON_ATOMIC_READ_RECHECKED_AFTER_PROVIDER'),
  fullEligibilityEvaluated: z.literal(false), availabilityEvaluated: z.literal(false),
  cargoCompatibilityEvaluated: z.literal(false), transitCountriesEvaluated: z.literal(false), capacityReserved: z.literal(false),
  travelAuthorization: z.literal('UNKNOWN'), requiresCommitRevalidation: z.literal(true),
}).strict().superRefine((x,ctx) => {
  if ((x.routing === null) !== (x.notCalculatedReason !== null)
    || x.routing !== null && x.coverage.status !== 'eligible')
    ctx.addIssue({code:z.ZodIssueCode.custom,message:'Coverage must authorize any route calculation.'});
});
