import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoad, type RoadRequest, type RoadService } from "./evaluate-road";

const request: RoadRequest = {
  origin: { countryCode: "PE", regionCode: "LIM", city: "Lima" },
  destination: { countryCode: "PE", regionCode: "ARE", city: "Arequipa" },
  operationWindow: { startsAt: "2026-09-28T10:00:00Z", endsAt: "2026-09-29T10:00:00Z" },
  pickupWindow: { startsAt: "2026-09-28T10:00:00Z", endsAt: "2026-09-28T12:00:00Z" },
  deliveryWindow: { startsAt: "2026-09-29T08:00:00Z", endsAt: "2026-09-29T10:00:00Z" },
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
    serviceClass: "FTL",
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
      plannedTransitMinutes: 900, transitProvenanceStatus: "SIMULATED",
      active: true, validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
    }],
    capacities: [{
      id: "asset-1", role: "CARRIER", equipmentCode: "REEFER_TRUCK",
      cargoCategoryCodes: ["PHARMA"], maxWeightKg: 8000, maxVolumeM3: 30,
      calendar: {
        validUntil: "2026-12-31T00:00:00Z", complete: true,
        readyPickupAreaId: "lima-pickup", provenanceStatus: "SIMULATED",
        availableWindows: [{ startsAt: "2026-09-28T00:00:00Z", endsAt: "2026-09-30T00:00:00Z" }],
        reservations: [], maintenance: [], repositioning: [],
      },
    }],
  };
}

describe("pure ROAD eligibility", () => {
  it("requires pool evidence and the same service window before confirming capacity", () => {
    const item = service();
    item.capacities[0]!.sourceEvidenceAvailable = false;
    assert.ok(evaluateRoad(request, [item]).candidates[0]?.reasons.includes("CAPACITY_SOURCE_UNVERIFIED"));
    item.capacities[0]!.sourceEvidenceAvailable = true;
    item.capacities[0]!.sourceWindow = null;
    assert.ok(evaluateRoad(request, [item]).candidates[0]?.reasons.includes("CAPACITY_SOURCE_WINDOW_UNKNOWN"));
    item.capacities[0]!.sourceWindow = { startsAt: "2026-09-28T00:00:00Z", endsAt: "2026-09-28T23:00:00Z" };
    assert.ok(evaluateRoad(request, [item]).candidates[0]?.reasons.includes("OUTSIDE_CAPACITY_SOURCE_WINDOW"));
    item.capacities[0]!.sourceWindow = { startsAt: "2026-09-28T00:00:00Z", endsAt: "2026-09-30T00:00:00Z" };
    assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "eligible");
  });
  it("uses category-specific weight limits and preserves expired capability evidence as unknown", () => {
    const item = service();
    item.capacities[0]!.cargoCapabilities = [{ categoryCode: "PHARMA", certifications: [],
      temperatureMinC: null, temperatureMaxC: null, maxWeightKg: 1000, evidenceAvailable: true,
      validUntil: "2026-12-31T00:00:00Z", requirements: [] }];
    assert.ok(evaluateRoad(request, [item]).candidates[0]?.reasons.includes("CARGO_CAPABILITY_OVER_CAPACITY"));
    item.capacities[0]!.cargoCapabilities[0]!.maxWeightKg = 8000;
    item.capacities[0]!.cargoCapabilities[0]!.validUntil = "2026-09-28T00:00:00Z";
    assert.ok(evaluateRoad(request, [item]).candidates[0]?.reasons.includes("CARGO_CAPABILITY_UNVERIFIED"));
    item.capacities[0]!.cargoCapabilities[0]!.validUntil = "2026-12-31T00:00:00Z";
    item.capacities[0]!.cargoCapabilities[0]!.requirements = ["PERMIT_REVIEW"];
    assert.ok(evaluateRoad(request, [item]).candidates[0]?.reasons.includes("CARGO_CAPABILITY_REQUIREMENTS_UNVERIFIED"));
  });
  it("accepts a verified directed ROAD service with carrying capacity", () => {
    const result = evaluateRoad(request, [service()]);
    assert.equal(result.overallStatus, "eligible");
    assert.equal(result.totalEvaluated, 1);
    assert.deepEqual(result.candidates[0]?.reasons, []);
    assert.equal(result.candidates[0]?.routePreview, null);
  });

  it("keeps LTL unknown for an asset or generic pool without residual/consolidation evidence", () => {
    for (const sourceType of ["TRANSPORT_ASSET", "CAPACITY_POOL"] as const) {
      const item = service();
      item.serviceClass = "LTL";
      item.capacities[0]!.sourceType = sourceType;
      const candidate = evaluateRoad(request, [item]).candidates[0];
      assert.equal(candidate?.status, "unknown");
      assert.ok(candidate?.reasons.includes("LTL_CAPACITY_AND_CONSOLIDATION_UNVERIFIED"));
      item.capacities[0]!.maxWeightKg = 1000;
      assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "ineligible");
      item.capacities[0]!.maxWeightKg = 8000;
      item.serviceClass = "FTL";
      assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "eligible");
    }
  });

  it("keeps missing time or pickup position unknown and rejects an impossible delivery window", () => {
    const noTransit = service();
    noTransit.lanes[0]!.plannedTransitMinutes = null;
    const transitResult = evaluateRoad(request, [noTransit]).candidates[0];
    assert.equal(transitResult?.status, "unknown");
    assert.ok(transitResult?.reasons.includes("TEMPORAL_FEASIBILITY_UNKNOWN"));
    const noPosition = service();
    noPosition.capacities[0]!.calendar!.readyPickupAreaId = null;
    assert.equal(evaluateRoad(request, [noPosition]).candidates[0]?.status, "unknown");
    const tooSlow = service();
    tooSlow.lanes[0]!.plannedTransitMinutes = 1800;
    const lateResult = evaluateRoad(request, [tooSlow]).candidates[0];
    assert.equal(lateResult?.status, "ineligible");
    assert.ok(lateResult?.reasons.includes("DELIVERY_WINDOW_UNREACHABLE"));
  });

  it("chooses a resource with both capacity and pickup readiness", () => {
    const item = service();
    item.capacities[0]!.calendar!.readyPickupAreaId = null;
    item.capacities.push({ ...service().capacities[0]!, id: "ready-asset" });
    const candidate = evaluateRoad(request, [item]).candidates[0];
    assert.equal(candidate?.status, "eligible");
    assert.equal(candidate?.evidence.capacity.sourceId, "ready-asset");
  });

  it("requires border evidence for international lanes despite a false review flag", () => {
    const item = service();
    item.areas[1]!.location.countryCode = "CL";
    item.lanes[0]!.borderReviewRequired = false;
    const crossBorderRequest = { ...request,
      destination: { ...request.destination, countryCode: "CL" } };
    const candidate = evaluateRoad(crossBorderRequest, [item]).candidates[0];
    assert.equal(candidate?.status, "unknown");
    assert.ok(candidate?.reasons.includes("BORDER_DOCS_UNKNOWN"));
    item.lanes[0]!.crossBorderProhibited = true;
    const prohibited = evaluateRoad(crossBorderRequest, [item]).candidates[0];
    assert.equal(prohibited?.status, "ineligible");
    assert.ok(prohibited?.reasons.includes("BORDER_CROSSING_PROHIBITED"));
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

  it("honors an exclusion during pickup but ignores one after pickup", () => {
    const item = service();
    item.areas.push({
      ...item.areas[0]!, id: "lima-later-exclusion", coverage: "EXCLUDE",
      validFrom: "2026-09-28T11:00:00Z", validUntil: "2026-09-28T13:00:00Z",
    });
    const candidate = evaluateRoad(request, [item]).candidates[0];
    assert.equal(candidate?.status, "ineligible");
    assert.ok(candidate?.reasons.includes("PICKUP_EXCLUDED"));

    item.areas[2]!.validFrom = "2026-09-28T13:00:00Z";
    item.areas[2]!.validUntil = "2026-09-28T15:00:00Z";
    assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "eligible");
  });

  it("checks each coverage area at its pickup or delivery window", () => {
    const item = service();
    item.areas[0]!.validUntil = "2026-09-28T13:00:00Z";
    item.areas[1]!.validFrom = "2026-09-29T07:00:00Z";
    assert.equal(evaluateRoad(request, [item]).candidates[0]?.status, "eligible");

    item.areas[1]!.validFrom = "2026-09-29T09:00:00Z";
    const candidate = evaluateRoad(request, [item]).candidates[0];
    assert.equal(candidate?.status, "unknown");
    assert.ok(candidate?.reasons.includes("DELIVERY_COVERAGE_UNKNOWN"));
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

  it("does not confirm missing equipment evidence or coverage expiring mid-pickup", () => {
    const equipmentUnknown = service();
    equipmentUnknown.capacities[0]!.equipmentCode = null;
    assert.equal(evaluateRoad(request, [equipmentUnknown]).candidates[0]?.status, "unknown");
    const expiringArea = service();
    expiringArea.areas[0]!.validUntil = "2026-09-28T11:00:00Z";
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


describe("HAC-40 catalog evidence and limits", () => {
  it("does not confirm coverage without evidence or a valid-from instant", () => {
    const candidate = service();
    candidate.areas[0].evidenceAvailable = false; candidate.areas[0].validFrom = null;
    const result = evaluateRoad(request, [candidate]).candidates[0];
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("PICKUP_COVERAGE_EVIDENCE_UNKNOWN"));
  });
  it("does not inherit confirmed coverage from an expired partner agreement", () => {
    const candidate = service();
    candidate.areas[0].partnerAgreement = { status: "ACTIVE", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-09-01T00:00:00Z" };
    const result = evaluateRoad(request, [candidate]).candidates[0];
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("PICKUP_COVERAGE_EVIDENCE_UNKNOWN"));
  });
  it("enforces the service limit even when the asset has more capacity", () => {
    const candidate = service(); candidate.maxWeightKg = request.totalWeightKg - 1;
    const result = evaluateRoad(request, [candidate]).candidates[0];
    assert.equal(result.status, "ineligible");
    assert.ok(result.reasons.includes("SERVICE_CAPACITY_LIMIT_EXCEEDED"));
  });
  it("does not confirm a matching directed lane without evidence", () => {
    const candidate = service(); candidate.lanes[0].evidenceAvailable = false;
    const result = evaluateRoad(request, [candidate]).candidates[0];
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("LANE_EVIDENCE_UNKNOWN"));
  });
});
