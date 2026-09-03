import assert from "node:assert/strict";
import test from "node:test";

import {
  createFreightIntakeFixture,
  createNewDraftIntakeModel,
} from "@/features/freight-ui/ui-fixtures";
import type { FreightRequestExecutionIntent } from "./execution-intent-contracts";
import {
  assertExecutionIntentCorrelation,
  assertFreshIntakeCorrelation,
  getFreightIntakeDispatchBlockReason,
  isIntakeVisualScenario,
  loadPersistedFreightIntake,
  mapFreightRequestIntakeToForm,
  resolveIntakeRequestCode,
} from "./intake-ui-adapter";
import type { FreightRequestIntakeViewModel } from "./intake-contracts";

const intake: FreightRequestIntakeViewModel = {
  schemaVersion: "1.0",
  freightRequestId: "60000000-0000-0000-0000-000000000001",
  requestCode: "FR-1042",
  draftVersion: 2,
  organization: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "ACME Mining",
    defaultCurrency: "USD",
  },
  currentOperator: {
    memberId: "50000000-0000-0000-0000-000000000001",
    displayName: "Demo Supervisor",
  },
  status: "PENDING",
  cargo: {
    profileName: "Mining spares",
    categoryName: "Machinery",
    categoryCode: "MACHINERY",
    description: "Componentes para chancadora",
    entryMethod: "TOTAL_WEIGHT",
    quantity: null,
    unitsPerEntry: null,
    unitWeightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    totalWeightKg: 8_250,
    totalVolumeM3: 18.5,
    requiresRefrigeration: true,
    temperatureMinC: 2,
    temperatureMaxC: 6,
    isHazardous: false,
    isOversized: false,
    isFragile: true,
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
    pickupContact: { name: "Ana", phone: "+51 900 000 001" },
    deliveryContact: { name: "Luis", company: "Destino", phone: null },
    operationalNotes: "Coordinar ingreso.",
  },
  execution: {
    transportMode: "ROAD",
    serviceType: "FTL",
    pickupMode: "SCHEDULED",
    requiredPickup: "2026-09-03T13:00:00.000Z",
    pickupWindowStart: "2026-09-03T13:00:00.000Z",
    pickupWindowEnd: "2026-09-03T17:00:00.000Z",
    deliveryDeadline: "2026-09-06T13:00:00.000Z",
    budgetMax: null,
    strategy: "BALANCED",
    availableDocuments: ["commercial_invoice"],
  },
  updatedAt: "2026-09-02T12:00:00.000Z",
};

const intent: FreightRequestExecutionIntent = {
  schemaVersion: "1.0",
  freightRequestId: intake.freightRequestId,
  requestCode: intake.requestCode,
  status: "PENDING",
  pickupMode: "SCHEDULED",
  requiredPickup: intake.execution.requiredPickup,
  pickupWindowStart: intake.execution.pickupWindowStart,
  pickupWindowEnd: intake.execution.pickupWindowEnd,
  deliveryDeadline: intake.execution.deliveryDeadline,
  updatedAt: intake.updatedAt,
};

test("maps the complete persisted intake identity and canonical commercial values", () => {
  const model = mapFreightRequestIntakeToForm(intake);

  assert.equal(model.source, "persisted");
  assert.equal(model.freightRequestId, intake.freightRequestId);
  assert.equal(model.organizationId, intake.organization.id);
  assert.equal(model.operatorMemberId, intake.currentOperator.memberId);
  assert.equal(model.origin, intake.route.origin);
  assert.equal(model.totalWeightKg, 8_250);
  assert.equal(model.totalVolumeM3, 18.5);
  assert.equal(model.cargoDescription, "Componentes para chancadora");
  assert.equal(model.requiresRefrigeration, true);
  assert.equal(model.temperatureMinC, 2);
  assert.equal(model.isFragile, true);
  assert.equal(model.pickupWindowEnd, intake.execution.pickupWindowEnd);
  assert.deepEqual(model.documents, ["commercial_invoice"]);
});

test("preserves absent optional fields instead of replacing them with fixture numbers", () => {
  const model = mapFreightRequestIntakeToForm({
    ...intake,
    cargo: { ...intake.cargo, totalVolumeM3: null },
  });

  assert.equal(model.quantity, null);
  assert.equal(model.unitWeightKg, null);
  assert.equal(model.lengthCm, null);
  assert.equal(model.totalVolumeM3, null);
  assert.equal(model.budgetMaxUsd, null);
  assert.match(getFreightIntakeDispatchBlockReason(model) ?? "", /volumen canónico/);
});

test("enables only the explicit visual fixture scenario", () => {
  assert.equal(isIntakeVisualScenario("fixture"), true);
  assert.equal(isIntakeVisualScenario(undefined), false);
  assert.equal(isIntakeVisualScenario("three"), false);
  assert.equal(isIntakeVisualScenario(["fixture"]), false);
  assert.equal(getFreightIntakeDispatchBlockReason(createFreightIntakeFixture()),
    "El escenario fixture es exclusivamente visual y no puede iniciar un dispatch real.");
});

test("resolves an explicit requested code and returns null when omitted", () => {
  assert.equal(resolveIntakeRequestCode(" FR-2099 "), "FR-2099");
  assert.equal(resolveIntakeRequestCode("FR-1042"), "FR-1042");
  assert.equal(resolveIntakeRequestCode(undefined), null);
  assert.equal(resolveIntakeRequestCode(["FR-2099"]), null);
});

test("propagates authenticated load failures without creating a fixture fallback", async () => {
  const fetcher = (async () => Response.json({
    ok: false,
    error: { code: "NOT_FOUND", message: "FreightRequest not found." },
  }, { status: 404 })) as typeof fetch;

  await assert.rejects(loadPersistedFreightIntake("FR-404", fetcher), /NOT_FOUND/);
});

test("blocks a request that is no longer pending", () => {
  const model = mapFreightRequestIntakeToForm({ ...intake, status: "ORCHESTRATING" });
  assert.match(getFreightIntakeDispatchBlockReason(model) ?? "", /ORCHESTRATING/);
});

test("blocks dispatch when model is a new unpersisted draft", () => {
  const newDraft = createNewDraftIntakeModel();
  assert.equal(newDraft.source, "new-draft");
  assert.equal(newDraft.freightRequestId, "");
  assert.equal(newDraft.draftVersion, 0);
  assert.match(getFreightIntakeDispatchBlockReason(newDraft) ?? "", /servidor/);
});

test("accepts a fresh read only when request, organization and operator still correlate", () => {
  const model = mapFreightRequestIntakeToForm(intake);
  assert.doesNotThrow(() => assertFreshIntakeCorrelation(model, { ...model }));
  assert.throws(
    () => assertFreshIntakeCorrelation(model, { ...model, organizationId: "00000000-0000-0000-0000-000000000099" }),
    /INTAKE_CONTEXT_CHANGED/,
  );
  assert.throws(
    () => assertFreshIntakeCorrelation(model, { ...model, freightRequestId: "60000000-0000-0000-0000-000000000099" }),
    /INTAKE_CONTEXT_CHANGED/,
  );
});

test("execution-intent must belong to the freshly loaded request", () => {
  const model = mapFreightRequestIntakeToForm(intake);
  assert.doesNotThrow(() => assertExecutionIntentCorrelation(model, intent));
  assert.throws(
    () => assertExecutionIntentCorrelation(model, { ...intent, requestCode: "FR-OTHER" }),
    /INVALID_EXECUTION_INTENT/,
  );
  assert.throws(
    () => assertExecutionIntentCorrelation(model, { ...intent, status: "ORCHESTRATING" }),
    /INVALID_EXECUTION_INTENT/,
  );
});
