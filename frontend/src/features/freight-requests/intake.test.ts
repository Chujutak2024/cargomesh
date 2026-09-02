import assert from "node:assert/strict";
import test from "node:test";

import { fetchFreightRequestIntake } from "./intake-client";
import {
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";
import {
  FreightRequestIntakeError,
  getFreightRequestIntake,
  type FreightRequestIntakeDependencies,
  type PersistedIntakeRecord,
} from "./intake-server-policy";

const viewModel: FreightRequestIntakeViewModel = {
  schemaVersion: "1.0",
  freightRequestId: "60000000-0000-0000-0000-000000000001",
  requestCode: "FR-1042",
  draftVersion: 1,
  organization: { id: "00000000-0000-0000-0000-000000000001", name: "ACME Mining", defaultCurrency: "USD" },
  currentOperator: { memberId: "50000000-0000-0000-0000-000000000001", displayName: "Demo Supervisor" },
  status: "PENDING",
  cargo: {
    profileName: "Mining spares",
    categoryName: "Machinery",
    categoryCode: "MACHINERY",
    entryMethod: "PALLETS",
    quantity: 10,
    unitsPerEntry: 1,
    totalWeightKg: 8000,
    totalVolumeM3: 18,
    unitWeightKg: 800,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 150,
  },
  route: {
    origin: "Callao, PE",
    destination: "Santiago, CL",
    originCountry: "PE",
    originRegion: "Callao",
    originCity: "Callao",
    originAddress: null,
    destinationCountry: "CL",
    destinationRegion: "Región Metropolitana",
    destinationCity: "Santiago",
    destinationAddress: null,
    pickupContact: { name: null, phone: null },
    deliveryContact: { name: null, company: null, phone: null },
    operationalNotes: null,
  },
  execution: {
    transportMode: "ROAD",
    serviceType: "FTL",
    pickupMode: "SCHEDULED",
    requiredPickup: "2026-09-02T13:00:00.000Z",
    pickupWindowStart: "2026-09-02T13:00:00.000Z",
    pickupWindowEnd: "2026-09-02T17:00:00.000Z",
    deliveryDeadline: "2026-09-05T13:00:00.000Z",
    budgetMax: 2000,
    strategy: "BALANCED",
    availableDocuments: ["commercial_invoice", "packing_list"],
  },
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const persistedRecord: PersistedIntakeRecord = {
  id: viewModel.freightRequestId,
  code: viewModel.requestCode,
  draftVersion: viewModel.draftVersion,
  organizationId: viewModel.organization.id,
  organizationName: viewModel.organization.name,
  defaultCurrency: viewModel.organization.defaultCurrency,
  requesterMemberId: viewModel.currentOperator.memberId,
  requesterDisplayName: viewModel.currentOperator.displayName,
  status: viewModel.status,
  cargoProfileName: viewModel.cargo.profileName,
  cargoCategoryName: viewModel.cargo.categoryName,
  cargoCategoryCode: viewModel.cargo.categoryCode,
  entryMethod: viewModel.cargo.entryMethod,
  quantity: viewModel.cargo.quantity,
  unitsPerEntry: viewModel.cargo.unitsPerEntry,
  totalWeightKg: viewModel.cargo.totalWeightKg,
  totalVolumeM3: viewModel.cargo.totalVolumeM3,
  unitWeightKg: viewModel.cargo.unitWeightKg,
  lengthCm: viewModel.cargo.lengthCm,
  widthCm: viewModel.cargo.widthCm,
  heightCm: viewModel.cargo.heightCm,
  origin: viewModel.route.origin,
  destination: viewModel.route.destination,
  originCountry: viewModel.route.originCountry,
  originRegion: viewModel.route.originRegion,
  originCity: viewModel.route.originCity,
  originAddress: viewModel.route.originAddress,
  destinationCountry: viewModel.route.destinationCountry,
  destinationRegion: viewModel.route.destinationRegion,
  destinationCity: viewModel.route.destinationCity,
  destinationAddress: viewModel.route.destinationAddress,
  pickupContactName: null,
  pickupContactPhone: null,
  deliveryContactName: null,
  deliveryContactCompany: null,
  deliveryContactPhone: null,
  operationalNotes: null,
  transportMode: viewModel.execution.transportMode,
  serviceType: viewModel.execution.serviceType,
  pickupMode: viewModel.execution.pickupMode,
  requiredPickup: viewModel.execution.requiredPickup,
  pickupWindowStart: viewModel.execution.pickupWindowStart,
  pickupWindowEnd: viewModel.execution.pickupWindowEnd,
  deliveryDeadline: viewModel.execution.deliveryDeadline,
  budgetMax: viewModel.execution.budgetMax,
  strategy: viewModel.execution.strategy,
  availableDocuments: viewModel.execution.availableDocuments,
  updatedAt: viewModel.updatedAt,
};

function dependencies(
  record: PersistedIntakeRecord | null,
  observed?: { organizationId?: string; memberId?: string; requestCode?: string },
): FreightRequestIntakeDependencies {
  return {
    resolveMember: async () => ({
      userId: "10000000-0000-4000-8000-000000000001",
      userEmail: "demo.operator@cargomesh.test",
      memberId: viewModel.currentOperator.memberId,
      organizationId: viewModel.organization.id,
      role: "SUPERVISOR",
      status: "ACTIVE",
    }),
    source: {
      findByCode: async (organizationId, memberId, requestCode) => {
        if (observed) Object.assign(observed, { organizationId, memberId, requestCode });
        return record;
      },
    },
  };
}

test("parses the persisted intake model and preserves the real FreightRequest ID", () => {
  const result = parseFreightRequestIntakeViewModel(viewModel);

  assert.equal(result.freightRequestId, "60000000-0000-0000-0000-000000000001");
  assert.equal(result.execution.pickupWindowEnd, "2026-09-02T17:00:00.000Z");
  assert.equal(result.cargo.categoryCode, "MACHINERY");
});

test("rejects an incomplete scheduled intake instead of manufacturing a window", () => {
  assert.throws(
    () => parseFreightRequestIntakeViewModel({
      ...viewModel,
      execution: { ...viewModel.execution, pickupWindowEnd: null },
    }),
    /SCHEDULED requires a complete pickup window/,
  );
});

test("requires an integral draft version for a writable canonical intake", () => {
  assert.throws(
    () => parseFreightRequestIntakeViewModel({ ...viewModel, draftVersion: 1.5 }),
    /draftVersion must be an integer/,
  );
});

test("looks up the request code only within the authenticated member organization", async () => {
  const observed: { organizationId?: string; memberId?: string; requestCode?: string } = {};
  const result = await getFreightRequestIntake("FR-1042", dependencies(persistedRecord, observed));

  assert.equal(observed.organizationId, viewModel.organization.id);
  assert.equal(observed.memberId, viewModel.currentOperator.memberId);
  assert.equal(observed.requestCode, "FR-1042");
  assert.equal(result.freightRequestId, persistedRecord.id);
});

test("rejects a record that does not belong to the authenticated organization", async () => {
  await assert.rejects(
    getFreightRequestIntake(
      "FR-1042",
      dependencies({ ...persistedRecord, organizationId: "00000000-0000-0000-0000-000000000099" }),
    ),
    (error: unknown) => error instanceof FreightRequestIntakeError && error.code === "FORBIDDEN",
  );
});

test("returns NOT_FOUND without leaking another organization request", async () => {
  await assert.rejects(
    getFreightRequestIntake("FR-1042", dependencies(null)),
    (error: unknown) => error instanceof FreightRequestIntakeError && error.code === "NOT_FOUND",
  );
});

test("the client requests the authenticated code endpoint without caching", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(JSON.stringify({ ok: true, data: viewModel }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const result = await fetchFreightRequestIntake("FR-1042", fetcher);

  assert.equal(requestedUrl, "/api/freight-requests/intake/FR-1042");
  assert.equal(requestedInit?.cache, "no-store");
  assert.equal(result.freightRequestId, viewModel.freightRequestId);
});

test("the client keeps the server error code actionable", async () => {
  const fetcher = (async () => new Response(JSON.stringify({
    ok: false,
    error: { code: "NOT_FOUND", message: "FreightRequest not found." },
  }), { status: 404, headers: { "content-type": "application/json" } })) as typeof fetch;

  await assert.rejects(
    fetchFreightRequestIntake("FR-1042", fetcher),
    /NOT_FOUND: FreightRequest not found/,
  );
});

test("unauthenticated access stops before querying requests", async () => {
  const observed = {};
  const deps = dependencies(persistedRecord, observed);
  deps.resolveMember = async () => { throw new Error("UNAUTHENTICATED: No valid active session."); };
  await assert.rejects(getFreightRequestIntake("FR-1042", deps), /UNAUTHENTICATED/);
  assert.deepEqual(observed, {});
});

test("inactive membership stops before querying requests", async () => {
  const observed = {};
  const deps = dependencies(persistedRecord, observed);
  const member = await deps.resolveMember();
  deps.resolveMember = async () => ({ ...member, status: "INACTIVE" });
  await assert.rejects(getFreightRequestIntake("FR-1042", deps),
    (error: unknown) => error instanceof FreightRequestIntakeError && error.httpStatus === 403);
  assert.deepEqual(observed, {});
});

test("rejects invalid request codes before loading data", async () => {
  const observed = {};
  await assert.rejects(getFreightRequestIntake("../FR-1042", dependencies(persistedRecord, observed)),
    (error: unknown) => error instanceof FreightRequestIntakeError && error.httpStatus === 400);
  assert.deepEqual(observed, {});
});

test("rejects a source record for a different request code", async () => {
  await assert.rejects(getFreightRequestIntake("FR-1042", dependencies({ ...persistedRecord, code: "FR-1043" })),
    /Request code correlation failed/);
});

test("client rejects a ViewModel for another request", async () => {
  const fetcher = (async () => Response.json({ ok: true, data: { ...viewModel, requestCode: "FR-1043" } })) as typeof fetch;
  await assert.rejects(fetchFreightRequestIntake("FR-1042", fetcher), /Request code correlation failed/);
});

test("preserves canonical cargo totals and units per entry", async () => {
  const result = await getFreightRequestIntake("FR-1042", dependencies({
    ...persistedRecord, unitsPerEntry: 2, totalWeightKg: 16000, totalVolumeM3: 36,
  }));
  assert.equal(result.cargo.unitsPerEntry, 2);
  assert.equal(result.cargo.totalWeightKg, 16000);
  assert.equal(result.cargo.totalVolumeM3, 36);
});

test("TOTAL_WEIGHT permits absent unit details and optional budget without defaults", async () => {
  const result = await getFreightRequestIntake("FR-1042", dependencies({
    ...persistedRecord, entryMethod: "TOTAL_WEIGHT", quantity: null, unitsPerEntry: null,
    unitWeightKg: null, lengthCm: null, widthCm: null, heightCm: null,
    totalVolumeM3: null, budgetMax: null,
  }));
  assert.equal(result.cargo.totalWeightKg, 8000);
  assert.equal(result.cargo.quantity, null);
  assert.equal(result.cargo.totalVolumeM3, null);
  assert.equal(result.execution.budgetMax, null);
});

test("rejects malformed persisted data with a sanitized error", async () => {
  await assert.rejects(getFreightRequestIntake("FR-1042", dependencies({
    ...persistedRecord, totalWeightKg: -1,
  })), (error: unknown) => error instanceof FreightRequestIntakeError
    && error.code === "INVALID_FREIGHT_REQUEST_INTAKE"
    && error.message === "The persisted FreightRequest intake is invalid.");
});

test("requires explicit timezone on persisted timestamps", () => {
  assert.throws(() => parseFreightRequestIntakeViewModel({
    ...viewModel, execution: { ...viewModel.execution, requiredPickup: "2026-09-02T13:00:00" },
  }), /ISO date-time/);
});
