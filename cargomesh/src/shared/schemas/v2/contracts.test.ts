import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateFreightRequestV2InputSchema } from "./freight-request";
import { RoadRoutePreviewV2Schema, RoadServiceabilityEvaluationV2ResponseSchema } from "./serviceability";

const facilityId = "11111111-2222-4333-8444-555555555555";
const request = {
  schemaVersion: "2.0",
  origin: { facilityId },
  destination: { facilityId: "66666666-7777-4888-8999-000000000000" },
  pickupWindow: { startsAt: "2026-10-05T08:00:00Z", endsAt: "2026-10-05T18:00:00Z" },
  deliveryWindow: { startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T20:00:00Z" },
  acceptedModes: ["ROAD"],
  requiredEquipment: "REEFER_TRUCK",
  cargoSpecification: {
    categoryCode: "PHARMA", description: "Vacunas", packaging: "PALLET",
    totalWeightKg: 4800, totalVolumeM3: 19.2, divisible: false,
    requirements: ["TEMP_CONTROLLED"], temperatureRange: { minCelsius: 2, maxCelsius: 8 },
    units: [{
      packageType: "PALLET", quantity: 8, weightPerUnitKg: 600, volumePerUnitM3: 2.4,
      dimensionsCm: { length: 120, width: 100, height: 200 }, indivisible: true, stackable: false,
    }],
  },
  contacts: {
    pickup: { name: "Elena", phoneE164: "+51987654321" },
    recipient: { name: "Carlos", phoneE164: "+51912345678" },
  },
  budget: { amount: 3200, currency: "USD" },
};

describe("HAC-12 V2 DTOs", () => {
  it("accepts a minimal facility-based ROAD draft without trusting browser coordinates", () => {
    const result = CreateFreightRequestV2InputSchema.parse(request);
    assert.deepEqual(result.origin, { facilityId });
  });

  it("does not accept PEN, another mode or contradictory coordinate shape", () => {
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, budget: { amount: 100, currency: "PEN" } }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, acceptedModes: ["AIR"] }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, origin: { facilityId, lat: -12 } }).success, false);
  });

  it("rejects incomplete manual locations and inverted windows", () => {
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, origin: { city: "Lima" } }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({
      ...request, pickupWindow: { startsAt: "2026-10-05T18:00:00Z", endsAt: "2026-10-05T08:00:00Z" },
    }).success, false);
  });

  it("accepts zero candidates as a successful ineligible evaluation", () => {
    const result = RoadServiceabilityEvaluationV2ResponseSchema.parse({
      schemaVersion: "2.0",
      data: {
        freightRequestId: facilityId, evaluatedDraftVersion: 1,
        evaluatedAt: "2026-10-05T08:00:00Z", overallStatus: "ineligible",
        summaryCounts: { totalEvaluated: 0, eligibleCount: 0, unknownCount: 0, ineligibleCount: 0 },
        commercialNotice: "EVALUATION_ONLY_NO_OFFER_OR_BOOKING", candidates: [],
      },
    });
    assert.deepEqual(result.data.candidates, []);
  });

  it("does not accept invented geometry when provenance is UNKNOWN", () => {
    const result = RoadRoutePreviewV2Schema.safeParse({
      corridorCode: null, distanceKm: null, estimatedTransitHours: null,
      geometrySource: "NONE_UNVERIFIED", provenanceStatus: "UNKNOWN",
      legs: [{
        sequence: 1, mode: "ROAD", originLabel: "Lima", destinationLabel: "Arequipa",
        waypoints: [{ lat: -12, lng: -77 }], conditions: [],
      }],
    });
    assert.equal(result.success, false);
  });
});
