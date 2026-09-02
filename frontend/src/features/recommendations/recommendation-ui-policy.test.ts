import assert from "node:assert/strict";
import test from "node:test";

import { createFreightIntakeFixture } from "@/features/freight-ui/ui-fixtures";
import type { RecommendationProposedFields } from "./contracts";
import {
  applyRecommendationFieldsToIntake,
  buildRecommendationDiff,
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
    origin_country: "PE",
    budget_max: 1800,
  });
  assert.deepEqual(rows.map(({ field, selectable }) => ({ field, selectable })), [
    { field: "origin_country", selectable: true },
    { field: "budget_max", selectable: true },
  ]);
});

test("canonical fields without a dedicated legacy control remain in the editable draft", () => {
  const form = createFreightIntakeFixture();
  const selected = selectApplicableRecommendationFields(
    form,
    { origin_country: "CL", receiver_company: "Destino SpA" },
    new Set(["origin_country", "receiver_company"]),
  );
  const updated = applyRecommendationFieldsToIntake(form, selected);
  assert.equal(updated.recommendationValues.origin_country, "CL");
  assert.equal(updated.recommendationValues.receiver_company, "Destino SpA");
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
