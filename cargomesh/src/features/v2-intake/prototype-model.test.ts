import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { auditIntakeOptions } from "./intake-options";
import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";
import {
  EMPTY_PROTOTYPE_DRAFT,
  PROVISIONAL_PROTOTYPE_DRAFT,
  mapDraftToCreateFreightRequestV2Input,
  toggleRequirement,
  validatePrototypeDraft,
  validatePrototypeReview,
  validatePrototypeStep,
} from "./prototype-model";

test("the local HAC-27 options fixture covers every visible selector", () => {
  assert.deepEqual(auditIntakeOptions(INTAKE_OPTIONS_FIXTURE.data), { complete: true, missing: [] });
  assert.equal(INTAKE_OPTIONS_FIXTURE.meta?.provenanceStatus, "SIMULATED");
  assert.equal(INTAKE_OPTIONS_FIXTURE.data.cargoCategories.length, 8);
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
  const payload = mapDraftToCreateFreightRequestV2Input(PROVISIONAL_PROTOTYPE_DRAFT, INTAKE_OPTIONS_FIXTURE.data);
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
