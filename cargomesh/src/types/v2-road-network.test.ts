import assert from "node:assert/strict";
import { test } from "node:test";

import { v2CoverageDecisionSchema, v2ServiceAreaSchema, v2ServiceLaneSchema } from "./v2-road-network";

const id = "e4000000-0000-4000-8000-000000000001";
const otherId = "e4000000-0000-4000-8000-000000000002";
const serviceId = "d0000000-0000-0000-0000-000000000001";
const now = "2026-09-22T12:00:00Z";

test("partner coverage requires a reference", () => {
  const area = {
    id, carrierServiceId: serviceId, areaRole: "DELIVERY", coverage: "INCLUDE",
    granularity: "CITY", countryCode: "CL", regionCode: null, city: "Santiago",
    postalCode: null, fulfilmentSource: "PARTNER", partnerReference: null,
    evidenceReference: "test:evidence", verifiedAt: now, validFrom: now,
    validUntil: null, active: true,
  };
  assert.equal(v2ServiceAreaSchema.safeParse(area).success, false);
  assert.equal(v2ServiceAreaSchema.safeParse({ ...area, partnerReference: "test:partner" }).success, true);
});

test("lane contract only admits ROAD and explicit distinct endpoints", () => {
  const lane = {
    id, carrierServiceId: serviceId, pickupAreaId: id, deliveryAreaId: otherId,
    laneKind: "DIRECT", transportMode: "ROAD", evidenceReference: "test:lane",
    verifiedAt: now, validFrom: now, validUntil: null,
    crossBorderReviewRequired: true, active: true,
  };
  assert.equal(v2ServiceLaneSchema.safeParse(lane).success, true);
  assert.equal(v2ServiceLaneSchema.safeParse({ ...lane, transportMode: "AIR" }).success, false);
  assert.equal(v2ServiceLaneSchema.safeParse({ ...lane, deliveryAreaId: id }).success, false);
});

test("unknown coverage is representable without inventing an area or lane", () => {
  assert.equal(v2CoverageDecisionSchema.safeParse({
    status: "unknown", reasonCodes: ["COVERAGE_UNKNOWN"], carrierServiceId: serviceId,
    pickupAreaId: null, deliveryAreaId: null, laneId: null, evidenceReference: null,
    evaluatedAt: now, pickupWindowStart: now, pickupWindowEnd: "2026-09-23T12:00:00Z",
  }).success, true);
});

test("eligible coverage cannot be claimed without an evidenced lane", () => {
  const decision = {
    status: "eligible", reasonCodes: ["COVERAGE_CONFIRMED"], carrierServiceId: serviceId,
    pickupAreaId: null, deliveryAreaId: null, laneId: null, evidenceReference: null,
    evaluatedAt: now, pickupWindowStart: now, pickupWindowEnd: "2026-09-23T12:00:00Z",
  };
  assert.equal(v2CoverageDecisionSchema.safeParse(decision).success, false);
  assert.equal(v2CoverageDecisionSchema.safeParse({
    ...decision, pickupAreaId: id, deliveryAreaId: otherId,
    laneId: "e5000000-0000-4000-8000-000000000001", evidenceReference: "test:lane",
  }).success, true);
  assert.equal(v2CoverageDecisionSchema.safeParse({
    ...decision, pickupAreaId: id, deliveryAreaId: otherId,
    laneId: "e5000000-0000-4000-8000-000000000001", evidenceReference: "test:lane",
    reasonCodes: ["COVERAGE_CONFIRMED", "AVAILABILITY_UNKNOWN"],
  }).success, false);
});
