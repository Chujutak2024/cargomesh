import assert from "node:assert/strict";
import test from "node:test";

import { __test__ } from "./recommendation-draft-contracts";

const row = {
  id: "f2000000-0000-0000-0000-000000000001",
  code: "FR-D1-TEST",
  organization_id: "a0000000-0000-0000-0000-000000000001",
  draft_version: 3,
  cargo_category_id: "c0000000-0000-0000-0000-000000000001",
  origin_country: "PE",
  origin_city: "Lima",
  origin_address: "Av. Industrial 100",
  pickup_contact_name: "Ana Pérez",
  pickup_contact_phone: "+51 999 000 111",
  destination_country: "PE",
  destination_city: "Arequipa",
  destination_address: "Av. Logística 200",
  receiver_name: "Diego Ramos",
  receiver_company: "Destino SAC",
  receiver_phone: "+51 999 000 222",
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
  cross_border: false,
  cargo_weight_kg: 600,
  cargo_volume_m3: 0.12,
  service_type: "FTL",
  transport_mode: "ROAD",
  status: "PENDING",
} as never;

test("writer payload is closed and requires an explicit selected field", () => {
  assert.throws(
    () => __test__.parseApplyInput({ draftVersion: 3, proposedFields: {}, extra: true }),
    /únicamente draftVersion y proposedFields/,
  );
  assert.throws(
    () => __test__.parseApplyInput({ draftVersion: 3, proposedFields: { cargo_weight_kg: 500 } }),
    /no es canónico/,
  );
});

test("unitized normalization includes units_per_entry in weight and volume", () => {
  const normalized = __test__.normalizedDraft(row, {
    entry_quantity: 4,
    entry_unit_weight_kg: 250,
    units_per_entry: 2,
    entry_length_cm: 120,
    entry_width_cm: 100,
    entry_height_cm: 50,
  });
  assert.equal(normalized.cargoWeightKg, 2000);
  assert.equal(normalized.cargoVolumeM3, 4.8);
});

test("TOTAL_WEIGHT rejects unitized recommendation fields and preserves canonical totals", () => {
  assert.throws(
    () => __test__.normalizedDraft(row, {
      cargo_entry_method: "TOTAL_WEIGHT",
      entry_quantity: 3,
    }),
    /entry_quantity no se aplica con TOTAL_WEIGHT/,
  );

  const normalized = __test__.normalizedDraft(row, { cargo_entry_method: "TOTAL_WEIGHT" });
  assert.equal(normalized.cargoWeightKg, 600);
  assert.equal(normalized.cargoVolumeM3, 0.12);
  assert.equal(normalized.fields.entry_quantity, undefined);
  assert.equal(normalized.fields.units_per_entry, undefined);
});

test("cross_border is derived from the selected route and cannot contradict it", () => {
  assert.throws(
    () => __test__.normalizedDraft(row, {
      destination_country: "CL",
      cross_border: false,
    }),
    /cross_border debe coincidir/,
  );

  const normalized = __test__.normalizedDraft(row, { destination_country: "CL" });
  assert.equal(normalized.fields.cross_border, true);
});
