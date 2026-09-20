import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanonicalFreightRequestDraftModel,
  createNewDraftIntakeModel,
  createFreightIntakeFixture,
} from "@/features/freight-ui/ui-fixtures";
import {
  getFreightIntakeDispatchBlockReason,
  resolveIntakeRequestCode,
  mapFreightRequestIntakeToForm,
} from "./intake-ui-adapter";
import { buildHonoFreightRequestInputFromForm } from "./manual-intake-client";
import {
  createFreightRequest,
  FreightRequestHonoClientError,
  submitFreightRequest,
} from "@/server/hono/client";
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
    description: "Repuestos para molienda",
    entryMethod: "PALLETS",
    quantity: 5,
    unitsPerEntry: 1,
    unitWeightKg: 1000,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 140,
    totalWeightKg: 5000,
    totalVolumeM3: 8.4,
    requiresRefrigeration: false,
    temperatureMinC: null,
    temperatureMaxC: null,
    isHazardous: false,
    isOversized: false,
    isFragile: false,
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

const mockCanonicalSubmittedDraft: FreightRequestIntakeViewModel = {
  ...mockCanonicalCreatedDraft,
  draftVersion: 2,
  status: "PENDING",
};

test("1. Unpersisted new draft initializes with source 'new-draft', empty IDs, and draftVersion 0 without touching FR-1042", () => {
  const model = createNewDraftIntakeModel();

  assert.equal(model.source, "new-draft");
  assert.equal(model.freightRequestId, "");
  assert.equal(model.requestId, "");
  assert.equal(model.draftVersion, 0);
  assert.notEqual(model.freightRequestId, FR1042_UUID);
  assert.notEqual(model.requestId, FR1042_CODE);
  assert.equal(model.originCity, "");
  assert.equal(model.destinationCity, "");

  const canonical = createCanonicalFreightRequestDraftModel(new Date("2026-09-20T12:00:00.000Z"));
  assert.equal(canonical.originRegion, "Callao");
  assert.equal(canonical.destinationCity, "Santiago");
  assert.equal(canonical.quantity, 10);
  assert.equal(canonical.source, "new-draft");

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

test("3. Hono V2 POST creates a typed DRAFT v1 and adopts the canonical snapshot", async () => {
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

  const form = createCanonicalFreightRequestDraftModel();
  form.cargoDescription = "Repuestos mineros de prueba";
  const input = buildHonoFreightRequestInputFromForm(form);

  const result = await createFreightRequest(input, undefined, mockFetcher);

  assert.equal(requestedUrl, "/api/v2/freight/requests");
  assert.equal(requestedMethod, "POST");
  assert.equal(requestBody.originCity, "Callao");
  assert.equal(requestBody.destinationCity, "Santiago");
  assert.equal(requestBody.packageCount, 10);
  assert.equal(requestBody.cargoWeightKg, 8000);

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

test("4. Hono V2 creation errors stay actionable and never invent fake IDs", async () => {
  const mockFetcher = (async () => {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "ORGANIZATION_NOT_AUTHORIZED", message: "Membresía inactiva." },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const input = buildHonoFreightRequestInputFromForm(
    createCanonicalFreightRequestDraftModel(),
  );

  await assert.rejects(
    async () => {
      await createFreightRequest(input, undefined, mockFetcher);
    },
    (err: any) => {
      assert.ok(err instanceof FreightRequestHonoClientError);
      assert.equal(err.code, "ORGANIZATION_NOT_AUTHORIZED");
      assert.match(err.message, /Membresía inactiva/);
      return true;
    },
  );
});

test("5. Hono V2 payload preserves the supported special-handling flags", async () => {
  let capturedBody: any = null;

  const mockFetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true, data: mockCanonicalCreatedDraft }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const form = createCanonicalFreightRequestDraftModel();
  form.originCity = "Ica";
  form.requiresRefrigeration = true;
  form.temperatureMinC = 2;
  form.temperatureMaxC = 6;
  form.isHazardous = true;
  form.isOversized = false;
  form.isFragile = true;
  const input = buildHonoFreightRequestInputFromForm(form);

  await createFreightRequest(input, undefined, mockFetcher);

  assert.equal(capturedBody.requiresRefrigeration, true);
  assert.equal(capturedBody.isHazardous, true);
  assert.equal(capturedBody.isFragile, true);
  assert.equal(capturedBody.isOversized, false);
});

test("6. Create and submit use only Hono V2 and send expected_draft_version", async () => {
  const calledUrls: string[] = [];
  const calledMethods: string[] = [];
  const calledBodies: any[] = [];

  const spyFetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calledUrls.push(String(url));
    calledMethods.push(init?.method ?? "GET");
    calledBodies.push(JSON.parse(String(init?.body)));
    const isSubmit = String(url).endsWith("/submit");
    return new Response(JSON.stringify({
      ok: true,
      data: isSubmit ? mockCanonicalSubmittedDraft : mockCanonicalCreatedDraft,
    }), {
      status: isSubmit ? 200 : 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const newDraft = createCanonicalFreightRequestDraftModel();

  // Verify that an unpersisted draft does not contain FR-1042 UUID or code
  assert.equal(newDraft.freightRequestId, "");
  assert.equal(newDraft.requestId, "");

  const created = await createFreightRequest(
    buildHonoFreightRequestInputFromForm(newDraft),
    undefined,
    spyFetcher,
  );
  const submitted = await submitFreightRequest(
    created.freightRequestId,
    created.draftVersion,
    undefined,
    spyFetcher,
  );

  assert.equal(calledUrls[0], "/api/v2/freight/requests");
  assert.equal(calledUrls[1], `/api/v2/freight/requests/${created.freightRequestId}/submit`);
  assert.deepEqual(calledMethods, ["POST", "POST"]);
  assert.equal(calledBodies[1].expected_draft_version, 1);
  assert.equal(calledBodies[1].draftVersion, 1);
  assert.equal(submitted.status, "PENDING");

  for (let i = 0; i < calledUrls.length; i++) {
    assert.ok(!calledUrls[i].includes(FR1042_UUID), `URL must not contain FR-1042 UUID: ${calledUrls[i]}`);
    assert.ok(!calledUrls[i].includes(FR1042_CODE), `URL must not contain FR-1042 code: ${calledUrls[i]}`);
    assert.ok(!calledUrls[i].startsWith("/api/freight-requests"), `Must not call a legacy endpoint: ${calledUrls[i]}`);
  }
});
