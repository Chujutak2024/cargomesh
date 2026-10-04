import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateDriverAssignment, evaluateFleetAvailability, evaluateVehicleCombination, fleetWindowsOverlap,
  evaluateVehicleAssignment, type VehicleAssignmentSnapshot, type VehicleAssignmentContext,
  type FleetAgenda, type FleetEvidence, type DriverSnapshot, type DriverRequirements,
  type CombinationSnapshot, type CombinationRequirements } from "./assignment-policy";

const at = "2027-01-01T00:00:00Z";
const window = { startsAt: "2027-01-02T08:00:00Z", endsAt: "2027-01-02T12:00:00Z" };
const evidence: FleetEvidence = { reference: "explicit-test-evidence", verifiedAt: at, validUntil: "2027-02-01T00:00:00Z" };
function agenda(): FleetAgenda { return { complete: true, evidence, availableWindows: [window], occupiedWindows: [] }; }
function driver(): DriverSnapshot { return { id: "driver", carrierId: "carrier", fullName: "Synthetic driver",
  portalAccountId: null, licenseClass: "TEST_LICENSE", licenseValidUntil: "2027-01-31", qualifications: ["TEST_HAZMAT"],
  experienceYears: null, dutyStatus: "TEST_READY", agenda: agenda() }; }
function driverRequirements(): DriverRequirements { return { carrierId: "carrier", acceptedLicenseClasses: ["TEST_LICENSE"],
  requiredQualifications: ["TEST_HAZMAT"], licenseExpiry: { localDate: "2027-01-31", exclusiveInstant: "2027-02-01T05:00:00Z", evidence },
  duty: { allowedStatuses: ["TEST_READY"], maximumDutySeconds: 8 * 3600, previousDutySeconds: 0, evidence } }; }
function combination(): CombinationSnapshot { return { id: "combination", carrierId: "carrier", kind: "TEST_TRACTOR_TRAILER",
  configuration: "Synthetic compatible pair", coupledWindow: window, evidence, combinedTareKg: 10000,
  grossWeightLimitKg: 40000, status: "TEST_COUPLED", assets: ["tractor", "trailer"].map(id => ({ id,
    carrierId: "carrier", mode: "ROAD", operatingStatus: "AVAILABLE", agenda: agenda() })) }; }
function combinationRequirements(): CombinationRequirements { return { carrierId: "carrier", allowedStatuses: ["TEST_COUPLED"],
  compatibility: { compatible: true, evidence }, manufacturerPayloadLimitKg: 25000,
  routeGrossLimitKg: 30000, servicePayloadLimitKg: 22000, limitsEvidence: evidence }; }
function assignment(): VehicleAssignmentSnapshot { return { carrierId: "carrier", serviceId: "service", executionId: "trip",
  assetId: "asset", window, status: "PROPOSED", capacityCommitted: { weightKg: 6000, volumeM3: 10 },
  evidence: null, reservationId: null }; }
function assignmentContext(): VehicleAssignmentContext { return { carrierId: "carrier", serviceId: "service", executionId: "trip",
  serviceClass: "LTL", asset: { id: "asset", carrierId: "carrier", serviceId: "service", mode: "ROAD", role: "LOAD_BEARING",
    operatingStatus: "AVAILABLE", agenda: agenda(), weightLimitKg: 10000, volumeLimitM3: 20, limitsEvidence: evidence },
  allocations: [], consolidationEvidence: evidence, reservation: null }; }

describe("HAC-40 shared fleet assignment policy", () => {
  it("uses half-open windows and rejects invalid periods", () => {
    assert.equal(fleetWindowsOverlap(window, { startsAt: window.endsAt, endsAt: "2027-01-02T13:00:00Z" }), false);
    assert.throws(() => fleetWindowsOverlap(window, { startsAt: window.endsAt, endsAt: window.startsAt }), /INVALID_WINDOW/);
  });
  it("covers a continuous period with adjacent slots but rejects gaps", () => {
    const a = agenda();
    a.availableWindows = [{ startsAt: window.startsAt, endsAt: "2027-01-02T10:00:00Z" },
      { startsAt: "2027-01-02T10:00:00Z", endsAt: window.endsAt }];
    assert.equal(evaluateFleetAvailability(a, window, at).status, "eligible");
    a.availableWindows[1].startsAt = "2027-01-02T10:01:00Z";
    assert.deepEqual(evaluateFleetAvailability(a, window, at), { status: "ineligible", reasons: ["NO_RESOURCE_WINDOW"] });
  });
  it("does not infer unavailability from stale or incomplete agendas", () => {
    const a = agenda(); a.availableWindows = []; a.complete = false;
    assert.equal(evaluateFleetAvailability(a, window, at).status, "unknown");
    a.complete = true; a.evidence = { ...evidence, validUntil: at };
    assert.equal(evaluateFleetAvailability(a, window, at).status, "unknown");
    assert.equal(evaluateFleetAvailability(null, window, at).status, "unknown");
  });
  it("blocks overlapping active commitments independently of missing evidence", () => {
    const a = agenda(); a.evidence = null; a.occupiedWindows = [window];
    assert.equal(evaluateFleetAvailability(a, window, at).status, "ineligible");
  });
  it("accepts a qualified driver with sourced duty limits and license date interpretation", () => {
    assert.deepEqual(evaluateDriverAssignment(driver(), driverRequirements(), window, at), { status: "eligible", reasons: [] });
  });
  it("blocks foreign carrier, wrong license, missing qualification and excessive duty", () => {
    const d = driver(); d.carrierId = "other"; d.licenseClass = "OTHER"; d.qualifications = [];
    const req = driverRequirements(); req.duty!.previousDutySeconds = 5 * 3600;
    assert.deepEqual(evaluateDriverAssignment(d, req, window, at), { status: "ineligible", reasons:
      ["DRIVER_CARRIER_MISMATCH", "LICENSE_CLASS_MISMATCH", "DRIVER_QUALIFICATION_MISSING", "DRIVER_DUTY_LIMIT_EXCEEDED"] });
  });
  it("keeps missing jurisdiction/duty policy unknown and rejects invalid license dates", () => {
    const req = driverRequirements(); req.licenseExpiry = null; req.duty = null;
    assert.equal(evaluateDriverAssignment(driver(), req, window, at).status, "unknown");
    req.licenseExpiry = { ...driverRequirements().licenseExpiry!, localDate: "2028-01-31" };
    assert.ok(evaluateDriverAssignment(driver(), req, window, at).reasons.includes("LICENSE_EXPIRY_POLICY_UNKNOWN"));
    assert.throws(() => evaluateDriverAssignment({ ...driver(), licenseValidUntil: "2027-02-30" }, req, window, at), /INVALID_LICENSE_DATE/);
  });
  it("checks license expiration against the entire assignment", () => {
    const req = driverRequirements(); req.licenseExpiry!.exclusiveInstant = "2027-01-02T11:00:00Z";
    assert.ok(evaluateDriverAssignment(driver(), req, window, at).reasons.includes("LICENSE_EXPIRED_FOR_WINDOW"));
  });
  it("calculates combination capacity from the strictest applicable limit without summing members", () => {
    assert.deepEqual(evaluateVehicleCombination(combination(), combinationRequirements(), window, at),
      { status: "eligible", reasons: [], effectivePayloadKg: 20000 });
  });
  it("requires every member in the same operating window", () => {
    const c = combination(); c.assets[1].agenda!.occupiedWindows = [window];
    assert.equal(evaluateVehicleCombination(c, combinationRequirements(), window, at).status, "ineligible");
    c.assets[1].agenda = null;
    assert.equal(evaluateVehicleCombination(c, combinationRequirements(), window, at).status, "unknown");
  });
  it("does not confirm compatibility or capacity with missing evidence", () => {
    const req = combinationRequirements(); req.compatibility = null; req.routeGrossLimitKg = null;
    const result = evaluateVehicleCombination(combination(), req, window, at);
    assert.equal(result.status, "unknown"); assert.equal(result.effectivePayloadKg, null);
    assert.ok(result.reasons.includes("COMBINATION_COMPATIBILITY_UNKNOWN"));
  });
  it("rejects duplicate/foreign/nonROAD members and unavailable assets", () => {
    const c = combination(); c.assets[1].id = c.assets[0].id;
    assert.throws(() => evaluateVehicleCombination(c, combinationRequirements(), window, at), /INVALID_COMBINATION_MEMBERS/);
    c.assets[1].id = "other"; c.assets[1].carrierId = "other"; c.assets[1].mode = "SEA"; c.assets[1].operatingStatus = "MAINTENANCE";
    const result = evaluateVehicleCombination(c, combinationRequirements(), window, at);
    assert.equal(result.status, "ineligible");
    for (const reason of ["COMBINATION_CARRIER_MISMATCH", "COMBINATION_MODE_MISMATCH", "COMBINATION_ASSET_UNAVAILABLE"]) assert.ok(result.reasons.includes(reason));
  });
  it("discounts same-trip LTL allocations and checks weight and volume independently", () => {
    const ctx = assignmentContext(); ctx.allocations = [{ executionId: "trip", window, capacity: { weightKg: 4000, volumeM3: 10 } }];
    assert.equal(evaluateVehicleAssignment(assignment(), ctx, at).status, "eligible");
    ctx.allocations[0].capacity.weightKg = 4001;
    assert.ok(evaluateVehicleAssignment(assignment(), ctx, at).reasons.includes("ASSIGNMENT_OVER_CAPACITY"));
    ctx.allocations[0].capacity = { weightKg: 1, volumeM3: 11 };
    assert.ok(evaluateVehicleAssignment(assignment(), ctx, at).reasons.includes("ASSIGNMENT_OVER_CAPACITY"));
  });
  it("does not consolidate across different executions or exclusive FTL trips", () => {
    const ctx = assignmentContext(); ctx.allocations = [{ executionId: "other-trip", window, capacity: { weightKg: 1, volumeM3: 1 } }];
    assert.ok(evaluateVehicleAssignment(assignment(), ctx, at).reasons.includes("ASSIGNMENT_CONFLICT"));
    ctx.allocations[0].executionId = "trip"; ctx.serviceClass = "FTL";
    assert.ok(evaluateVehicleAssignment(assignment(), ctx, at).reasons.includes("ASSIGNMENT_CONFLICT"));
  });
  it("uses peak simultaneous LTL capacity rather than summing sequential allocations", () => {
    const ctx = assignmentContext(); ctx.allocations = [
      { executionId: "trip", window: { startsAt: window.startsAt, endsAt: "2027-01-02T10:00:00Z" }, capacity: { weightKg: 4000, volumeM3: 10 } },
      { executionId: "trip", window: { startsAt: "2027-01-02T10:00:00Z", endsAt: window.endsAt }, capacity: { weightKg: 4000, volumeM3: 10 } },
    ];
    assert.equal(evaluateVehicleAssignment(assignment(), ctx, at).status, "eligible");
    ctx.allocations[1].window.startsAt = "2027-01-02T09:59:00Z";
    assert.ok(evaluateVehicleAssignment(assignment(), ctx, at).reasons.includes("ASSIGNMENT_OVER_CAPACITY"));
  });
  it("does not subtract assignments outside the operating period and preserves unknown limits", () => {
    const ctx = assignmentContext(); ctx.allocations = [{ executionId: "trip",
      window: { startsAt: window.endsAt, endsAt: "2027-01-02T15:00:00Z" }, capacity: { weightKg: 99999, volumeM3: 99999 } }];
    assert.equal(evaluateVehicleAssignment(assignment(), ctx, at).status, "eligible");
    ctx.asset.weightLimitKg = null;
    assert.equal(evaluateVehicleAssignment(assignment(), ctx, at).status, "unknown");
  });
  it("blocks auxiliary capacity and unbound confirmed assignments", () => {
    const ctx = assignmentContext(); ctx.asset.role = "AUXILIARY";
    assert.ok(evaluateVehicleAssignment(assignment(), ctx, at).reasons.includes("AUXILIARY_CANNOT_CARRY"));
    const a = assignment(); a.status = "CONFIRMED";
    assert.ok(evaluateVehicleAssignment(a, assignmentContext(), at).reasons.includes("CONFIRMED_ASSIGNMENT_REQUIRES_RESERVATION"));
  });
  it("requires a sourced confirmed reservation matching scope, trip, asset, capacity and window", () => {
    const a = assignment(); a.status = "CONFIRMED"; a.reservationId = "reservation"; a.evidence = evidence;
    const ctx = assignmentContext(); ctx.reservation = { id: "reservation", carrierId: "carrier", serviceId: "service",
      executionId: "trip", assetId: "asset", window, status: "CONFIRMED", capacity: a.capacityCommitted, evidence };
    assert.equal(evaluateVehicleAssignment(a, ctx, at).status, "eligible");
    for (const change of [{ status: "HELD" as const }, { executionId: "other" }, { assetId: "other" },
      { capacity: { weightKg: 5999, volumeM3: 10 } }, { window: { startsAt: "2027-01-02T09:00:00Z", endsAt: window.endsAt } }]) {
      assert.ok(evaluateVehicleAssignment(a, { ...ctx, reservation: { ...ctx.reservation, ...change } }, at)
        .reasons.includes("ASSIGNMENT_RESERVATION_MISMATCH"));
    }
    ctx.reservation.evidence = null;
    assert.equal(evaluateVehicleAssignment(a, ctx, at).status, "unknown");
  });
  it("keeps consolidation unknown when its policy has no current evidence", () => {
    const ctx = assignmentContext(); ctx.consolidationEvidence = null;
    ctx.allocations = [{ executionId: "trip", window, capacity: { weightKg: 1000, volumeM3: 1 } }];
    assert.equal(evaluateVehicleAssignment(assignment(), ctx, at).status, "unknown");
  });
});
