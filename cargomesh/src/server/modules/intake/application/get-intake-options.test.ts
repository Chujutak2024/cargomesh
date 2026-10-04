import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getIntakeOptions,
  type CargoCategoryRecord,
  type IntakeOptionsRepository,
} from "./get-intake-options";

const codes = [
  "GENERAL", "FOOD", "PHARMA", "CHEMICAL", "MACHINERY",
  "CONSTRUCTION", "AGRICULTURAL", "LIQUID",
];
const organizationId = "a0000000-0000-4000-8000-000000000001";
const actor = { organizationId, memberId: "b0000000-0000-4000-8000-000000000001" };

function category(code: string, index: number): CargoCategoryRecord {
  return {
    id: `c0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    code, name: code, active: true,
    recommended_entry_methods: ["PALLETS"],
    intake_specification_schema: { fields: ["weight"] },
    suggested_requirements: {},
    recommended_vehicle_classes: ["REFRIGERATED_TRUCK"],
  };
}

function repository(): IntakeOptionsRepository {
  return {
    listActiveFacilities: async () => [{
      id: "f0000000-0000-4000-8000-000000000001", organization_id: organizationId,
      code: "LIMA", name: "Planta Lima", country_code: "PE", region_code: "LIM",
      city: "Lima", latitude: -12.05, longitude: -77.04, active: true,
    }],
    listActiveCargoCategories: async () => codes.map(category),
    listSupportedRoadEquipment: async () => [{
      code: "REEFER_TRUCK", label: "Camión refrigerado", mode: "ROAD",
    }],
  };
}

describe("V2 intake options application service", () => {
  it("returns tenant facilities and all eight categories with non-null guidance", async () => {
    const result = await getIntakeOptions(actor, repository());
    assert.equal(result.schemaVersion, "2.0");
    assert.equal(result.data.facilities.length, 1);
    assert.equal(result.data.cargoCategories.length, 8);
    assert.deepEqual(result.data.cargoCategories.map((item) => item.code), codes);
    assert.equal(result.data.equipmentOptions[0]?.code, "REEFER_TRUCK");
    assert.deepEqual(result.data.packagingOptions.map((item) => item.code),
      ["PALLET", "BOX", "CRATE", "DRUM", "BULK"]);
    assert.ok(result.data.packagingOptions.every((item) => item.verification === "CAPTURE_ONLY"));
    assert.deepEqual(result.data.requirementOptions.map((item) => [item.code, item.verification]), [
      ["TEMP_CONTROLLED", "RESOURCE_EVIDENCE"],
      ["SECURITY_SEAL", "RESOURCE_EVIDENCE"],
      ["FRAGILE", "REQUIRES_REVIEW"],
      ["HAZARDOUS", "REQUIRES_REVIEW"],
    ]);
  });

  it("fails closed if the repository returns another tenant's facility", async () => {
    const repo = repository();
    const original = repo.listActiveFacilities;
    repo.listActiveFacilities = async (id) => (await original(id)).map((item) => ({
      ...item, organization_id: "a0000000-0000-4000-8000-000000000002",
    }));
    await assert.rejects(() => getIntakeOptions(actor, repo), /FORBIDDEN_TENANT/);
  });

  it("uses active categories from the database rather than requiring the original eight", async () => {
    const repo = repository();
    repo.listActiveCargoCategories = async () => codes.slice(0, 7).map(category);
    assert.equal((await getIntakeOptions(actor, repo)).data.cargoCategories.length, 7);
    repo.listActiveCargoCategories = async () => [category("MINERALS", 0)];
    assert.equal((await getIntakeOptions(actor, repo)).data.cargoCategories[0].code, "MINERALS");
    repo.listActiveCargoCategories = async () => [];
    await assert.rejects(() => getIntakeOptions(actor, repo), /CATALOG_NOT_READY/);
  });

  it("rejects null guidance", async () => {
    const repo = repository();
    repo.listActiveCargoCategories = async () => codes.map((code, index) => ({
      ...category(code, index), recommended_entry_methods: index === 2 ? null : ["PALLETS"],
    }));
    await assert.rejects(() => getIntakeOptions(actor, repo), /CATALOG_NOT_READY/);
  });

  it("returns an empty facility list without inventing coverage", async () => {
    const repo = repository();
    repo.listActiveFacilities = async () => [];
    const result = await getIntakeOptions(actor, repo);
    assert.deepEqual(result.data.facilities, []);
  });
});
