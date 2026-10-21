import type {FreightRequestV2Data} from "./contracts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { auditIntakeOptions, getIntakeOptionsFixture } from "./intake-options";
import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";
import {
  EMPTY_PROTOTYPE_DRAFT,
  applyChatFieldToDraft,
  applyChatFieldsToDraft,
  PROVISIONAL_PROTOTYPE_DRAFT,
  buildPrototypeExample,
  filterIntakeFacilities,
  mapDraftToCreateFreightRequestV2Input,
  mapDraftToRevisionInput,
  requestToPrototypeDraft,
  toggleRequirement,
  updatePrototypeDraftField,
  validatePrototypeDraft,
  validatePrototypeReview,
  validatePrototypeStep,
} from "./prototype-model";
import { ROAD_REQUEST_FIXTURE } from "./fixtures/contract-flow.fixture";

test("multi-slot chat updates derive totals from the latest provisional values", () => {
  let draft = applyChatFieldToDraft(EMPTY_PROTOTYPE_DRAFT, "unitQuantity", "2");
  draft = applyChatFieldToDraft(draft, "unitWeightPerUnitKg", "1200");
  draft = applyChatFieldToDraft(draft, "unitVolumePerUnitM3", "2.4");
  assert.equal(draft.totalWeightKg, "2400");
  assert.equal(draft.totalVolumeM3, "4.8");
});

test("chat correction and form edit share one draft without clearing unrelated fields", () => {
  const options = getIntakeOptionsFixture().data;
  const initial = buildPrototypeExample(options);
  const corrected = applyChatFieldsToDraft(initial, [
    { field: "unitQuantity", value: "12" },
    { field: "originFacilityId", value: options.facilities[2].facilityId },
  ]);
  assert.equal(corrected.unitQuantity, "12");
  assert.equal(corrected.totalWeightKg, String(12 * Number(initial.unitWeightPerUnitKg)));
  assert.equal(corrected.totalVolumeM3, "28.8");
  assert.equal(corrected.destinationFacilityId, initial.destinationFacilityId);
  assert.equal(corrected.pickupContactEmail, initial.pickupContactEmail);
  const fromForm = updatePrototypeDraftField(corrected, "cargoDescription", "Updated in the form");
  assert.equal(fromForm.unitQuantity, "12");
  assert.equal(fromForm.cargoDescription, "Updated in the form");
});

test("saved single-unit draft recovers into intake and revisions preserve unexposed fields", () => {
  const options = getIntakeOptionsFixture().data;
  const recovered = requestToPrototypeDraft(ROAD_REQUEST_FIXTURE);
  assert.ok(recovered);
  assert.equal(recovered.originFacilityId, ROAD_REQUEST_FIXTURE.origin.facilityId);
  const changed = applyChatFieldsToDraft(recovered, [{ field: "unitQuantity", value: "12" }]);
  const payload = mapDraftToRevisionInput(changed, options, ROAD_REQUEST_FIXTURE);
  assert.equal(payload.cargoSpecification.units[0].quantity, 12);
  assert.equal(payload.cargoSpecification.totalWeightKg, 12 * ROAD_REQUEST_FIXTURE.cargoSpecification.units[0].weightPerUnitKg);
  assert.deepEqual(payload.acceptedModes, ROAD_REQUEST_FIXTURE.acceptedModes);
  assert.equal(payload.contacts.recipient.name, ROAD_REQUEST_FIXTURE.contacts.recipient.name);
  assert.equal(requestToPrototypeDraft({ ...ROAD_REQUEST_FIXTURE, cargoSpecification: { ...ROAD_REQUEST_FIXTURE.cargoSpecification, units: [ROAD_REQUEST_FIXTURE.cargoSpecification.units[0], ROAD_REQUEST_FIXTURE.cargoSpecification.units[0]] } })?.additionalUnits?.length, 1);
});

test("form unit inputs derive totals without requiring duplicate entry", () => {
  let draft = updatePrototypeDraftField(EMPTY_PROTOTYPE_DRAFT, "unitQuantity", "3");
  draft = updatePrototypeDraftField(draft, "unitWeightPerUnitKg", "250");
  draft = updatePrototypeDraftField(draft, "unitVolumePerUnitM3", "1.5");
  assert.equal(draft.totalWeightKg, "750");
  assert.equal(draft.totalVolumeM3, "4.5");
  assert.equal(updatePrototypeDraftField(draft, "unitQuantity", "").totalWeightKg, "");
});

test("facility search uses only catalog fields and excludes the opposite endpoint", () => {
  const facilities = getIntakeOptionsFixture().data.facilities;
  assert.deepEqual(filterIntakeFacilities(facilities, "arequipa").map((item) => item.code), [facilities[1].code]);
  assert.equal(filterIntakeFacilities(facilities, "pe", facilities[0].facilityId).some((item) => item.facilityId === facilities[0].facilityId), false);
  assert.equal(filterIntakeFacilities(facilities, "missing-place").length, 0);
});

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

test("the intake keeps provisional details in React memory and stores only the request ID for recovery", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/features/v2-intake/intake-controller.ts"), "utf8");
  assert.doesNotMatch(source, /localStorage|autosave\s*\(/i);
  assert.match(source, /sessionStorage\.setItem\(CHAT_REQUEST_SESSION_KEY, roundTrip\.data\.id\)/);
  assert.doesNotMatch(source, /sessionStorage\.setItem\([^,]+,\s*(?:draft|JSON\.stringify|history)/i);
  assert.match(source, /createFreightRequestV2\(payload/);
  assert.match(source, /getFreightRequestV2\(created\.id\)/);
  assert.match(source, /getRoadServiceabilityV2\(roundTrip\.data\.id, roundTrip\.data\.draftVersion\)/);
});

test("intake actions stay in flow rather than covering fields inside the clipped card", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/features/v2-intake/v2-intake-prototype.module.css"), "utf8");
  const footer = css.match(/\.footer\s*\{([^}]+)\}/)?.[1];
  assert.ok(footer);
  assert.match(footer, /display:\s*flex/);
  assert.doesNotMatch(footer, /position:\s*(?:sticky|fixed|absolute)|\bbottom:/);
});

test("intake and facility layouts respond to their available container, including a docked assistant", () => {
  const intake = fs.readFileSync(path.join(process.cwd(), "src/features/v2-intake/v2-intake-prototype.module.css"), "utf8");
  const picker = fs.readFileSync(path.join(process.cwd(), "src/features/v2-intake/components/facility-picker.module.css"), "utf8");
  assert.match(intake, /container:\s*intake\s*\/\s*inline-size/);
  for (const width of [1150, 820, 680]) assert.ok(intake.includes(`@container intake (max-width: ${width}px)`));
  assert.match(picker, /container:\s*facility\s*\/\s*inline-size/);
  assert.match(picker, /@container facility \(max-width: 330px\)/);
  assert.match(picker, /overflow-wrap:\s*anywhere/);
});

test('flexible accepted days survive create, reload and revision without filling the gaps',()=>{
 const options=getIntakeOptionsFixture().data;const draft={...buildPrototypeExample(options),urgency:'URGENT',loadSize:'MEDIUM',planningTimeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,pickupAlternatives:[{startsAt:'2026-10-06T08:00',endsAt:'2026-10-06T18:00'}],deliveryAlternatives:[{startsAt:'2026-10-08T08:00',endsAt:'2026-10-08T20:00'}]};
 const input=mapDraftToCreateFreightRequestV2Input(draft,options);assert.equal(input.selectionObjective,'FASTEST');assert.equal(input.planningPreferences?.pickupWindows.length,2);assert.equal(input.pickupWindow.endsAt,input.planningPreferences!.pickupWindows[1].endsAt);
 const saved={...input,id:'219dfc89-e745-4817-9a58-de64847484c4',referenceCode:'REQ-TEST',organizationId:'e5000001-0000-4000-8000-000000000001',status:'DRAFT',draftVersion:1,origin:options.facilities.find(f=>f.facilityId===draft.originFacilityId),destination:options.facilities.find(f=>f.facilityId===draft.destinationFacilityId),requiredEquipment:input.requiredEquipment??null,budget:null,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'} as unknown as FreightRequestV2Data;
 saved.origin={...input.origin,facilityId:draft.originFacilityId,label:'Origin',countryCode:'PE',city:'Lima',region:null,lat:null,lng:null};saved.destination={...saved.origin,facilityId:draft.destinationFacilityId,city:'Arequipa'};
 const restored=requestToPrototypeDraft(saved);assert.ok(restored);assert.equal(restored.pickupAlternatives?.length,1);const revision=mapDraftToRevisionInput({...restored,cargoDescription:'Updated description'},options,saved);assert.deepEqual(revision.planningPreferences,input.planningPreferences);
});
