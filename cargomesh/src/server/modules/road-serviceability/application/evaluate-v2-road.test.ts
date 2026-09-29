import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { V2DraftRepository } from "@/server/modules/freight-requests/application/draft-service";
import type { FreightRequestV2Response } from "@/shared/schemas/v2/freight-request";
import { evaluateV2RoadByRequestId } from "./evaluate-v2-road";
import type { RoadService } from "../domain/evaluate-road";

const actor = {
  memberId: "b0000000-0000-4000-8000-000000000001",
  organizationId: "a0000000-0000-4000-8000-000000000001",
};
const requestId = "e0000000-0000-4000-8000-000000000001";
const serviceId = "d0000000-0000-4000-8000-000000000001";
const carrierId = "c0000000-0000-4000-8000-000000000001";
const assetId = "f0000000-0000-4000-8000-000000000001";
const laneId = "a1000000-0000-4000-8000-000000000001";
const calendarId = "a2000000-0000-4000-8000-000000000001";

function draft(originCity = "Lima", requirements: string[] = [],
  temperatureRange?: { minCelsius: number; maxCelsius: number },
  destinationCountry = "PE"): V2DraftRepository {
  const data: FreightRequestV2Response["data"] = {
    id: requestId, referenceCode: "V2-TEST", organizationId: actor.organizationId,
    status: "DRAFT", draftVersion: 1,
    origin: { facilityId: null, label: originCity, countryCode: "PE", region: null,
      city: originCity, lat: null, lng: null },
    destination: { facilityId: null, label: "Arequipa", countryCode: destinationCountry, region: null,
      city: "Arequipa", lat: null, lng: null },
    pickupWindow: { startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T12:00:00Z" },
    deliveryWindow: { startsAt: "2026-10-02T10:00:00Z", endsAt: "2026-10-02T12:00:00Z" },
    acceptedModes: ["ROAD"], requiredEquipment: "BOX_TRUCK",
    cargoSpecification: {
      categoryCode: "GENERAL", description: "Prueba sintética", packaging: "PALLET",
      totalWeightKg: 1000, totalVolumeM3: 2, divisible: true, requirements,
      temperatureRange: temperatureRange ?? null,
      units: [{ packageType: "PALLET", quantity: 1, weightPerUnitKg: 1000,
        volumePerUnitM3: 2, dimensionsCm: { length: 100, width: 100, height: 200 },
        indivisible: false, stackable: true }],
    },
    contacts: { pickup: { name: "QA A", phoneE164: "+51911111111" },
      recipient: { name: "QA B", phoneE164: "+51922222222" } },
    budget: { amount: 500, currency: "USD" },
    createdAt: "2026-09-27T00:00:00Z", updatedAt: "2026-09-27T00:00:00Z",
  };
  return {
    findById: async () => ({ data, payloadHash: "a".repeat(64) }),
    findCreation: async () => null,
    insertAtomically: async () => { throw new Error("read-only test attempted a write"); },
  };
}

function service(): RoadService {
  return {
    id: serviceId, carrierId, carrierCode: "QA-ROAD", carrierName: "QA Carrier",
    serviceCode: "QA-ROAD-A-B", serviceClass: "FTL", responseChannels: [],
    mode: "ROAD", active: true, supportedCargoCategoryCodes: ["GENERAL"],
    areas: [
      { id: "pickup-a", role: "PICKUP", coverage: "INCLUDE", granularity: "CITY",
        location: { countryCode: "PE", city: "Lima" }, active: true,
        validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z" },
      { id: "delivery-b", role: "DELIVERY", coverage: "INCLUDE", granularity: "CITY",
        location: { countryCode: "PE", city: "Arequipa" }, active: true,
        validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z" },
    ],
    lanes: [{ id: laneId, kind: "DIRECT", pickupAreaId: "pickup-a",
      deliveryAreaId: "delivery-b", active: true,
      plannedTransitMinutes: 900, transitProvenanceStatus: "SIMULATED",
      validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z" }],
    capacities: [{
      id: assetId, sourceType: "TRANSPORT_ASSET", calendarId,
      role: "CARRIER", equipmentCode: "BOX_TRUCK", cargoCategoryCodes: ["GENERAL"],
      maxWeightKg: 5000, maxVolumeM3: 10, dataSource: "QA_SCENARIO", observedAt: "2026-09-27T00:00:00Z",
      calendar: { validUntil: "2026-12-01T00:00:00Z", provenanceStatus: "SIMULATED",
        readyPickupAreaId: "pickup-a",
        complete: true, availableWindows: [{ startsAt: "2026-10-01T00:00:00Z",
          endsAt: "2026-10-03T00:00:00Z" }], reservations: [], maintenance: [], repositioning: [] },
    }],
  };
}

describe("HAC-12 ROAD application response", () => {
  it("maps a synthetic eligible service to the V2 DTO without inventing geometry or price", async () => {
    const result = await evaluateV2RoadByRequestId(requestId, 1, actor, draft(),
      { listRoadServices: async () => [service()] });
    assert.equal(result.data.overallStatus, "eligible");
    assert.equal(result.data.candidates[0]?.checks.lane.laneId, laneId);
    assert.equal(result.data.candidates[0]?.checks.capacityWindow.provenance.provenanceStatus, "SIMULATED");
    assert.equal(result.data.candidates[0]?.routePreview, null);
    assert.equal("price" in result.data.candidates[0]!, false);
  });

  it("degrades missing calendar and unknown provenance instead of claiming availability", async () => {
    const missing = service();
    missing.capacities[0]!.calendar = null;
    assert.equal((await evaluateV2RoadByRequestId(requestId, undefined, actor, draft(),
      { listRoadServices: async () => [missing] })).data.overallStatus, "unknown");
    const unverified = service();
    unverified.capacities[0]!.calendar!.provenanceStatus = "UNKNOWN";
    assert.equal((await evaluateV2RoadByRequestId(requestId, undefined, actor, draft(),
      { listRoadServices: async () => [unverified] })).data.overallStatus, "unknown");
  });

  it("does not infer time or a missing service class", async () => {
    const noTime = service();
    noTime.lanes[0]!.plannedTransitMinutes = null;
    const unknown = await evaluateV2RoadByRequestId(requestId, 1, actor, draft(),
      { listRoadServices: async () => [noTime] });
    assert.equal(unknown.data.candidates[0]?.status, "unknown");
    assert.ok(unknown.data.candidates[0]?.reasons.includes("TEMPORAL_FEASIBILITY_UNKNOWN"));
    noTime.serviceClass = undefined;
    await assert.rejects(() => evaluateV2RoadByRequestId(requestId, 1, actor, draft(),
      { listRoadServices: async () => [noTime] }), { message: "V2_ROAD_SERVICE_CLASS_MISSING" });
  });

  it("marks a cross-border lane for review even when its stored flag is false", async () => {
    const international = service();
    international.areas[1]!.location.countryCode = "CL";
    international.lanes[0]!.borderReviewRequired = false;
    const result = await evaluateV2RoadByRequestId(requestId, 1, actor,
      draft("Lima", [], undefined, "CL"), { listRoadServices: async () => [international] });
    const candidate = result.data.candidates[0]!;
    assert.equal(candidate.status, "unknown");
    assert.equal(candidate.checks.lane.status, "unknown");
    assert.equal(candidate.checks.lane.borderReviewRequired, true);
    assert.equal(candidate.checks.lane.reasonCode, "BORDER_DOCS_UNKNOWN");
    international.lanes[0]!.crossBorderProhibited = true;
    const prohibited = await evaluateV2RoadByRequestId(requestId, 1, actor,
      draft("Lima", [], undefined, "CL"), { listRoadServices: async () => [international] });
    assert.equal(prohibited.data.candidates[0]?.status, "ineligible");
    assert.equal(prohibited.data.candidates[0]?.checks.lane.reasonCode,
      "BORDER_CROSSING_PROHIBITED");
  });

  it("keeps review-only requirements unknown even if a resource advertises their code", async () => {
    const advertised = service();
    advertised.capacities[0]!.cargoCapabilities = [{
      categoryCode: "GENERAL", certifications: ["FRAGILE", "HAZARDOUS", "TEMP_CONTROLLED"],
      temperatureMinC: 2, temperatureMaxC: 8,
    }];
    for (const requirement of ["FRAGILE", "HAZARDOUS", "TEMP_CONTROLLED"]) {
      const result = await evaluateV2RoadByRequestId(requestId, 1, actor,
        draft("Lima", [requirement]), { listRoadServices: async () => [advertised] });
      assert.equal(result.data.overallStatus, "unknown", requirement);
      assert.equal(result.data.candidates[0]?.checks.cargoAndEquipment.reasonCode,
        "REQUIREMENTS_UNVERIFIED");
    }
  });

  it("checks temperature and seal against the same carrying resource", async () => {
    const evidenced = service();
    evidenced.capacities[0]!.cargoCapabilities = [{
      categoryCode: "GENERAL", certifications: ["TEMP_CONTROLLED", "SECURITY_SEAL"],
      temperatureMinC: 2, temperatureMaxC: 8,
    }];
    const result = await evaluateV2RoadByRequestId(requestId, 1, actor,
      draft("Lima", ["TEMP_CONTROLLED", "SECURITY_SEAL"],
        { minCelsius: 2, maxCelsius: 8 }),
      { listRoadServices: async () => [evidenced] });
    assert.equal(result.data.overallStatus, "eligible");
  });

  it("returns zero candidates for uncovered Piura and rejects stale drafts", async () => {
    const zero = await evaluateV2RoadByRequestId(requestId, undefined, actor, draft("Piura"),
      { listRoadServices: async () => [service()] });
    assert.equal(zero.data.candidates.length, 0);
    assert.equal(zero.data.overallStatus, "ineligible");
    await assert.rejects(() => evaluateV2RoadByRequestId(requestId, 2, actor, draft(),
      { listRoadServices: async () => [service()] }), { code: "STALE_DRAFT", httpStatus: 409 });
  });
});
