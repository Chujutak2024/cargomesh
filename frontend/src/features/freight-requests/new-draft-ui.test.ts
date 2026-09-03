import assert from "node:assert/strict";
import test from "node:test";

import {
  createNewDraftIntakeModel,
  createFreightIntakeFixture,
} from "@/features/freight-ui/ui-fixtures";
import {
  getFreightIntakeDispatchBlockReason,
  resolveIntakeRequestCode,
  mapFreightRequestIntakeToForm,
} from "./intake-ui-adapter";
import {
  createFreightRequestDraft,
  DraftCreationClientError,
  type CreateFreightRequestDraftInput,
} from "./draft-creation-client";
import type { FreightRequestIntakeViewModel } from "./intake-contracts";

const FR1042_UUID = "60000000-0000-0000-0000-000000000001";
const FR1042_CODE = "FR-1042";

const mockCanonicalCreatedDraft: FreightRequestIntakeViewModel = {
  schemaVersion: "1.0",
  freightRequestId: "70000000-0000-0000-0000-000000000001",
  requestCode: "FR-5001",
  draftVersion: 1,
  organization: {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "ACME Mining Perú",
    defaultCurrency: "USD",
  },
  currentOperator: {
    memberId: "e0000000-0000-0000-0000-000000000001",
    displayName: "Carlos Mendoza",
  },
  status: "DRAFT",
  cargo: {
    profileName: null,
    categoryName: "Machinery",
    categoryCode: "MACHINERY",
    entryMethod: "PALLETS",
    quantity: 5,
    unitsPerEntry: 1,
    unitWeightKg: 1000,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 140,
    totalWeightKg: 5000,
    totalVolumeM3: 8.4,
  },
  route: {
    origin: "Callao, PE",
    destination: "Santiago, CL",
    originCountry: "PE",
    originRegion: "Callao",
    originCity: "Callao",
    originAddress: "Av. Nestor Gambetta 1200",
    destinationCountry: "CL",
    destinationRegion: "Santiago",
    destinationCity: "Santiago",
    destinationAddress: "Av. Américo Vespucio 400",
    pickupContact: { name: "Operador Callao", phone: "+51 999 111 222" },
    deliveryContact: { name: "Receptor Santiago", company: "Minera Andina", phone: "+56 9 888 777" },
    operationalNotes: "Manipular con montacargas pesado",
  },
  execution: {
    transportMode: "ROAD",
    serviceType: "FTL",
    pickupMode: "SCHEDULED",
    requiredPickup: "2026-09-05T08:00:00.000Z",
    pickupWindowStart: "2026-09-05T08:00:00.000Z",
    pickupWindowEnd: "2026-09-05T18:00:00.000Z",
    deliveryDeadline: "2026-09-10T18:00:00.000Z",
    budgetMax: 2500,
    strategy: "BALANCED",
    availableDocuments: ["commercial_invoice", "packing_list"],
  },
  updatedAt: "2026-09-02T20:30:00.000Z",
};

test("1. Unpersisted new draft initializes with source 'new-draft', empty IDs, and draftVersion 0 without touching FR-1042", () => {
  const model = createNewDraftIntakeModel();

  assert.equal(model.source, "new-draft");
  assert.equal(model.freightRequestId, "");
  assert.equal(model.requestId, "");
  assert.equal(model.draftVersion, 0);
  assert.notEqual(model.freightRequestId, FR1042_UUID);
  assert.notEqual(model.requestId, FR1042_CODE);

  // Dispatch must be blocked for unpersisted drafts
  const blockReason = getFreightIntakeDispatchBlockReason(model);
  assert.ok(blockReason !== null);
  assert.match(blockReason, /servidor/);
});

test("2. Explicit ?requestCode=FR-1042 resolves the canonical code while omitted returns null", () => {
  assert.equal(resolveIntakeRequestCode("FR-1042"), "FR-1042");
  assert.equal(resolveIntakeRequestCode(" FR-1042 "), "FR-1042");
  assert.equal(resolveIntakeRequestCode(undefined), null);
  assert.equal(resolveIntakeRequestCode(""), null);
  assert.equal(resolveIntakeRequestCode(["FR-1042"]), null);
});

test("3. POST client calls /api/freight-requests/drafts with typed payload and adopts canonical snapshot", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  let requestBody: any = null;

  const mockFetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedMethod = init?.method ?? "GET";
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true, data: mockCanonicalCreatedDraft }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const input: CreateFreightRequestDraftInput = {
    fields: {
      cargoCategoryCode: "MACHINERY",
      originCountry: "PE",
      originCity: "Callao",
      destinationCountry: "CL",
      destinationCity: "Santiago",
      cargoDescription: "Repuestos mineros de prueba",
      requiresRefrigeration: false,
      temperatureMinC: null,
      temperatureMaxC: null,
      isHazardous: false,
      isOversized: false,
      isFragile: false,
    },
  };

  const result = await createFreightRequestDraft(input, undefined, mockFetcher);

  assert.equal(requestedUrl, "/api/freight-requests/drafts");
  assert.equal(requestedMethod, "POST");
  assert.equal(requestBody.fields.originCity, "Callao");
  assert.equal(requestBody.fields.cargoCategoryCode, "MACHINERY");

  // Adopts server's canonical snapshot
  assert.equal(result.freightRequestId, "70000000-0000-0000-0000-000000000001");
  assert.equal(result.requestCode, "FR-5001");
  assert.equal(result.draftVersion, 1);
  assert.equal(result.status, "DRAFT");

  // Maps correctly to UI model
  const mappedForm = mapFreightRequestIntakeToForm(result);
  assert.equal(mappedForm.source, "persisted");
  assert.equal(mappedForm.freightRequestId, "70000000-0000-0000-0000-000000000001");
  assert.equal(mappedForm.requestId, "FR-5001");
  assert.equal(mappedForm.draftVersion, 1);
});

test("4. Server error on POST throws DraftCreationClientError and does NOT invent fake IDs", async () => {
  const mockFetcher = (async () => {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "ORGANIZATION_NOT_AUTHORIZED", message: "Membresía inactiva." },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const input: CreateFreightRequestDraftInput = {
    fields: {
      cargoCategoryCode: "MACHINERY",
      originCity: "Callao",
      destinationCity: "Santiago",
    },
  };

  await assert.rejects(
    async () => {
      await createFreightRequestDraft(input, undefined, mockFetcher);
    },
    (err: any) => {
      assert.ok(err instanceof DraftCreationClientError);
      assert.equal(err.code, "ORGANIZATION_NOT_AUTHORIZED");
      assert.match(err.message, /Membresía inactiva/);
      return true;
    },
  );
});

test("5. Special requirements (refrigeration, hazmat, oversized, fragile) are captured in POST payload", async () => {
  let capturedBody: any = null;

  const mockFetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true, data: mockCanonicalCreatedDraft }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const input: CreateFreightRequestDraftInput = {
    fields: {
      cargoCategoryCode: "AGRICULTURAL",
      originCity: "Ica",
      destinationCity: "Santiago",
      requiresRefrigeration: true,
      temperatureMinC: 2,
      temperatureMaxC: 6,
      isHazardous: true,
      isOversized: false,
      isFragile: true,
    },
  };

  await createFreightRequestDraft(input, undefined, mockFetcher);

  assert.equal(capturedBody.fields.requiresRefrigeration, true);
  assert.equal(capturedBody.fields.temperatureMinC, 2);
  assert.equal(capturedBody.fields.temperatureMaxC, 6);
  assert.equal(capturedBody.fields.isHazardous, true);
  assert.equal(capturedBody.fields.isFragile, true);
  assert.equal(capturedBody.fields.isOversized, false);
});

test("6. A new draft never calls PATCH or mutates FR-1042", async () => {
  const calledUrls: string[] = [];
  const calledMethods: string[] = [];

  const spyFetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calledUrls.push(String(url));
    calledMethods.push(init?.method ?? "GET");
    return new Response(JSON.stringify({ ok: true, data: mockCanonicalCreatedDraft }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const newDraft = createNewDraftIntakeModel();

  // Verify that an unpersisted draft does not contain FR-1042 UUID or code
  assert.equal(newDraft.freightRequestId, "");
  assert.equal(newDraft.requestId, "");
  assert.ok(newDraft.freightRequestId !== FR1042_UUID);

  // When creating the draft, it sends POST to /api/freight-requests/drafts, never PATCH to FR-1042
  await createFreightRequestDraft({ fields: { originCity: "Lima" } }, undefined, spyFetcher);

  for (let i = 0; i < calledUrls.length; i++) {
    assert.ok(!calledUrls[i].includes(FR1042_UUID), `URL must not contain FR-1042 UUID: ${calledUrls[i]}`);
    assert.ok(!calledUrls[i].includes(FR1042_CODE), `URL must not contain FR-1042 code: ${calledUrls[i]}`);
    if (calledMethods[i] === "PATCH") {
      assert.fail(`Must not execute PATCH for a new draft: ${calledUrls[i]}`);
    }
  }
});
