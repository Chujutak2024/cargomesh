import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { auditIntakeOptions, getIntakeOptionsFixture } from "./intake-options";
import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";
import {
  EMPTY_PROTOTYPE_DRAFT,
  PROVISIONAL_PROTOTYPE_DRAFT,
  buildPrototypeExample,
  mapDraftToCreateFreightRequestV2Input,
  toggleRequirement,
  validatePrototypeDraft,
  validatePrototypeReview,
  validatePrototypeStep,
} from "./prototype-model";

test("the local HAC-27 options fixture covers every visible selector", () => {
  const options = getIntakeOptionsFixture();
  assert.deepEqual(auditIntakeOptions(options.data), {
    complete: true,
    emptyFacilities: false,
    missingCatalogGroups: [],
  });
  assert.equal(INTAKE_OPTIONS_FIXTURE.meta?.provenanceStatus, "SIMULATED");
  assert.equal(options.data.cargoCategories.length, 8);
  assert.equal(options.data.facilities[0].facilityId, INTAKE_OPTIONS_FIXTURE.data.facilities[0].id);
  assert.equal(options.data.packagingOptions[0].verification, "CAPTURE_ONLY");
  assert.equal(options.data.requirementOptions[0].verification, "RESOURCE_EVIDENCE");
  assert.equal(options.data.equipmentOptions.some((option) => option.code === "DRY_VAN" || option.code === "LOWBOY"), false);
});

test("the client fixture contains no V1 Callao to Santiago markers", () => {
  const fixture = JSON.stringify({ options: INTAKE_OPTIONS_FIXTURE, draft: PROVISIONAL_PROTOTYPE_DRAFT });
  assert.doesNotMatch(fixture, /ACME|Santiago|FR-1042/i);
  assert.match(fixture, /Lima/);
  assert.match(fixture, /Arequipa/);
  assert.match(fixture, /Piura/);
});

test("step one rejects identical origin and destination facilities", () => {
  const draft = { ...PROVISIONAL_PROTOTYPE_DRAFT, destinationFacilityId: PROVISIONAL_PROTOTYPE_DRAFT.originFacilityId };
  assert.deepEqual(validatePrototypeStep(1, draft), [{ field: "destinationFacilityId", code: "same-facility" }]);
});

test("cargo step maps every required aggregate and units field", () => {
  const issues = validatePrototypeStep(2, EMPTY_PROTOTYPE_DRAFT);
  assert.deepEqual(issues.map((issue) => issue.field), [
    "categoryCode", "packaging", "cargoDescription", "totalWeightKg", "totalVolumeM3",
    "unitPackageType", "unitQuantity", "unitWeightPerUnitKg", "unitVolumePerUnitM3",
    "unitLengthCm", "unitWidthCm", "unitHeightCm",
  ]);
});

test("temperature range is required only for TEMP_CONTROLLED cargo", () => {
  const controlled = validatePrototypeStep(2, {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    temperatureMinCelsius: "",
    temperatureMaxCelsius: "",
  });
  assert.deepEqual(controlled.filter((issue) => issue.field.startsWith("temperature")), [
    { field: "temperatureMinCelsius", code: "required" },
    { field: "temperatureMaxCelsius", code: "required" },
  ]);

  const ambient = validatePrototypeStep(2, {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    requirements: [],
    temperatureMinCelsius: "",
    temperatureMaxCelsius: "",
  });
  assert.equal(ambient.some((issue) => issue.field.startsWith("temperature")), false);
});

test("cargo totals must match quantity times each unit measurement", () => {
  const issues = validatePrototypeStep(2, {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    totalWeightKg: "4801",
    totalVolumeM3: "19.3",
  });
  assert.equal(issues.some((issue) => issue.field === "totalWeightKg" && issue.code === "total-mismatch"), true);
  assert.equal(issues.some((issue) => issue.field === "totalVolumeM3" && issue.code === "total-mismatch"), true);
  assert.deepEqual(validatePrototypeStep(2, PROVISIONAL_PROTOTYPE_DRAFT), []);
});

test("windows preserve pickup and delivery order", () => {
  const issues = validatePrototypeStep(3, {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    pickupWindowEndsAt: "2026-10-05T07:00",
    deliveryWindowStartsAt: "2026-10-05T06:00",
  });
  assert.equal(issues.some((issue) => issue.field === "pickupWindowEndsAt" && issue.code === "invalid-range"), true);
  assert.equal(issues.some((issue) => issue.field === "deliveryWindowStartsAt" && issue.code === "invalid-range"), true);
});

test("contacts enforce email and E.164 without inventing defaults", () => {
  const issues = validatePrototypeStep(3, {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    pickupContactEmail: "not-an-email",
    recipientContactPhoneE164: "999",
  });
  assert.equal(issues.some((issue) => issue.code === "invalid-email"), true);
  assert.equal(issues.some((issue) => issue.code === "invalid-phone"), true);
});

test("the full contract example reaches review", () => {
  assert.deepEqual(validatePrototypeDraft(PROVISIONAL_PROTOTYPE_DRAFT), []);
});

test("review revalidates an earlier step after it was edited", () => {
  assert.equal(validatePrototypeReview(PROVISIONAL_PROTOTYPE_DRAFT).valid, true);
  assert.deepEqual(validatePrototypeReview({ ...PROVISIONAL_PROTOTYPE_DRAFT, cargoDescription: "" }), {
    valid: false,
    invalidStep: 2,
    issues: [{ field: "cargoDescription", code: "required" }],
  });
});

test("draft mapper produces the HAC-27 POST shape without organizationId", () => {
  const payload = mapDraftToCreateFreightRequestV2Input(PROVISIONAL_PROTOTYPE_DRAFT, getIntakeOptionsFixture().data);
  assert.equal(payload.schemaVersion, "2.0");
  assert.deepEqual(payload.acceptedModes, ["ROAD"]);
  assert.equal(payload.origin.facilityId, PROVISIONAL_PROTOTYPE_DRAFT.originFacilityId);
  assert.equal(payload.destination.facilityId, PROVISIONAL_PROTOTYPE_DRAFT.destinationFacilityId);
  assert.equal(payload.cargoSpecification.units.length, 1);
  assert.equal(payload.cargoSpecification.units[0].quantity, 8);
  assert.deepEqual(payload.cargoSpecification.temperatureRange, { minCelsius: 2, maxCelsius: 8 });
  assert.equal(payload.contacts.pickup.phoneE164, "+51987654321");
  assert.equal("organizationId" in payload, false);
  assert.match(payload.pickupWindow.startsAt, /^2026-10-05T/);
});

test("draft mapper only sends codes supplied by the options contract", () => {
  const options = getIntakeOptionsFixture().data;
  assert.throws(
    () => mapDraftToCreateFreightRequestV2Input({ ...PROVISIONAL_PROTOTYPE_DRAFT, requiredEquipment: "DRY_VAN" }, options),
    /EQUIPMENT_OPTION_NOT_FOUND/,
  );
  assert.throws(
    () => mapDraftToCreateFreightRequestV2Input({ ...PROVISIONAL_PROTOTYPE_DRAFT, requirements: ["UNPUBLISHED"] }, options),
    /REQUIREMENT_OPTION_NOT_FOUND/,
  );
});

test("the one-click example uses facility ids and selector codes from the current backend response", () => {
  const fixture = getIntakeOptionsFixture().data;
  const options = {
    ...fixture,
    facilities: fixture.facilities.slice(0, 2).map((facility, index) => ({
      ...facility,
      facilityId: `backend-facility-${index + 1}`,
    })),
    cargoCategories: [{ ...fixture.cargoCategories[0], code: "BACKEND_CATEGORY" }],
    equipmentOptions: [{ ...fixture.equipmentOptions[0], code: "BACKEND_EQUIPMENT" }],
    packagingOptions: [{ ...fixture.packagingOptions[0], code: "BACKEND_PACKAGING" }],
    requirementOptions: [{ ...fixture.requirementOptions[2], code: "BACKEND_REQUIREMENT" }],
  };

  const example = buildPrototypeExample(options);
  assert.equal(example.originFacilityId, "backend-facility-1");
  assert.equal(example.destinationFacilityId, "backend-facility-2");
  assert.equal(example.categoryCode, "BACKEND_CATEGORY");
  assert.equal(example.requiredEquipment, "BACKEND_EQUIPMENT");
  assert.equal(example.packaging, "BACKEND_PACKAGING");
  assert.equal(example.unitPackageType, "BACKEND_PACKAGING");
  assert.deepEqual(example.requirements, []);
  assert.equal(example.temperatureMinCelsius, "");
  assert.equal(example.temperatureMaxCelsius, "");
  assert.doesNotThrow(() => mapDraftToCreateFreightRequestV2Input(example, options));
});

test("the one-click example keeps the HAC-12 positive lane when facilities arrive in another order", () => {
  const fixture = getIntakeOptionsFixture().data;
  const options = {
    ...fixture,
    facilities: [fixture.facilities[1], fixture.facilities[0], fixture.facilities[2]],
  };

  const example = buildPrototypeExample(options);
  assert.equal(example.originFacilityId, fixture.facilities[0].facilityId);
  assert.equal(example.destinationFacilityId, fixture.facilities[1].facilityId);
  assert.equal(new Date(example.pickupWindowStartsAt).toISOString(), "2026-10-05T08:00:00.000Z");
  assert.equal(new Date(example.pickupWindowEndsAt).toISOString(), "2026-10-05T18:00:00.000Z");
  assert.equal(new Date(example.deliveryWindowStartsAt).toISOString(), "2026-10-07T08:00:00.000Z");
  assert.equal(new Date(example.deliveryWindowEndsAt).toISOString(), "2026-10-07T20:00:00.000Z");
});

test("requirement toggling is deterministic and duplicate-free", () => {
  assert.deepEqual(toggleRequirement(["FRAGILE"], "FRAGILE", true), ["FRAGILE"]);
  assert.deepEqual(toggleRequirement(["FRAGILE"], "SECURITY_SEAL", true), ["FRAGILE", "SECURITY_SEAL"]);
  assert.deepEqual(toggleRequirement(["FRAGILE", "SECURITY_SEAL"], "FRAGILE", false), ["SECURITY_SEAL"]);
});

test("the intake keeps step edits in React memory and does not expose autosave", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/features/v2-intake/v2-intake-prototype.tsx"), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|autosave\s*\(/i);
  assert.match(source, /createFreightRequestV2\(payload/);
  assert.match(source, /POST.*GET.*serviceability/);
});
