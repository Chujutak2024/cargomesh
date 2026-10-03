import { z } from "zod";
import { TimeWindowV2Schema } from "./freight-request";

export const EligibilityStatusV2Schema = z.enum(["eligible", "ineligible", "unknown"]);
export const ProvenanceStatusV2Schema = z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]);

export const RoadRoutePreviewV2Schema = z.object({
  corridorCode: z.string().nullable(),
  distanceKm: z.number().nonnegative().nullable(),
  estimatedTransitHours: z.number().nonnegative().nullable(),
  geometrySource: z.string().min(1),
  provenanceStatus: ProvenanceStatusV2Schema,
  legs: z.array(z.object({
    sequence: z.number().int().positive(),
    mode: z.literal("ROAD"),
    originLabel: z.string().min(1),
    destinationLabel: z.string().min(1),
    waypoints: z.array(z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().optional(),
    }).strict()),
    conditions: z.array(z.object({
      code: z.string().min(1),
      severity: z.string().min(1),
      description: z.string().min(1),
      provenanceStatus: ProvenanceStatusV2Schema,
    }).strict()),
  }).strict()),
}).strict().superRefine((route, context) => {
  if (route.provenanceStatus === "UNKNOWN" && route.legs.some((leg) => leg.waypoints.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["legs"], message: "UNKNOWN geometry cannot contain a route line" });
  }
});

const CheckStatus = EligibilityStatusV2Schema;
const ReasonCode = z.string().min(1);

export const RoadCandidateV2Schema = z.object({
  candidateId: z.string().min(1),
  status: EligibilityStatusV2Schema,
  carrier: z.object({
    id: z.string().uuid(),
    code: z.string().min(1),
    commercialName: z.string().min(1),
  }).strict(),
  service: z.object({
    id: z.string().uuid(),
    code: z.string().min(1),
    mode: z.literal("ROAD"),
    serviceClass: z.string().min(1),
    responseChannels: z.array(z.enum(["MANUAL", "API", "MCP"])),
  }).strict(),
  checks: z.object({
    coverage: z.object({
      status: CheckStatus,
      pickupAreaCode: z.string().nullable(),
      deliveryAreaCode: z.string().nullable(),
      exclusionTriggered: z.boolean(),
      reasonCode: ReasonCode,
    }).strict(),
    lane: z.object({
      status: CheckStatus,
      laneId: z.string().uuid().nullable(),
      kind: z.enum(["DIRECT", "WITHIN_AREA"]).nullable(),
      borderReviewRequired: z.boolean(),
      reasonCode: ReasonCode,
    }).strict(),
    cargoAndEquipment: z.object({
      status: CheckStatus,
      matchedCategory: z.string().nullable(),
      requiredEquipment: z.string().nullable(),
      indivisibleUnitsFit: z.boolean().nullable(),
      reasonCode: ReasonCode,
    }).strict(),
    capacityWindow: z.object({
      status: CheckStatus,
      sourceType: z.enum(["TRANSPORT_ASSET", "CAPACITY_POOL"]).nullable(),
      sourceId: z.string().uuid().nullable(),
      calendarId: z.string().uuid().nullable(),
      availableWeightKg: z.number().nonnegative().nullable(),
      availableVolumeM3: z.number().nonnegative().nullable(),
      windowChecked: TimeWindowV2Schema,
      provenance: z.object({
        dataSource: z.string().min(1),
        provenanceStatus: ProvenanceStatusV2Schema,
        observedAt: z.string().datetime({ offset: true }).nullable(),
        validUntil: z.string().datetime({ offset: true }).nullable(),
      }).strict(),
      reasonCode: ReasonCode,
    }).strict(),
  }).strict(),
  reasons: z.array(z.string().min(1)),
  routePreview: RoadRoutePreviewV2Schema.nullable(),
}).strict();

export const RoadServiceabilityEvaluationV2ResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  data: z.object({
    freightRequestId: z.string().uuid(),
    evaluatedDraftVersion: z.number().int().positive(),
    evaluatedAt: z.string().datetime({ offset: true }),
    overallStatus: EligibilityStatusV2Schema,
    summaryCounts: z.object({
      totalEvaluated: z.number().int().nonnegative(),
      eligibleCount: z.number().int().nonnegative(),
      unknownCount: z.number().int().nonnegative(),
      ineligibleCount: z.number().int().nonnegative(),
    }).strict(),
    commercialNotice: z.literal("EVALUATION_ONLY_NO_OFFER_OR_BOOKING"),
    candidates: z.array(RoadCandidateV2Schema),
  }).strict().superRefine((evaluation, context) => {
    const counts = evaluation.summaryCounts;
    if (counts.totalEvaluated !== evaluation.candidates.length
      || counts.eligibleCount !== evaluation.candidates.filter((candidate) => candidate.status === "eligible").length
      || counts.unknownCount !== evaluation.candidates.filter((candidate) => candidate.status === "unknown").length
      || counts.ineligibleCount !== evaluation.candidates.filter((candidate) => candidate.status === "ineligible").length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["summaryCounts"], message: "candidate counts do not match" });
    }
    const expected = evaluation.candidates.some((candidate) => candidate.status === "eligible")
      ? "eligible" : evaluation.candidates.some((candidate) => candidate.status === "unknown") ? "unknown" : "ineligible";
    if (evaluation.overallStatus !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["overallStatus"], message: "overall status does not match candidates" });
    }
  }),
}).strict();

export type RoadServiceabilityEvaluationV2Response = z.infer<typeof RoadServiceabilityEvaluationV2ResponseSchema>;
export type RoadCandidateV2 = z.infer<typeof RoadCandidateV2Schema>;
export type RoadRoutePreviewV2 = z.infer<typeof RoadRoutePreviewV2Schema>;
