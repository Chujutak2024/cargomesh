/**
 * Adapter unit tests: adaptV2ToLegacyService
 *
 * Verifies that the V2 flat public input is correctly transformed to the
 * legacy { fields: ManualFreightRequestIntakeFields } shape that the service
 * parser expects.
 *
 * Key regression: if the adapter output is not { fields: {...} }, then
 * parseCreateFreightRequestDraftInput will throw:
 *   "El payload admite únicamente la clave 'fields'."
 * These tests catch that class of bug at the unit level.
 *
 * Run: tsx --test src/server/hono/adapters/freight-request-adapter.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adaptV2ToLegacyService } from "./freight-request-adapter";
import type { CreateFreightRequestInput } from "@/shared/schemas/freight-request";

const BASE_INPUT: CreateFreightRequestInput = {
  originCity: "Callao",
  originCountry: "PE",
  destinationCity: "Santiago",
  destinationCountry: "CL",
  cargoWeightKg: 8000,
  packageCount: 10,
  isCrossBorder: true,
  transportMode: "ROAD",
  serviceType: "FTL",
  strategy: "BALANCED",
  requiresRefrigeration: false,
  isHazardous: false,
  isFragile: false,
  isOversized: false,
};

describe("adaptV2ToLegacyService — structural contract", () => {
  it("output has exactly ONE key: 'fields'", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    const keys = Object.keys(result);
    assert.deepEqual(keys, ["fields"], `Expected only 'fields' key, got: ${keys.join(", ")}`);
  });

  it("'fields' is a plain object", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.ok(
      typeof result.fields === "object" && result.fields !== null && !Array.isArray(result.fields),
    );
  });

  it("regression: output is not a flat object (would break parseCreateFreightRequestDraftInput)", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    // If result had originCity at top level, parser would throw
    assert.ok(
      !Object.hasOwn(result, "originCity"),
      "originCity must not be at top level",
    );
    assert.ok(
      !Object.hasOwn(result, "cargoWeightKg"),
      "cargoWeightKg must not be at top level",
    );
    assert.ok(
      !Object.hasOwn(result, "packageCount"),
      "packageCount must not be at top level",
    );
  });
});

describe("adaptV2ToLegacyService — field mapping", () => {
  it("maps originCountry (uppercased)", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, originCountry: "pe" });
    assert.equal(result.fields.originCountry, "PE");
  });

  it("maps destinationCountry (uppercased)", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, destinationCountry: "cl" });
    assert.equal(result.fields.destinationCountry, "CL");
  });

  it("maps originCity", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.equal(result.fields.originCity, "Callao");
  });

  it("maps destinationCity", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.equal(result.fields.destinationCity, "Santiago");
  });

  it("maps cargoWeightKg → totalWeightKg", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.equal(result.fields.totalWeightKg, 8000);
  });

  it("maps packageCount → entryQuantity", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.equal(result.fields.entryQuantity, 10);
  });

  it("maps budgetUsd → budgetMax when provided", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, budgetUsd: 2000 });
    assert.equal(result.fields.budgetMax, 2000);
  });

  it("does NOT set budgetMax when budgetUsd is omitted", () => {
    const { budgetUsd: _omit, ...inputWithoutBudget } = { ...BASE_INPUT, budgetUsd: undefined };
    const result = adaptV2ToLegacyService(inputWithoutBudget as CreateFreightRequestInput);
    assert.ok(!Object.hasOwn(result.fields, "budgetMax"), "budgetMax should not be set");
  });

  it("does NOT set budgetMax when budgetUsd is null", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, budgetUsd: null });
    assert.ok(!Object.hasOwn(result.fields, "budgetMax"), "budgetMax should not be set for null");
  });

  it("maps cargoDescription when provided", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, cargoDescription: "Mining equipment" });
    assert.equal(result.fields.cargoDescription, "Mining equipment");
  });

  it("does NOT set cargoDescription when omitted", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.ok(!Object.hasOwn(result.fields, "cargoDescription"));
  });
});

describe("adaptV2ToLegacyService — special handling flags", () => {
  it("sets isHazardous: true when true", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, isHazardous: true });
    assert.equal(result.fields.isHazardous, true);
  });

  it("does NOT set isHazardous when false (not in fields)", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, isHazardous: false });
    assert.ok(!Object.hasOwn(result.fields, "isHazardous"));
  });

  it("sets isFragile: true when true", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, isFragile: true });
    assert.equal(result.fields.isFragile, true);
  });

  it("sets isOversized: true when true", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, isOversized: true });
    assert.equal(result.fields.isOversized, true);
  });

  it("sets requiresRefrigeration: true when true", () => {
    const result = adaptV2ToLegacyService({ ...BASE_INPUT, requiresRefrigeration: true });
    assert.equal(result.fields.requiresRefrigeration, true);
  });
});

describe("adaptV2ToLegacyService — excluded fields (service contract enforcement)", () => {
  it("does NOT include transportMode in fields (service hardcodes ROAD)", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.ok(!Object.hasOwn(result.fields, "transportMode"), "transportMode must not be in fields");
  });

  it("does NOT include serviceType in fields (service hardcodes FTL)", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.ok(!Object.hasOwn(result.fields, "serviceType"), "serviceType must not be in fields");
  });

  it("does NOT include strategy in fields (service hardcodes BALANCED)", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.ok(!Object.hasOwn(result.fields, "strategy"), "strategy must not be in fields");
  });

  it("does NOT include isCrossBorder in fields (service derives from countries)", () => {
    const result = adaptV2ToLegacyService(BASE_INPUT);
    assert.ok(!Object.hasOwn(result.fields, "isCrossBorder"), "isCrossBorder must not be in fields");
    assert.ok(!Object.hasOwn(result.fields, "cross_border"), "cross_border must not be in fields");
  });

  it("does NOT include any prohibited identity fields", () => {
    const prohibited = [
      "organizationId", "organization_id",
      "memberId", "member_id",
      "requestCode", "code",
      "id", "status",
      "draftVersion", "draft_version",
    ];
    const result = adaptV2ToLegacyService(BASE_INPUT);
    for (const key of prohibited) {
      assert.ok(
        !Object.hasOwn(result.fields, key),
        `Prohibited key '${key}' must not appear in fields`,
      );
    }
  });
});
