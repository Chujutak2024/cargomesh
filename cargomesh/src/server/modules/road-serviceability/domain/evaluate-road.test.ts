import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoad, type RoadRequest, type RoadService } from "./evaluate-road";

const request: RoadRequest = {
  origin: { countryCode: "PE", regionCode: "LIM", city: "Lima" },
  destination: { countryCode: "PE", regionCode: "ARE", city: "Arequipa" },
  operationWindow: { startsAt: "2026-09-28T10:00:00Z", endsAt: "2026-09-29T10:00:00Z" },
  cargoCategoryCode: "PHARMA",
  totalWeightKg: 4800,
  totalVolumeM3: 19.2,
  requiredEquipmentCode: "REEFER_TRUCK",
  unverifiedRequirements: [],
};

function service(): RoadService {
  return {
    id: "road-service-1",
    carrierId: "carrier-1",
    mode: "ROAD",
    active: true,
    supportedCargoCategoryCodes: ["PHARMA"],
    areas: [
      {
        id: "lima-pickup", role: "PICKUP", coverage: "INCLUDE", granularity: "CITY",
        location: { countryCode: "PE", regionCode: "LIM", city: "Lima" }, active: true,
        validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
      },
      {
        id: "arequipa-delivery", role: "DELIVERY", coverage: "INCLUDE", granularity: "CITY",
        location: { countryCode: "PE", regionCode: "ARE", city: "Arequipa" }, active: true,
        validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
      },
    ],
    lanes: [{
      id: "lima-arequipa", pickupAreaId: "lima-pickup", deliveryAreaId: "arequipa-delivery",
      active: true, validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
    }],
    capacities: [{
      id: "asset-1", role: "CARRIER", equipmentCode: "REEFER_TRUCK",
      cargoCategoryCodes: ["PHARMA"], maxWeightKg: 8000, maxVolumeM3: 30,
      calendar: {
        validUntil: "2026-12-31T00:00:00Z", complete: true,
        availableWindows: [{ startsAt: "2026-09-28T00:00:00Z", endsAt: "2026-09-30T00:00:00Z" }],
        reservations: [], maintenance: [], repositioning: [],
      },
    }],
  };
}

describe("pure ROAD eligibility", () => {
  it("accepts a verified directed ROAD service with carrying capacity", () => {
    const result = evaluateRoad(request, [service()]);
    assert.equal(result.overallStatus, "eligible");
    assert.equal(result.totalEvaluated, 1);
    assert.deepEqual(result.candidates[0]?.reasons, []);
    assert.equal(result.candidates[0]?.routePreview, null);
  });

  it("gives an explicit exclusion precedence over an inclusion", () => {
    const item = service();
    item.areas.push({
      ...item.areas[0]!, id: "lima-exclusion", coverage: "EXCLUDE",
    });
    const result = evaluateRoad(request, [item]);
    assert.equal(result.candidates[0]?.status, "ineligible");
    assert.ok(result.candidates[0]?.reasons.includes("PICKUP_EXCLUDED"));
  });

  it("does not reverse a directed lane", () => {
    const item = service();
    item.lanes[0] = { ...item.lanes[0]!, pickupAreaId: "arequipa-delivery", deliveryAreaId: "lima-pickup" };
    const result = evaluateRoad(request, [item]);
    assert.equal(result.candidates[0]?.status, "ineligible");
    assert.ok(result.candidates[0]?.reasons.includes("NO_DIRECTED_LANE"));
  });

  it("keeps missing and stale calendars unknown", () => {
    const missing = service();
    missing.capacities[0]!.calendar = null;
    assert.equal(evaluateRoad(request, [missing]).candidates[0]?.status, "unknown");
    const stale = service();
    stale.capacities[0]!.calendar!.validUntil = "2026-09-28T00:00:00Z";
    assert.ok(evaluateRoad(request, [stale]).candidates[0]?.reasons.includes("CALENDAR_STALE"));
    const incomplete = service();
    incomplete.capacities[0]!.calendar!.complete = false;
    assert.equal(evaluateRoad(request, [incomplete]).candidates[0]?.status, "unknown");
  });

  it("lets a proven over-capacity reject even if a different capacity limit is unknown", () => {
    const item = service();
    item.capacities[0]!.maxWeightKg = 1000;
    item.capacities[0]!.maxVolumeM3 = null;
    const result = evaluateRoad(request, [item]);
    assert.equal(result.candidates[0]?.status, "ineligible");
    assert.ok(result.candidates[0]?.reasons.includes("OVER_CAPACITY"));
  });

  it("blocks overlapping reservation, maintenance and repositioning", () => {
    for (const kind of ["reservations", "maintenance", "repositioning"] as const) {
      const item = service();
      item.capacities[0]!.calendar![kind].push({
        startsAt: "2026-09-29T09:00:00Z", endsAt: "2026-09-29T11:00:00Z",
      });
      const result = evaluateRoad(request, [item]);
      assert.equal(result.candidates[0]?.status, "ineligible", kind);
      assert.ok(result.candidates[0]?.reasons.includes("CAPACITY_WINDOW_BLOCKED"), kind);
    }
  });

  it("never treats an escort as carrying capacity", () => {
    const item = service();
    item.capacities[0]!.role = "ESCORT";
    assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "unknown");
  });

  it("does not confirm unverified hard requirements", () => {
    const result = evaluateRoad({ ...request, unverifiedRequirements: ["temperature"] }, [service()]);
    assert.equal(result.candidates[0]?.status, "unknown");
    assert.ok(result.candidates[0]?.reasons.includes("REQUIREMENTS_UNVERIFIED"));
  });

  it("verifies temperature and certifications on the same carrying resource", () => {
    const item = service();
    const hardRequest: RoadRequest = {
      ...request, requiredCertifications: ["TEMP_CONTROLLED", "SECURITY_SEAL"],
      temperatureRange: { minCelsius: 2, maxCelsius: 8 },
    };
    item.capacities[0]!.cargoCapabilities = [{
      categoryCode: "PHARMA", certifications: ["TEMP_CONTROLLED", "SECURITY_SEAL"],
      temperatureMinC: 2, temperatureMaxC: 8,
    }];
    assert.equal(evaluateRoad(hardRequest, [item]).candidates[0]?.status, "eligible");
    item.capacities[0]!.cargoCapabilities![0]!.certifications = ["TEMP_CONTROLLED"];
    assert.ok(evaluateRoad(hardRequest, [item]).candidates[0]?.reasons.includes("CERTIFICATION_UNVERIFIED"));
    item.capacities[0]!.cargoCapabilities![0]!.certifications = ["TEMP_CONTROLLED", "SECURITY_SEAL"];
    item.capacities[0]!.cargoCapabilities![0]!.temperatureMaxC = 6;
    assert.ok(evaluateRoad(hardRequest, [item]).candidates[0]?.reasons.includes("TEMPERATURE_RANGE_UNSUPPORTED"));
    assert.equal(evaluateRoad(hardRequest, [item]).candidates[0]?.status, "ineligible");
  });

  it("does not combine a certified asset with another asset's free calendar", () => {
    const item = service();
    const hardRequest: RoadRequest = { ...request, requiredCertifications: ["SECURITY_SEAL"] };
    item.capacities[0]!.cargoCapabilities = [{ categoryCode: "PHARMA",
      certifications: ["SECURITY_SEAL"], temperatureMinC: null, temperatureMaxC: null }];
    item.capacities[0]!.calendar = null;
    const freeButUncertified = { ...item.capacities[0]!, id: "asset-2", calendar: service().capacities[0]!.calendar,
      cargoCapabilities: null };
    item.capacities.push(freeButUncertified);
    const candidate = evaluateRoad(hardRequest, [item]).candidates[0];
    assert.equal(candidate?.status, "unknown");
    assert.equal(candidate?.evidence.capacity.sourceId, "asset-1");
  });

  it("does not confirm missing equipment evidence or coverage expiring mid-trip", () => {
    const equipmentUnknown = service();
    equipmentUnknown.capacities[0]!.equipmentCode = null;
    assert.equal(evaluateRoad(request, [equipmentUnknown]).candidates[0]?.status, "unknown");
    const expiringArea = service();
    expiringArea.areas[0]!.validUntil = "2026-09-28T12:00:00Z";
    assert.ok(evaluateRoad(request, [expiringArea]).candidates[0]?.reasons.includes("PICKUP_COVERAGE_EXPIRES"));
    const expiringLane = service();
    expiringLane.lanes[0]!.validUntil = "2026-09-28T12:00:00Z";
    assert.ok(evaluateRoad(request, [expiringLane]).candidates[0]?.reasons.includes("LANE_EXPIRES"));
  });

  it("evaluates every active ROAD service without a three-carrier cap", () => {
    const items: RoadService[] = Array.from({ length: 6 }, (_, index) => ({
      ...service(), id: `service-${index}`, carrierId: `carrier-${index}`,
    }));
    items.push({ ...service(), id: "rail-only", mode: "RAIL" });
    const result = evaluateRoad(request, items);
    assert.equal(result.totalEvaluated, 6);
    assert.equal(result.candidates.length, 6);
  });

  it("treats absent evidence as unknown and zero services as empty", () => {
    const item = service();
    item.areas = [];
    assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "unknown");
    assert.deepEqual(evaluateRoad(request, []), {
      overallStatus: "ineligible", totalEvaluated: 0, candidates: [],
    });
  });

  it("returns zero candidates for Piura when only Lima pickup coverage is declared", () => {
    const piuraRequest: RoadRequest = {
      ...request, origin: { countryCode: "PE", regionCode: "PIU", city: "Piura" },
    };
    assert.deepEqual(evaluateRoad(piuraRequest, [service()]), {
      overallStatus: "ineligible", totalEvaluated: 0, candidates: [],
    });
  });
});
