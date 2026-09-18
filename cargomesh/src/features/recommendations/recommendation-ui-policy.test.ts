import assert from "node:assert/strict";
import test from "node:test";

import { createFreightIntakeFixture } from "@/features/freight-ui/ui-fixtures";
import { buildProviderRunnerInputs } from "@/features/freight-ui/int02a-client";
import type { RecommendationProposedFields } from "./contracts";
import {
  applyFreightRequestDraftToIntake,
  persistAndRevalidateRecommendation,
  RecommendationAcceptanceError,
} from "./recommendation-acceptance";
import {
  applyRecommendationFieldsToIntake,
  buildRecommendationDiff,
  canonicalValuesFromIntake,
  classifyRecommendationResult,
  selectApplicableRecommendationFields,
} from "./recommendation-ui-policy";

test("only explicitly selected canonical fields are applied", () => {
  const form = createFreightIntakeFixture();
  const proposed: RecommendationProposedFields = {
    cargo_entry_method: "PALLETS",
    entry_quantity: 7,
    entry_unit_weight_kg: 950,
    budget_max: 1750,
  };
  const selected = selectApplicableRecommendationFields(
    form,
    proposed,
    new Set(["entry_quantity", "budget_max"]),
  );
  const updated = applyRecommendationFieldsToIntake(form, selected);

  assert.equal(updated.quantity, 7);
  assert.equal(updated.budgetMaxUsd, 1750);
  assert.equal(updated.unitWeightKg, form.unitWeightKg);
  assert.equal(updated.entryMethod, form.entryMethod);
});

test("canceling with no selected fields preserves the same draft", () => {
  const form = createFreightIntakeFixture();
  const selected = selectApplicableRecommendationFields(
    form,
    { budget_max: 1800 },
    new Set(),
  );
  assert.strictEqual(applyRecommendationFieldsToIntake(form, selected), form);
});

test("aliases, implicit groups, weight and volume are never selectable", () => {
  const form = createFreightIntakeFixture();
  const unsafe = {
    originCountry: "PE",
    route: { origin_country: "PE" },
    cargo_weight_kg: 5000,
    cargo_volume_m3: 12,
  } as unknown as RecommendationProposedFields;
  const selected = selectApplicableRecommendationFields(
    form,
    unsafe,
    new Set(["origin_country"]),
  );
  assert.deepEqual(selected, {});
});

test("TOTAL_WEIGHT excludes every unitized field even when selected", () => {
  const form = createFreightIntakeFixture();
  const proposed: RecommendationProposedFields = {
    cargo_entry_method: "TOTAL_WEIGHT",
    entry_quantity: 8,
    entry_unit_weight_kg: 600,
    units_per_entry: 2,
    budget_max: 1900,
  };
  const selected = selectApplicableRecommendationFields(
    form,
    proposed,
    new Set([
      "cargo_entry_method",
      "entry_quantity",
      "entry_unit_weight_kg",
      "units_per_entry",
      "budget_max",
    ]),
  );
  assert.deepEqual(selected, {
    cargo_entry_method: "TOTAL_WEIGHT",
    budget_max: 1900,
  });
});

test("diff exposes exact canonical names from the complete form whitelist", () => {
  const rows = buildRecommendationDiff(createFreightIntakeFixture(), {
    origin_country: "CL",
    budget_max: 1800,
  });
  assert.deepEqual(rows.map(({ field, selectable }) => ({ field, selectable })), [
    { field: "origin_country", selectable: true },
    { field: "budget_max", selectable: true },
  ]);
});

test("route, contacts, category and description update the visible operational draft", () => {
  const form = createFreightIntakeFixture();
  const proposed: RecommendationProposedFields = {
    origin_country: "CL",
    origin_city: "Arica",
    origin_address: "Puerto de Arica",
    pickup_contact_name: "Ana",
    pickup_contact_phone: "+56 9000",
    destination_country: "PE",
    destination_city: "Tacna",
    receiver_name: "Luis",
    receiver_company: "Destino SpA",
    receiver_phone: "+51 8000",
    cargo_category_id: "c0000000-0000-0000-0000-000000000099",
    cargo_description: "Carga general",
  };
  const selected = selectApplicableRecommendationFields(
    form,
    proposed,
    new Set(Object.keys(proposed) as Array<keyof RecommendationProposedFields>),
  );
  const updated = applyRecommendationFieldsToIntake(form, selected);
  assert.equal(updated.origin, "Puerto de Arica, Arica, CL");
  assert.equal(updated.destination, "Tacna, PE");
  assert.equal(updated.pickupContact, "Ana · +56 9000");
  assert.equal(updated.deliveryContact, "Luis · Destino SpA · +51 8000");
  assert.equal(updated.cargoCategoryId, proposed.cargo_category_id);
  assert.equal(updated.cargoDescription, "Carga general");
});

test("D1-01 acceptance revalidates a newer canonical draft before provider inputs change", async () => {
  const form = createFreightIntakeFixture();
  const fields: RecommendationProposedFields = {
    origin_city: "Arica",
    destination_city: "Tacna",
    pickup_contact_name: "Ana",
    cargo_description: "Carga general",
  };
  const persisted = await persistAndRevalidateRecommendation(
    form,
    fields,
    async (input) => {
      assert.equal(input.draftVersion, 1);
      return {
        schemaVersion: "1.0",
        freightRequestId: form.freightRequestId,
        requestCode: form.requestId,
        draftVersion: 2,
        fields: {
          ...canonicalValuesFromIntake(form),
          ...input.acceptedFields,
        },
        normalized: {
          cargoWeightKg: 8_000,
          cargoVolumeM3: 18,
        },
      };
    },
    new AbortController().signal,
  );
  const inputs = buildProviderRunnerInputs(persisted, {
    schemaVersion: "1.0",
    freightRequestId: persisted.freightRequestId,
    requestCode: persisted.requestId,
    status: "PENDING",
    pickupMode: persisted.pickupMode,
    requiredPickup: persisted.requiredPickup,
    pickupWindowStart: persisted.pickupWindowStart,
    pickupWindowEnd: persisted.pickupWindowEnd,
    deliveryDeadline: persisted.deliveryDeadline,
    updatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(persisted.draftVersion, 2);
  assert.equal(inputs.check_service_coverage.origin, "Callao, Arica, PE");
  assert.equal(inputs.check_service_coverage.destination, "Tacna, CL");
  assert.equal(inputs.check_service_coverage.cargo_category, "MACHINERY");
});

test("canonical adoption clears a previous SCHEDULED window when the server returns ASAP", () => {
  const current = createFreightIntakeFixture();
  const fields = canonicalValuesFromIntake(current);
  fields.pickup_mode = "ASAP";
  delete fields.pickup_window_start;
  delete fields.pickup_window_end;

  const adopted = applyFreightRequestDraftToIntake(current, {
    schemaVersion: "1.0",
    freightRequestId: current.freightRequestId,
    requestCode: current.requestId,
    draftVersion: 2,
    fields,
    normalized: { cargoWeightKg: 8_000, cargoVolumeM3: 18 },
  });

  assert.equal(adopted.pickupMode, "ASAP");
  assert.equal(adopted.requiredPickup, "");
  assert.equal(adopted.pickupWindowStart, "");
  assert.equal(adopted.pickupWindowEnd, "");
  assert.equal(adopted.recommendationValues.pickup_window_start, undefined);
  assert.equal(adopted.recommendationValues.pickup_window_end, undefined);
});

test("canonical adoption clears an address omitted by the server", () => {
  const current = createFreightIntakeFixture();
  const fields = canonicalValuesFromIntake(current);
  delete fields.origin_address;

  const adopted = applyFreightRequestDraftToIntake(current, {
    schemaVersion: "1.0",
    freightRequestId: current.freightRequestId,
    requestCode: current.requestId,
    draftVersion: 2,
    fields,
    normalized: { cargoWeightKg: 8_000, cargoVolumeM3: 18 },
  });

  assert.equal(adopted.originAddress, "");
  assert.equal(adopted.origin, "Lima, PE");
  assert.equal(adopted.recommendationValues.origin_address, undefined);
});

test("fields without visible operational support remain comparison-only", () => {
  const rows = buildRecommendationDiff(createFreightIntakeFixture(), {
    is_hazardous: true,
    cargo_specifications: { note: "restricted" },
  });
  assert.deepEqual(rows.map(({ field, selectable }) => ({ field, selectable })), [
    { field: "cargo_specifications", selectable: false },
    { field: "is_hazardous", selectable: false },
  ]);
});

test("STALE_DRAFT during D1-01 acceptance rejects without mutating the current draft", async () => {
  const form = createFreightIntakeFixture();
  const snapshot = structuredClone(form);
  await assert.rejects(
    persistAndRevalidateRecommendation(
      form,
      { origin_city: "Arica" },
      async () => {
        throw new RecommendationAcceptanceError(
          "STALE_DRAFT",
          "El borrador cambió en el servidor.",
        );
      },
      new AbortController().signal,
    ),
    (error: unknown) => error instanceof RecommendationAcceptanceError && error.code === "STALE_DRAFT",
  );
  assert.deepEqual(form, snapshot);
});

test("STALE_DRAFT is classified separately from ordinary errors and empty results", () => {
  assert.equal(classifyRecommendationResult({
    ok: false,
    error: { code: "STALE_DRAFT", message: "stale", retryable: false },
  }), "stale");
  assert.equal(classifyRecommendationResult({
    ok: true,
    data: {
      schemaVersion: "1.0",
      freightRequestId: "f2000000-0000-0000-0000-000000000001",
      draftVersion: 1,
      suggestions: [],
    },
  }), "empty");
});

test("buildRecommendationDiff marks unitized fields unselectable when proposed method is TOTAL_WEIGHT", () => {
  const form = createFreightIntakeFixture();
  const rows = buildRecommendationDiff(form, {
    cargo_entry_method: "TOTAL_WEIGHT",
    entry_quantity: 15,
    entry_unit_weight_kg: 500,
    units_per_entry: 1,
  });
  const quantityRow = rows.find((r) => r.field === "entry_quantity");
  assert.ok(quantityRow, "entry_quantity row should exist");
  assert.equal(quantityRow.selectable, false);
  assert.equal(
    quantityRow.unselectableReason,
    "No combinable con carga a granel (TOTAL_WEIGHT).",
  );
  const methodRow = rows.find((r) => r.field === "cargo_entry_method");
  assert.ok(methodRow, "cargo_entry_method row should exist");
  assert.equal(methodRow.selectable, true);
});
