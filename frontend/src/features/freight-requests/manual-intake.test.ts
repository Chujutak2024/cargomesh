import assert from "node:assert/strict";
import test from "node:test";

import { parseManualFreightRequestIntakeInput } from "./manual-intake-contracts";
import { normalizeManualFreightRequestIntake } from "./manual-intake-normalizer";

const row = {
  id: "f2000000-0000-0000-0000-000000000001",
  code: "FR-MANUAL-TEST",
  organization_id: "a0000000-0000-0000-0000-000000000001",
  draft_version: 3,
  cargo_category_id: "c0000000-0000-0000-0000-000000000001",
  origin_country: "PE",
  origin_region: "Callao",
  origin_city: "Callao",
  origin_address: "Av. Néstor Gambetta 100",
  pickup_contact_name: "Ana Pérez",
  pickup_contact_phone: "+51 999 000 111",
  destination_country: "CL",
  destination_region: "Región Metropolitana",
  destination_city: "Santiago",
  destination_address: "Av. Logística 200",
  receiver_name: "Diego Ramos",
  receiver_company: "Destino SAC",
  receiver_phone: "+56 999 000 222",
  cargo_description: "Repuestos industriales",
  cargo_entry_method: "PALLETS",
  entry_quantity: 2,
  entry_unit_weight_kg: 100,
  units_per_entry: 3,
  entry_length_cm: 100,
  entry_width_cm: 50,
  entry_height_cm: 40,
  package_count: 2,
  cargo_specifications: {},
  requires_refrigeration: false,
  temperature_min_c: null,
  temperature_max_c: null,
  is_hazardous: false,
  is_fragile: false,
  is_oversized: false,
  is_high_value: false,
  is_stackable: true,
  special_instructions: null,
  pickup_mode: "SCHEDULED",
  pickup_window_start: "2026-09-10T13:00:00Z",
  pickup_window_end: "2026-09-10T17:00:00Z",
  required_pickup: "2026-09-10T13:00:00Z",
  delivery_deadline: "2026-09-12T13:00:00Z",
  budget_max: 1000,
  optimization_strategy: "BALANCED",
  available_documents: ["PACKING_LIST"],
  cross_border: true,
  cargo_weight_kg: 600,
  cargo_volume_m3: 0.12,
  service_type: "FTL",
  transport_mode: "ROAD",
  status: "PENDING",
} as never;

test("manual payload is closed, uses official category codes, and has a draft version", () => {
  assert.throws(
    () => parseManualFreightRequestIntakeInput({ draftVersion: 3, fields: { cargoCategoryCode: "OTHER" } }),
    /categorías oficiales/,
  );
  assert.throws(
    () => parseManualFreightRequestIntakeInput({ draftVersion: 3, fields: { cargoCategoryCode: "MACHINERY" }, extra: true }),
    /únicamente draftVersion y fields/,
  );
  const result = parseManualFreightRequestIntakeInput({
    draftVersion: 3,
    fields: { cargoCategoryCode: "MACHINERY", originCountry: "pe", originRegion: "Lima" },
  });
  assert.equal(result.fields.originCountry, "PE");
  assert.equal(result.fields.cargoCategoryCode, "MACHINERY");
});

test("manual unitized edits include units per entry in canonical totals", () => {
  const normalized = normalizeManualFreightRequestIntake(row, {
    entryQuantity: 4,
    entryUnitWeightKg: 250,
    unitsPerEntry: 2,
    entryLengthCm: 120,
    entryWidthCm: 100,
    entryHeightCm: 50,
  }, undefined, new Date("2026-09-01T10:00:00.000Z"));
  assert.equal(normalized.normalized.cargoWeightKg, 2000);
  assert.equal(normalized.normalized.cargoVolumeM3, 4.8);
});

test("manual ASAP edit clears a scheduled window and uses server time for required pickup", () => {
  const now = new Date("2026-09-01T10:00:00.000Z");
  const normalized = normalizeManualFreightRequestIntake(row, {
    pickupMode: "ASAP",
    originRegion: null,
  }, undefined, now);
  assert.equal(normalized.normalized.fields.pickup_window_start, undefined);
  assert.equal(normalized.normalized.fields.pickup_window_end, undefined);
  assert.equal(normalized.requiredPickup, now.toISOString());
  assert.equal(normalized.originRegion, null);
});

test("manual TOTAL_WEIGHT accepts a user-entered total but does not allow it for unitized cargo", () => {
  const totalWeight = normalizeManualFreightRequestIntake(row, {
    cargoEntryMethod: "TOTAL_WEIGHT",
    totalWeightKg: 850,
  }, undefined);
  assert.equal(totalWeight.normalized.cargoWeightKg, 850);
  assert.throws(
    () => normalizeManualFreightRequestIntake(row, { totalWeightKg: 850 }, undefined),
    /solo se aplica con TOTAL_WEIGHT/,
  );
});

test("manual scheduled edits retain server validation for coherent dates", () => {
  assert.throws(
    () => normalizeManualFreightRequestIntake(row, {
      pickupWindowStart: "2026-09-10T17:00:00.000Z",
      pickupWindowEnd: "2026-09-10T13:00:00.000Z",
    }, undefined),
    /pickup_window_end debe ser posterior/,
  );
});

test("buildManualIntakeFieldsFromForm maps form model into manual intake contract fields", async () => {
  const { buildManualIntakeFieldsFromForm } = await import("./manual-intake-client");
  const form = {
    cargoCategoryCode: "MACHINERY",
    originCountry: "PE",
    originRegion: "Callao",
    originCity: "Callao",
    originAddress: "Av. Néstor Gambetta 100",
    destinationCountry: "CL",
    destinationRegion: "Región Metropolitana",
    destinationCity: "Santiago",
    destinationAddress: "Av. Logística 200",
    pickupContactName: "Ana Pérez",
    pickupContactPhone: "+51 999 000 111",
    receiverName: "Diego Ramos",
    receiverCompany: "Destino SAC",
    receiverPhone: "+56 999 000 222",
    cargoDescription: "Repuestos",
    entryMethod: "PALLETS",
    quantity: 2,
    unitWeightKg: 100,
    unitsPerEntry: 3,
    lengthCm: 100,
    widthCm: 50,
    heightCm: 40,
    totalWeightKg: 600,
    totalVolumeM3: 0.12,
    pickupMode: "SCHEDULED" as const,
    pickupWindowStart: "2026-09-10T13:00:00.000Z",
    pickupWindowEnd: "2026-09-10T17:00:00.000Z",
    deliveryDeadline: "2026-09-12T13:00:00.000Z",
    budgetMaxUsd: 1000,
    operationalNotes: "Urgente",
    documents: ["Factura comercial"],
  } as any;

  const fields = buildManualIntakeFieldsFromForm(form);
  assert.equal(fields.cargoCategoryCode, "MACHINERY");
  assert.equal(fields.originCountry, "PE");
  assert.equal(fields.originRegion, "Callao");
  assert.equal(fields.destinationCountry, "CL");
  assert.equal(fields.destinationRegion, "Región Metropolitana");
  assert.equal(fields.pickupContactName, "Ana Pérez");
  assert.equal(fields.receiverName, "Diego Ramos");
  assert.equal(fields.budgetMax, 1000);
  assert.equal(fields.pickupMode, "SCHEDULED");
});

test("persistManualFreightRequestIntake maps HTTP 409 into STALE_DRAFT error", async () => {
  const { persistManualFreightRequestIntake, ManualFreightRequestIntakeClientError } = await import("./manual-intake-client");
  const fakeFetch = async () => new Response(
    JSON.stringify({ ok: false, error: { code: "STALE_DRAFT", message: "Draft version mismatch" } }),
    { status: 409, headers: { "Content-Type": "application/json" } }
  );

  await assert.rejects(
    () => persistManualFreightRequestIntake("req-1", { draftVersion: 1, fields: {} }, new AbortController().signal, fakeFetch as any),
    (error: any) => error instanceof ManualFreightRequestIntakeClientError && error.code === "STALE_DRAFT"
  );
});
