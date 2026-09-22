import { z } from "zod";

const uuid = z.string().uuid();
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const timestamp = z.string().datetime({ offset: true });

export const v2FacilitySchema = z.object({
  id: uuid,
  organizationId: uuid,
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  facilityType: z.enum(["SHIPPER_SITE", "WAREHOUSE", "DISTRIBUTION_CENTER", "OTHER"]),
  countryCode,
  regionCode: z.string().nullable(),
  city: z.string().trim().min(1),
  postalCode: z.string().nullable(),
  addressLine: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  active: z.boolean(),
}).refine((value) => (value.latitude === null) === (value.longitude === null), {
  message: "Coordinates must be supplied together",
});

export const v2CarrierDepotSchema = z.object({
  id: uuid,
  carrierId: uuid,
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  countryCode,
  regionCode: z.string().nullable(),
  city: z.string().trim().min(1),
  active: z.boolean(),
});

export const v2ServiceAreaSchema = z.object({
  id: uuid,
  carrierServiceId: uuid,
  areaRole: z.enum(["PICKUP", "DELIVERY"]),
  coverage: z.enum(["INCLUDE", "EXCLUDE"]),
  granularity: z.enum(["COUNTRY", "REGION", "CITY", "POSTAL_CODE"]),
  countryCode,
  regionCode: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  fulfilmentSource: z.enum(["OWN", "PARTNER"]),
  partnerReference: z.string().nullable(),
  evidenceReference: z.string().trim().min(1),
  verifiedAt: timestamp,
  validFrom: timestamp,
  validUntil: timestamp.nullable(),
  active: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.fulfilmentSource === "PARTNER" && !value.partnerReference?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Partner evidence requires a reference" });
  }
  if (value.fulfilmentSource === "OWN" && value.partnerReference !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Own service cannot claim a partner" });
  }
  if (value.validUntil && Date.parse(value.validUntil) <= Date.parse(value.validFrom)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Validity end must follow start" });
  }
});

export const v2ServiceLaneSchema = z.object({
  id: uuid,
  carrierServiceId: uuid,
  pickupAreaId: uuid,
  deliveryAreaId: uuid,
  laneKind: z.enum(["DIRECT", "WITHIN_AREA"]),
  transportMode: z.literal("ROAD"),
  evidenceReference: z.string().trim().min(1),
  verifiedAt: timestamp,
  validFrom: timestamp,
  validUntil: timestamp.nullable(),
  crossBorderReviewRequired: z.boolean(),
  active: z.boolean(),
}).refine((value) => value.pickupAreaId !== value.deliveryAreaId, {
  message: "A lane needs explicit pickup and delivery areas",
});

export const v2CoverageDecisionSchema = z.object({
  status: z.enum(["eligible", "ineligible", "unknown"]),
  reasonCodes: z.array(z.enum([
    "COVERAGE_CONFIRMED", "COVERAGE_EXCLUDED", "COVERAGE_UNKNOWN",
    "LANE_MISSING", "LANE_EXPIRED", "SERVICE_INACTIVE",
    "CAPACITY_UNKNOWN", "AVAILABILITY_UNKNOWN", "CARGO_INCOMPATIBLE",
  ])).min(1),
  carrierServiceId: uuid,
  pickupAreaId: uuid.nullable(),
  deliveryAreaId: uuid.nullable(),
  laneId: uuid.nullable(),
  evidenceReference: z.string().nullable(),
  evaluatedAt: timestamp,
  pickupWindowStart: timestamp,
  pickupWindowEnd: timestamp,
});

export type V2Facility = z.infer<typeof v2FacilitySchema>;
export type V2CarrierDepot = z.infer<typeof v2CarrierDepotSchema>;
export type V2ServiceArea = z.infer<typeof v2ServiceAreaSchema>;
export type V2ServiceLane = z.infer<typeof v2ServiceLaneSchema>;
export type V2CoverageDecision = z.infer<typeof v2CoverageDecisionSchema>;
