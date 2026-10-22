/** Offline artifact builder. Does not connect to an API or database. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = fileURLToPath(new URL("./", import.meta.url));
const sourceBytes = Buffer.from(fs.readFileSync(new URL("../v2-c01-sim-v1/C01-SIM-v1.json", import.meta.url), "utf8").replaceAll("\r\n", "\n"));
const source = JSON.parse(sourceBytes);
const hash = value => createHash("sha256").update(value).digest("hex");
const copy = value => structuredClone(value);
const ref = name => ({ $ref: name });
const window = (start, end) => ({ startsAt: `2026-11-03T${start}:00-05:00`, endsAt: `2026-11-03T${end}:00-05:00` });
const baseWindow = window("08:00", "14:30"), availability = window("07:00", "19:00");
const sourceRefs = ["service", "depot", "areaA", "areaB", "lane", "capabilityDefinition", "truck1", "capability1", "calendar1", "driver1", "limit1", "quotePolicy"];

export function buildProposal(dataset) {
  const code = dataset.replace("-", ""), prefix = `PROP_${code}`, namespace = `${code}.`;
  const map = value => {
    if (Array.isArray(value)) return value.map(map);
    if (value && typeof value === "object") {
      if (value.$ref) return ref(sourceRefs.includes(value.$ref) ? namespace + value.$ref : value.$ref);
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, map(item)]));
    }
    if (typeof value === "string") return value.replaceAll("2026-11-02T", "2026-11-03T")
      .replaceAll("C01_SIM_V1_", `${prefix}_`).replaceAll("SIM-C01-T1", `SIM-${code}-T1`)
      .replaceAll("C01 Driver 1", `${code} Driver 1`).replaceAll("C01-T1", `${code}-T1`)
      .replaceAll("C01 depot", `${code} depot`).replaceAll("simulation:C01-SIM-v1", `simulation:PLAN3-${dataset}-v1`)
      .replaceAll("simulation:C01-D1", `simulation:PLAN3-${dataset}-D1`);
    return value;
  };
  const operations = source.operations.filter(op => sourceRefs.includes(op.ref)).map(op => ({
    ref: namespace + op.ref, api: op.api, actor: op.actor, scope: map(op.scope), value: map(copy(op.value)),
    status: "PROPOSED", applied: false, idempotencyKey: null, requiresFreshPreview: true,
  }));
  const op = name => operations.find(item => item.ref === namespace + name);
  op("service").value.maxWeightKg = 10000;
  op("service").value.maxVolumeM3 = 28;
  const policy = op("quotePolicy").value;
  policy.active = false;
  policy.autoIssue = false;
  policy.maxResources = 1;
  policy.operatingCosts.fleet.profiles = policy.operatingCosts.fleet.profiles.filter(item => item.id === "rigid");
  policy.operatingCosts.fleet.assets = policy.operatingCosts.fleet.assets.filter(item => item.assetId.$ref === namespace + "truck1");
  policy.terms = `PROPOSED / NOT APPLIED. ${dataset} synthetic cost proposal; Carrier approval and a fresh native preview are required. No fixed C-01 price, real-world transport commitment, automatic booking or dispatch.`;
  // acknowledgeAuthority is a required future payload literal, not a recorded approval.
  op("quotePolicy").requiresCarrierApproval = true;
  if (dataset === "D-04") operations.push({
    ref: namespace + "maintenance", api: "catalog", actor: "carrier", scope: { kind: "maintenances" },
    status: "PROPOSED", applied: false, idempotencyKey: null, requiresFreshPreview: true,
    value: { schemaVersion: "2.0", serviceId: ref(namespace + "service"), assetId: ref(namespace + "truck1"),
      blockedWindow: baseWindow, kind: "SIMULATED_MAINTENANCE", status: "SCHEDULED",
      source: `simulation:PLAN3-${dataset}-v1`, reason: "Synthetic occupancy only; not a breakdown or a fake booking." },
  });
  const makeCase = (caseId, length, operationWindow, expected) => {
    const request = map(copy(source.requestTemplate));
    request.cargoSpecification = { categoryCode: "GENERAL", description: `[SIMULATED] ${dataset} ${caseId}; not an active shipment`, packaging: "CRATE",
      totalWeightKg: 1000, totalVolumeM3: length / 100, divisible: false, requirements: [],
      units: [{ packageType: "CRATE", quantity: 1, weightPerUnitKg: 1000, volumePerUnitM3: length / 100,
        dimensionsCm: { length, width: 100, height: 100 }, indivisible: true, stackable: false }] };
    request.contacts.pickup.name = `[SIMULATED] ${code} pickup`;
    request.contacts.recipient.name = `[SIMULATED] ${code} recipient`;
    request.contacts.pickup.phoneE164 = `+51900000${code.slice(1)}1`;
    request.contacts.recipient.phoneE164 = `+51900000${code.slice(1)}2`;
    if (caseId === "free-window-control") {
      request.pickupWindow = window("14:45", "15:15");
      request.deliveryWindow = window("17:45", "18:15");
      request.planningPreferences.pickupWindows = [request.pickupWindow];
      request.planningPreferences.deliveryWindows = [request.deliveryWindow];
    }
    return { ref: `${namespace}${caseId}`, status: "PROPOSED", applied: false, requestTemplate: request, operationWindow,
      expectedOffline: expected, expectedNative: "UNVERIFIED_UNTIL_APPROVED_ACTIVATION", persistedOutcomes: [],
      allowOfferBookingOrReservation: dataset === "D-01", actualStartedAt: null, actualCompletedAt: null };
  };
  const cases = dataset === "D-01" ? [makeCase("basic-ftl", 120, baseWindow, "eligible")]
    : dataset === "D-03" ? [makeCase("fit-control", 120, baseWindow, "eligible"), makeCase("oversize-negative", 600, baseWindow, "ineligible")]
    : [makeCase("free-window-control", 120, window("14:45", "18:15"), "eligible"), makeCase("occupied-negative", 120, baseWindow, "ineligible")];
  return {
    schemaVersion: "PLAN3_PROPOSAL_MANIFEST_V1", dataset, version: 1, status: "PROPOSED", applicationStatus: "NOT_APPLIED", applied: false,
    activationAllowed: false, executionMode: "OFFLINE_VALIDATION_ONLY", timezone: "America/Lima",
    source: { path: "../v2-c01-sim-v1/C01-SIM-v1.json", sha256: hash(sourceBytes), sha256Encoding: "UTF8_LF",
      proposalDocument: "salida/plan3/aplicacion-20261022T0423Z/D-FICHAS.md", proposalDocumentSHA256: "8475c62c84e5690d318ce209e76cb3ca2d0b103f48a57a42b0a3c1be3cc9e174",
      derivedAt: "2026-10-22", note: "D-FICHAS D-01/D-03/D-04. D-02 remains existing C-01; no replacement attempt." },
    approvals: { integrator: "Cristhian", integratorApproved: false, carrierAdminApproved: false,
      requiredBeforeActivation: ["exact actors and RLS", "fresh dependency versions and evidence", "Carrier policy and admission", "native payload/hash preview and explicit consent"],
      intentKeysMustBeIssuedAfterApproval: true, futureAuthorityLiteralIsNotApproval: true },
    provenance: { ...source.evidence, reference: `simulation:PLAN3-${dataset}-v1`, provider: "CargoMesh Plan 3 proposal derived from C01 synthetic fixture" },
    geography: { origin: source.operations.find(item => item.ref === "facilityA").value.location,
      destination: source.operations.find(item => item.ref === "facilityB").value.location, measured: false, realFacilities: false, roadVerified: false },
    existingReferences: {
      client: source.existingReferences.client, carrier: source.existingReferences.carrier,
      facilityA: { id: "ec63f447-95ab-46ca-85c1-e9b8953ed475", version: null, mustReread: true },
      facilityB: { id: "2c967237-69d6-4e5b-9586-c825d64c993d", version: null, mustReread: true },
      corridor: { id: "85140780-2760-465f-9bef-4caba7319eb2", snapshotVersion: 1, mustReread: true },
      nodeA: { id: "2ca2493d-12e5-47ea-8dae-828b7b034adc", snapshotVersion: 1, mustReread: true },
      nodeB: { id: "41ba7944-147c-41a6-9a2a-65cafd3787ba", snapshotVersion: 1, mustReread: true },
      routePolicy: { id: "40a0cb90-c75d-41fa-8a36-ade5b93c7967", snapshotVersion: 1, mustReread: true },
      category: { resolution: "existing active GENERAL; resolve exact ID after approval" },
    },
    sharedCorridorSnapshot: copy(source.operations.find(item => item.ref === "corridor").value),
    scope: { carrierCount: 1, serviceCode: `${prefix}_FTL`, resourceRefs: [namespace + "truck1", namespace + "calendar1", namespace + "driver1"],
      c01ForbiddenWindow: source.postBookingAssignments.operations[0].value.window, dedicatedResources: true, availability },
    operations, cases, prohibitedActions: ["start", "position", "completion", "fake_delivery", "extra_offer", "c01_revision"],
    futureD01Only: dataset === "D-01" ? { executionStatus: "PLANNED", actualStartedAt: null, autoConfirm: false,
      expectedCountsAfterNativeApprovalOnly: { requests: 1, offers: 1, bookings: 1, reservations: 1, vehicles: 1, drivers: 1 },
      driverTruckPair: { driverRef: namespace + "driver1", assetRef: namespace + "truck1", linkage: "DOCUMENTED_ONLY", contractOwner: "Cristhian" } } : null,
  };
}

export function writeProposals() {
  const sums = [];
  for (const dataset of ["D-01", "D-03", "D-04"]) {
    const name = `${dataset}-v1.json`, bytes = JSON.stringify(buildProposal(dataset), null, 2) + "\n";
    fs.writeFileSync(directory + name, bytes);
    sums.push(`${hash(bytes)}  ${name}`);
  }
  fs.writeFileSync(directory + "SHA256SUMS", sums.join("\n") + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeProposals();
