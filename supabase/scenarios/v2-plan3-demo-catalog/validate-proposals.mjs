/** Offline only: schemas and the existing pure ROAD eligibility policy; no DB/HTTP client. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { CatalogInputsV2 } from "../../../cargomesh/src/shared/schemas/v2/catalog.ts";
import { WorkflowInputsV2 } from "../../../cargomesh/src/shared/schemas/v2/workflow.ts";
import { QuotePolicyValueSchema } from "../../../cargomesh/src/shared/schemas/v2/quote-automation.ts";
import { CreateFreightRequestV2InputSchema } from "../../../cargomesh/src/shared/schemas/v2/freight-request.ts";
import { evaluateRoad } from "../../../cargomesh/src/server/modules/road-serviceability/domain/evaluate-road.ts";
import { buildProposal } from "./build-proposals.mjs";

export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const placeholder = name => {
  const h = hash(`validation-only:${name}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const walk = (value, visit) => {
  visit(value);
  if (Array.isArray(value)) value.forEach(item => walk(item, visit));
  else if (value && typeof value === "object") Object.values(value).forEach(item => walk(item, visit));
};
const resolve = value => Array.isArray(value) ? value.map(resolve) : value && typeof value === "object"
  ? value.$ref ? placeholder(value.$ref) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)])) : value;
const overlaps = (a, b) => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
const contains = (a, b) => Date.parse(a.startsAt) <= Date.parse(b.startsAt) && Date.parse(a.endsAt) >= Date.parse(b.endsAt);

export function assessCase(manifest, item) {
  const get = name => manifest.operations.find(op => op.ref === manifest.dataset.replace("-", "") + "." + name);
  const asset = get("truck1"), calendar = get("calendar1").value, lane = get("lane"), service = get("service");
  const request = item.requestTemplate, cargo = request.cargoSpecification;
  const model = {
    serviceClass: "FTL", origin: manifest.geography.origin, destination: manifest.geography.destination,
    // Assess the proposed slot inside the accepted request windows, as native dispatch does.
    operationWindow: item.operationWindow,
    pickupWindow: { startsAt: item.operationWindow.startsAt, endsAt: request.pickupWindow.endsAt },
    deliveryWindow: { startsAt: request.deliveryWindow.startsAt, endsAt: item.operationWindow.endsAt },
    cargoCategoryCode: cargo.categoryCode, totalWeightKg: cargo.totalWeightKg, totalVolumeM3: cargo.totalVolumeM3,
    indivisibleUnits: cargo.units.map(unit => ({ weightKg: unit.weightPerUnitKg, volumeM3: unit.volumePerUnitM3 })),
    unitDimensionsCm: cargo.units.map(unit => unit.dimensionsCm), requiredEquipmentCode: "BOX_TRUCK", unverifiedRequirements: [],
  };
  const resource = {
    id: asset.ref, sourceType: "TRANSPORT_ASSET", calendarId: get("calendar1").ref,
    role: "CARRIER", equipmentCode: asset.value.equipmentType, cargoCategoryCodes: ["GENERAL"],
    maxWeightKg: asset.value.usefulCapacityKg, maxVolumeM3: asset.value.usableVolumeM3,
    usableDimensionsCm: asset.value.roadVehicle.usableDimensions, sourceEvidenceAvailable: Boolean(asset.value.evidence), sourceWindow: calendar.horizon,
    cargoCapabilities: [{ categoryCode: "GENERAL", certifications: [], temperatureMinC: null, temperatureMaxC: null,
      maxWeightKg: get("capabilityDefinition").value.maxWeightKg, evidenceAvailable: true, validUntil: get("capability1").value.validUntil, requirements: [] }],
    calendar: { validUntil: calendar.validUntil, complete: calendar.complete, readyPickupAreaId: calendar.readyPickupAreaId.$ref,
      provenanceStatus: calendar.freshness, availableWindows: calendar.availableWindows, reservations: [], repositioning: [],
      maintenance: manifest.operations.filter(op => op.scope.kind === "maintenances").map(op => op.value.blockedWindow) },
  };
  const areas = [get("areaA"), get("areaB")].map(op => ({ id: op.ref, role: op.value.role, coverage: op.value.inclusion,
    granularity: op.value.geography.granularity, location: op.value.geography, active: op.value.active,
    validFrom: op.value.validFrom, validUntil: op.value.validUntil, evidenceAvailable: Boolean(op.value.evidence) }));
  const result = evaluateRoad(model, [{ id: service.ref, carrierId: manifest.existingReferences.carrier.carrierId, mode: "ROAD", serviceClass: "FTL", active: true,
    supportedCargoCategoryCodes: ["GENERAL"], maxWeightKg: service.value.maxWeightKg, maxVolumeM3: service.value.maxVolumeM3, areas,
    lanes: [{ ...lane.value, id: lane.ref, pickupAreaId: lane.value.pickupAreaId.$ref, deliveryAreaId: lane.value.deliveryAreaId.$ref, evidenceAvailable: true }], capacities: [resource] }]);
  return { status: result.candidates[0]?.status, reasons: result.candidates[0]?.reasons ?? [] };
}

export function validateProposal(manifest) {
  assert.equal(manifest.schemaVersion, "PLAN3_PROPOSAL_MANIFEST_V1");
  assert.ok(["D-01", "D-03", "D-04"].includes(manifest.dataset));
  assert.equal(manifest.status, "PROPOSED"); assert.equal(manifest.applicationStatus, "NOT_APPLIED");
  assert.equal(manifest.applied, false); assert.equal(manifest.activationAllowed, false);
  assert.equal(manifest.executionMode, "OFFLINE_VALIDATION_ONLY");
  assert.equal(manifest.approvals.integratorApproved, false); assert.equal(manifest.approvals.carrierAdminApproved, false);
  assert.equal(manifest.scope.carrierCount, 1); assert.equal(manifest.scope.dedicatedResources, true);
  assert.equal(manifest.provenance.provenanceStatus, "SIMULATED");
  assert.equal(manifest.geography.measured, false); assert.equal(manifest.geography.realFacilities, false);
  assert.deepEqual([manifest.geography.origin.lat, manifest.geography.origin.lng, manifest.geography.destination.lat, manifest.geography.destination.lng], [-12, -77, -12.5, -77]);
  const refs = new Set([...manifest.operations.map(op => op.ref), ...Object.keys(manifest.existingReferences)]);
  assert.equal(new Set(manifest.operations.map(op => op.ref)).size, manifest.operations.length);
  walk(manifest, value => {
    if (value && typeof value === "object" && value.$ref) assert.ok(refs.has(value.$ref), `Unresolved logical reference: ${value.$ref}`);
  });
  const namespace = manifest.dataset.replace("-", "") + ".";
  for (const op of manifest.operations) {
    assert.ok(op.ref.startsWith(namespace));
    assert.equal(op.status, "PROPOSED"); assert.equal(op.applied, false); assert.equal(op.idempotencyKey, null);
    assert.equal(op.requiresFreshPreview, true);
    const schema = op.api === "catalog" ? CatalogInputsV2[op.scope.kind] : op.api === "workflow" ? WorkflowInputsV2[op.scope.action]
      : op.api === "quotePolicy" ? QuotePolicyValueSchema : null;
    assert.ok(schema, "Closed native operation allowlist"); schema.parse(resolve(op.value));
    if (op.api === "workflow") assert.equal(op.scope.action, "limits.publish");
    if (op.api === "catalog") assert.ok(["services", "depots", "areas", "lanes", "capability-definitions", "assets", "asset-capabilities", "calendars", "drivers", "maintenances"].includes(op.scope.kind));
  }
  WorkflowInputsV2["corridors.publish"].parse(resolve(manifest.sharedCorridorSnapshot));
  const get = name => manifest.operations.find(op => op.ref === namespace + name).value;
  const policy = get("quotePolicy"), driver = get("driver1");
  assert.equal(policy.active, false); assert.equal(policy.autoIssue, false); assert.equal(policy.dispatch.autoConfirm, false);
  assert.equal(policy.maxResources, 1); assert.equal(policy.operatingCosts.fleet.assets.length, 1);
  assert.equal(policy.operatingCosts.fleet.assets[0].assetId.$ref, namespace + "truck1");
  assert.equal(driver.usedDutySeconds, 0); assert.equal(driver.maximumDutySeconds, 43200);
  assert.equal(manifest.operations.filter(op => op.scope.kind === "assets").length, 1);
  assert.equal(manifest.operations.filter(op => op.scope.kind === "drivers").length, 1);
  assert.equal(get("calendar1").complete, true);
  const results = [];
  for (const item of manifest.cases) {
    CreateFreightRequestV2InputSchema.parse(resolve(item.requestTemplate));
    assert.equal(item.status, "PROPOSED"); assert.equal(item.applied, false);
    assert.equal(item.actualStartedAt, null); assert.equal(item.actualCompletedAt, null);
    assert.deepEqual(item.persistedOutcomes, []);
    assert.equal(item.expectedNative, "UNVERIFIED_UNTIL_APPROVED_ACTIVATION");
    assert.equal(item.allowOfferBookingOrReservation, manifest.dataset === "D-01");
    assert.equal(overlaps(item.operationWindow, manifest.scope.c01ForbiddenWindow), false);
    assert.ok(contains(manifest.scope.availability, item.operationWindow));
    assert.ok(contains(driver.dutyWindow, item.operationWindow));
    assert.ok(Date.parse(item.operationWindow.endsAt) <= Date.parse(manifest.provenance.validUntil));
    const cargo = item.requestTemplate.cargoSpecification, unit = cargo.units[0];
    assert.equal(unit.quantity, 1); assert.equal(unit.indivisible, true); assert.equal(unit.stackable, false);
    assert.equal(cargo.totalWeightKg, unit.quantity * unit.weightPerUnitKg);
    assert.ok(Math.abs(cargo.totalVolumeM3 - unit.quantity * unit.volumePerUnitM3) < 1e-9);
    assert.ok(Math.abs(unit.volumePerUnitM3 - unit.dimensionsCm.length * unit.dimensionsCm.width * unit.dimensionsCm.height / 1e6) < 1e-9);
    const actual = assessCase(manifest, item);
    assert.equal(actual.status, item.expectedOffline, `Offline case ${item.ref}: ${actual.reasons.join(",")}`);
    results.push({ ref: item.ref, ...actual, evidence: "PURE_POLICY_ONLY_NOT_NATIVE_ACTIVATION" });
  }
  assert.equal(results[0].status, "eligible", "A failed positive control blocks the negative case");
  if (manifest.dataset === "D-03") assert.ok(results[1].reasons.includes("UNIT_DIMENSIONS_EXCEEDED"));
  if (manifest.dataset === "D-04") {
    assert.equal(manifest.operations.filter(op => op.scope.kind === "maintenances").length, 1);
    assert.ok(results[1].reasons.includes("CAPACITY_WINDOW_BLOCKED"));
  }
  return { dataset: manifest.dataset, result: "PASS", status: "PROPOSED / NOT APPLIED", operations: manifest.operations.length, cases: results };
}

export function validateFiles() {
  const directory = new URL("./", import.meta.url), sums = fs.readFileSync(new URL("SHA256SUMS", directory), "utf8").trim().split(/\r?\n/);
  const reports = [], resources = new Set();
  for (const line of sums) {
    const [expected, name] = line.split(/\s+/), bytes = fs.readFileSync(new URL(name, directory));
    assert.equal(hash(bytes), expected, `Checksum ${name}`);
    const manifest = JSON.parse(bytes);
    assert.deepEqual(manifest, buildProposal(manifest.dataset), `Rebuild drift ${name}`);
    for (const ref of manifest.scope.resourceRefs) { assert.equal(resources.has(ref), false); resources.add(ref); }
    reports.push(validateProposal(manifest));
  }
  assert.deepEqual(reports.map(row => row.dataset), ["D-01", "D-03", "D-04"]);
  return { result: "PASS", databasesTouched: 0, httpCalls: 0, activation: "NOT_APPLIED", reports };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(validateFiles(), null, 2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
