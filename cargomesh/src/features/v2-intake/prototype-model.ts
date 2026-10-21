import type {
  CreateFreightRequestV2Input,
  FreightRequestV2Data,
  IntakeFacilityOption,
  IntakeOptionsData,
} from "./contracts";

import {cargoGroups,groupTotals,cargoGroupInput,type DraftCargoGroup} from './cargo-groups';

export type PrototypeStep = 1 | 2 | 3 | 4;

export type V2IntakePrototypeDraft = {
  primaryGroupId?: string;
  primaryOriginalIndex?: number;
  additionalUnits?: DraftCargoGroup[];
  originFacilityId: string;
  destinationFacilityId: string;
  categoryCode: string;
  packaging: string;
  cargoDescription: string;
  totalWeightKg: string;
  totalVolumeM3: string;
  divisible: boolean;
  requirements: string[];
  temperatureMinCelsius: string;
  temperatureMaxCelsius: string;
  unitPackageType: string;
  unitQuantity: string;
  unitWeightPerUnitKg: string;
  unitVolumePerUnitM3: string;
  unitLengthCm: string;
  unitWidthCm: string;
  unitHeightCm: string;
  unitIndivisible: boolean;
  unitStackable: boolean;
  pickupWindowStartsAt: string;
  pickupWindowEndsAt: string;
  deliveryWindowStartsAt: string;
  deliveryWindowEndsAt: string;
  requiredEquipment: string;
  pickupContactName: string;
  pickupContactPhoneE164: string;
  pickupContactEmail: string;
  recipientContactName: string;
  recipientContactPhoneE164: string;
  recipientContactEmail: string;
};

function withDerivedCargoTotals(draft: V2IntakePrototypeDraft): V2IntakePrototypeDraft {
  return {...draft,...groupTotals(cargoGroups(draft))};
}

/** Apply one form field and keep contract totals derived from the visible unit inputs. */
export function updatePrototypeDraftField<K extends keyof V2IntakePrototypeDraft>(
  draft: V2IntakePrototypeDraft,
  field: K,
  value: V2IntakePrototypeDraft[K],
): V2IntakePrototypeDraft {
  const next = { ...draft, [field]: value };
  if (field === "unitQuantity" || field === "unitWeightPerUnitKg" || field === "unitVolumePerUnitM3" || field === "additionalUnits") {
    return withDerivedCargoTotals(next);
  }
  return next;
}

/** Apply one provisional chat field against the latest draft, including canonical UI totals. */
export function applyChatFieldToDraft(draft: V2IntakePrototypeDraft, field: keyof V2IntakePrototypeDraft, value: string): V2IntakePrototypeDraft {
  if (field === "requirements") return { ...draft, requirements: [...new Set([...draft.requirements, value])] };
  const next = updatePrototypeDraftField(draft, field, value as never);
  if (field === "packaging") next.unitPackageType = value;
  return next;
}

/** Apply one interpreted turn atomically so totals and unchanged fields survive corrections. */
export function applyChatFieldsToDraft(
  draft: V2IntakePrototypeDraft,
  fields: ReadonlyArray<{ field: keyof V2IntakePrototypeDraft; value: string }>,
): V2IntakePrototypeDraft {
  return fields.reduce((current, { field, value }) => applyChatFieldToDraft(current, field, value), draft);
}

function localDateTime(instant: string): string {
  const date = new Date(instant);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** A persisted request is editable here only if this intake can represent it without losing units or locations. */
export function requestToPrototypeDraft(request: FreightRequestV2Data): V2IntakePrototypeDraft | null {
  const unit = request.cargoSpecification.units[0];
  if (!request.origin.facilityId || !request.destination.facilityId || !unit) return null;
  return {
    originFacilityId: request.origin.facilityId,
    destinationFacilityId: request.destination.facilityId,
    categoryCode: request.cargoSpecification.categoryCode,
    packaging: request.cargoSpecification.packaging,
    cargoDescription: request.cargoSpecification.description,
    totalWeightKg: String(request.cargoSpecification.totalWeightKg),
    totalVolumeM3: String(request.cargoSpecification.totalVolumeM3),
    divisible: request.cargoSpecification.divisible,
    requirements: [...request.cargoSpecification.requirements],
    temperatureMinCelsius: request.cargoSpecification.temperatureRange?.minCelsius == null ? "" : String(request.cargoSpecification.temperatureRange.minCelsius),
    temperatureMaxCelsius: request.cargoSpecification.temperatureRange?.maxCelsius == null ? "" : String(request.cargoSpecification.temperatureRange.maxCelsius),
    primaryGroupId:'group-0',primaryOriginalIndex:0,
    additionalUnits:request.cargoSpecification.units.slice(1).map((u,i)=>({id:'group-'+(i+1),originalIndex:i+1,unitPackageType:u.packageType,unitQuantity:String(u.quantity),unitWeightPerUnitKg:String(u.weightPerUnitKg),unitVolumePerUnitM3:String(u.volumePerUnitM3),unitLengthCm:String(u.dimensionsCm.length),unitWidthCm:String(u.dimensionsCm.width),unitHeightCm:String(u.dimensionsCm.height),unitIndivisible:u.indivisible,unitStackable:u.stackable})),
    unitPackageType: unit.packageType,
    unitQuantity: String(unit.quantity),
    unitWeightPerUnitKg: String(unit.weightPerUnitKg),
    unitVolumePerUnitM3: String(unit.volumePerUnitM3),
    unitLengthCm: String(unit.dimensionsCm.length),
    unitWidthCm: String(unit.dimensionsCm.width),
    unitHeightCm: String(unit.dimensionsCm.height),
    unitIndivisible: unit.indivisible,
    unitStackable: unit.stackable,
    pickupWindowStartsAt: localDateTime(request.pickupWindow.startsAt),
    pickupWindowEndsAt: localDateTime(request.pickupWindow.endsAt),
    deliveryWindowStartsAt: localDateTime(request.deliveryWindow.startsAt),
    deliveryWindowEndsAt: localDateTime(request.deliveryWindow.endsAt),
    requiredEquipment: request.requiredEquipment ?? "",
    pickupContactName: request.contacts.pickup.name,
    pickupContactPhoneE164: request.contacts.pickup.phoneE164,
    pickupContactEmail: request.contacts.pickup.email ?? "",
    recipientContactName: request.contacts.recipient.name,
    recipientContactPhoneE164: request.contacts.recipient.phoneE164,
    recipientContactEmail: request.contacts.recipient.email ?? "",
  };
}

export type PrototypeValidationCode =
  | "required"
  | "same-facility"
  | "positive-number"
  | "positive-integer"
  | "invalid-date"
  | "invalid-range"
  | "invalid-email"
  | "invalid-phone"
  | "total-mismatch"
  | "temperature-order";

export type PrototypeValidationIssue = {
  field: keyof V2IntakePrototypeDraft;
  code: PrototypeValidationCode;
};

export const EMPTY_PROTOTYPE_DRAFT: V2IntakePrototypeDraft = {
  originFacilityId: "",
  destinationFacilityId: "",
  categoryCode: "",
  packaging: "",
  cargoDescription: "",
  totalWeightKg: "",
  totalVolumeM3: "",
  divisible: false,
  requirements: [],
  temperatureMinCelsius: "",
  temperatureMaxCelsius: "",
  unitPackageType: "",
  unitQuantity: "",
  unitWeightPerUnitKg: "",
  unitVolumePerUnitM3: "",
  unitLengthCm: "",
  unitWidthCm: "",
  unitHeightCm: "",
  unitIndivisible: true,
  unitStackable: false,
  pickupWindowStartsAt: "",
  pickupWindowEndsAt: "",
  deliveryWindowStartsAt: "",
  deliveryWindowEndsAt: "",
  requiredEquipment: "",
  pickupContactName: "",
  pickupContactPhoneE164: "",
  pickupContactEmail: "",
  recipientContactName: "",
  recipientContactPhoneE164: "",
  recipientContactEmail: "",
};

export const PROVISIONAL_PROTOTYPE_DRAFT: V2IntakePrototypeDraft = {
  originFacilityId: "c2330000-0000-4000-8000-000000000001",
  destinationFacilityId: "c2330000-0000-4000-8000-000000000002",
  categoryCode: "PHARMA",
  packaging: "PALLET",
  cargoDescription: "Vacunas termolábiles del escenario contractual V2",
  totalWeightKg: "4800",
  totalVolumeM3: "19.2",
  divisible: false,
  requirements: ["TEMP_CONTROLLED", "SECURITY_SEAL"],
  temperatureMinCelsius: "2",
  temperatureMaxCelsius: "8",
  unitPackageType: "PALLET",
  unitQuantity: "8",
  unitWeightPerUnitKg: "600",
  unitVolumePerUnitM3: "2.4",
  unitLengthCm: "120",
  unitWidthCm: "100",
  unitHeightCm: "200",
  unitIndivisible: true,
  unitStackable: false,
  pickupWindowStartsAt: "2026-10-05T08:00",
  pickupWindowEndsAt: "2026-10-05T18:00",
  deliveryWindowStartsAt: "2026-10-07T08:00",
  deliveryWindowEndsAt: "2026-10-07T20:00",
  requiredEquipment: "REEFER_TRUCK",
  pickupContactName: "Elena Vargas",
  pickupContactPhoneE164: "+51987654321",
  pickupContactEmail: "despachos.lima@shipper-v2.example",
  recipientContactName: "Carlos Medina",
  recipientContactPhoneE164: "+51912345678",
  recipientContactEmail: "recepcion.aqp@shipper-v2.example",
};

function preferredOptionCode(
  options: ReadonlyArray<{ code: string }>,
  preferredCodes: string[],
) {
  return preferredCodes
    .map((code) => options.find((option) => option.code === code)?.code)
    .find((code): code is string => Boolean(code))
    ?? options[0]?.code
    ?? "";
}

function preferredFacilityId(
  options: IntakeOptionsData["facilities"],
  preferredCode: string,
  excludedId?: string,
) {
  return options.find((facility) => facility.code === preferredCode && facility.facilityId !== excludedId)?.facilityId
    ?? options.find((facility) => facility.facilityId !== excludedId)?.facilityId
    ?? "";
}

function utcInstantToLocalDateTimeInput(utcInstant: string) {
  const date = new Date(utcInstant);
  const localClock = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localClock.toISOString().slice(0, 16);
}

/**
 * Builds the one-click example from the authenticated selector contract.
 * Static values remain presentation-only; every submitted selector value is
 * sourced from the current GET /api/v2/intake/options response.
 */
export function buildPrototypeExample(options: IntakeOptionsData): V2IntakePrototypeDraft {
  const requirements = ["TEMP_CONTROLLED", "SECURITY_SEAL"]
    .filter((code) => options.requirementOptions.some((option) => option.code === code));
  const temperatureControlled = requirements.includes("TEMP_CONTROLLED");
  const packaging = preferredOptionCode(options.packagingOptions, ["PALLET"]);
  const originFacilityId = preferredFacilityId(options.facilities, "QA-A-LIMA");
  const destinationFacilityId = preferredFacilityId(options.facilities, "QA-A-AREQUIPA", originFacilityId);

  return {
    ...PROVISIONAL_PROTOTYPE_DRAFT,
    originFacilityId,
    destinationFacilityId,
    categoryCode: preferredOptionCode(options.cargoCategories, ["PHARMA"]),
    packaging,
    unitPackageType: packaging,
    requiredEquipment: preferredOptionCode(options.equipmentOptions, ["REEFER_TRUCK"]),
    pickupWindowStartsAt: utcInstantToLocalDateTimeInput("2026-10-05T08:00:00Z"),
    pickupWindowEndsAt: utcInstantToLocalDateTimeInput("2026-10-05T18:00:00Z"),
    deliveryWindowStartsAt: utcInstantToLocalDateTimeInput("2026-10-07T08:00:00Z"),
    deliveryWindowEndsAt: utcInstantToLocalDateTimeInput("2026-10-07T20:00:00Z"),
    requirements,
    temperatureMinCelsius: temperatureControlled ? PROVISIONAL_PROTOTYPE_DRAFT.temperatureMinCelsius : "",
    temperatureMaxCelsius: temperatureControlled ? PROVISIONAL_PROTOTYPE_DRAFT.temperatureMaxCelsius : "",
  };
}

function hasText(value: V2IntakePrototypeDraft[keyof V2IntakePrototypeDraft]) {
  return typeof value === "string" ? value.trim().length > 0 : true;
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

const CARGO_TOTAL_TOLERANCE_V2 = 1e-6;

function totalsMatch(declared: string, quantity: string, perUnit: string) {
  const declaredValue = Number(declared);
  const quantityValue = Number(quantity);
  const perUnitValue = Number(perUnit);
  return Number.isFinite(declaredValue)
    && Number.isFinite(quantityValue)
    && Number.isFinite(perUnitValue)
    && Math.abs(declaredValue - quantityValue * perUnitValue) <= CARGO_TOTAL_TOLERANCE_V2;
}

function validLocalDateTime(value: string) {
  return value.length > 0 && !Number.isNaN(Date.parse(value));
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validE164(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function validatePrototypeStep(
  step: PrototypeStep,
  draft: V2IntakePrototypeDraft,
): PrototypeValidationIssue[] {
  const issues: PrototypeValidationIssue[] = [];
  const required = (field: keyof V2IntakePrototypeDraft) => {
    if (!hasText(draft[field])) issues.push({ field, code: "required" });
  };
  const positive = (field: keyof V2IntakePrototypeDraft) => {
    const value = draft[field];
    if (typeof value === "string" && value && !positiveNumber(value)) {
      issues.push({ field, code: "positive-number" });
    }
  };

  if (step === 1) {
    required("originFacilityId");
    required("destinationFacilityId");
    if (
      draft.originFacilityId
      && draft.destinationFacilityId
      && draft.originFacilityId === draft.destinationFacilityId
    ) {
      issues.push({ field: "destinationFacilityId", code: "same-facility" });
    }
  }

  if (step === 2) {
    for(const group of draft.additionalUnits??[]){
      if(!group.unitPackageType||![group.unitWeightPerUnitKg,group.unitVolumePerUnitM3,group.unitLengthCm,group.unitWidthCm,group.unitHeightCm].every(positiveNumber)||!positiveInteger(group.unitQuantity))issues.push({field:'additionalUnits',code:'positive-number'});
    }
    const ids=cargoGroups(draft).map(g=>g.id);if(new Set(ids).size!==ids.length)issues.push({field:'additionalUnits',code:'required'});
    const requiredFields: Array<keyof V2IntakePrototypeDraft> = [
      "categoryCode", "packaging", "cargoDescription", "totalWeightKg", "totalVolumeM3",
      "unitPackageType", "unitQuantity", "unitWeightPerUnitKg", "unitVolumePerUnitM3",
      "unitLengthCm", "unitWidthCm", "unitHeightCm",
    ];
    requiredFields.forEach(required);
    [
      "totalWeightKg", "totalVolumeM3", "unitWeightPerUnitKg", "unitVolumePerUnitM3",
      "unitLengthCm", "unitWidthCm", "unitHeightCm",
    ].forEach((field) => positive(field as keyof V2IntakePrototypeDraft));
    if (draft.unitQuantity && !positiveInteger(draft.unitQuantity)) {
      issues.push({ field: "unitQuantity", code: "positive-integer" });
    }
    if (
      positiveInteger(draft.unitQuantity)
      && positiveNumber(draft.totalWeightKg)
      && positiveNumber(draft.unitWeightPerUnitKg)
      && Math.abs(Number(draft.totalWeightKg)-Number(groupTotals(cargoGroups(draft)).totalWeightKg))>CARGO_TOTAL_TOLERANCE_V2
    ) {
      issues.push({ field: "totalWeightKg", code: "total-mismatch" });
    }
    if (
      positiveInteger(draft.unitQuantity)
      && positiveNumber(draft.totalVolumeM3)
      && positiveNumber(draft.unitVolumePerUnitM3)
      && Math.abs(Number(draft.totalVolumeM3)-Number(groupTotals(cargoGroups(draft)).totalVolumeM3))>CARGO_TOTAL_TOLERANCE_V2
    ) {
      issues.push({ field: "totalVolumeM3", code: "total-mismatch" });
    }
    if (draft.requirements.includes("TEMP_CONTROLLED")) {
      required("temperatureMinCelsius");
      required("temperatureMaxCelsius");
      const min = Number(draft.temperatureMinCelsius);
      const max = Number(draft.temperatureMaxCelsius);
      if (
        draft.temperatureMinCelsius
        && draft.temperatureMaxCelsius
        && Number.isFinite(min)
        && Number.isFinite(max)
        && min > max
      ) {
        issues.push({ field: "temperatureMaxCelsius", code: "temperature-order" });
      }
    }
  }

  if (step === 3) {
    for(const group of draft.additionalUnits??[]){
      if(!group.unitPackageType||![group.unitWeightPerUnitKg,group.unitVolumePerUnitM3,group.unitLengthCm,group.unitWidthCm,group.unitHeightCm].every(positiveNumber)||!positiveInteger(group.unitQuantity))issues.push({field:'additionalUnits',code:'positive-number'});
    }
    const ids=cargoGroups(draft).map(g=>g.id);if(new Set(ids).size!==ids.length)issues.push({field:'additionalUnits',code:'required'});
    const requiredFields: Array<keyof V2IntakePrototypeDraft> = [
      "pickupWindowStartsAt", "pickupWindowEndsAt", "deliveryWindowStartsAt", "deliveryWindowEndsAt",
      "requiredEquipment", "pickupContactName", "pickupContactPhoneE164", "pickupContactEmail",
      "recipientContactName", "recipientContactPhoneE164", "recipientContactEmail",
    ];
    requiredFields.forEach(required);
    const dateFields: Array<keyof V2IntakePrototypeDraft> = [
      "pickupWindowStartsAt", "pickupWindowEndsAt", "deliveryWindowStartsAt", "deliveryWindowEndsAt",
    ];
    dateFields.forEach((field) => {
      const value = draft[field];
      if (typeof value === "string" && value && !validLocalDateTime(value)) {
        issues.push({ field, code: "invalid-date" });
      }
    });
    if (
      validLocalDateTime(draft.pickupWindowStartsAt)
      && validLocalDateTime(draft.pickupWindowEndsAt)
      && Date.parse(draft.pickupWindowEndsAt) <= Date.parse(draft.pickupWindowStartsAt)
    ) {
      issues.push({ field: "pickupWindowEndsAt", code: "invalid-range" });
    }
    if (
      validLocalDateTime(draft.deliveryWindowStartsAt)
      && validLocalDateTime(draft.deliveryWindowEndsAt)
      && Date.parse(draft.deliveryWindowEndsAt) <= Date.parse(draft.deliveryWindowStartsAt)
    ) {
      issues.push({ field: "deliveryWindowEndsAt", code: "invalid-range" });
    }
    if (
      validLocalDateTime(draft.pickupWindowEndsAt)
      && validLocalDateTime(draft.deliveryWindowStartsAt)
      && Date.parse(draft.deliveryWindowStartsAt) < Date.parse(draft.pickupWindowEndsAt)
    ) {
      issues.push({ field: "deliveryWindowStartsAt", code: "invalid-range" });
    }
    if (draft.pickupContactEmail && !validEmail(draft.pickupContactEmail)) {
      issues.push({ field: "pickupContactEmail", code: "invalid-email" });
    }
    if (draft.recipientContactEmail && !validEmail(draft.recipientContactEmail)) {
      issues.push({ field: "recipientContactEmail", code: "invalid-email" });
    }
    if (draft.pickupContactPhoneE164 && !validE164(draft.pickupContactPhoneE164)) {
      issues.push({ field: "pickupContactPhoneE164", code: "invalid-phone" });
    }
    if (draft.recipientContactPhoneE164 && !validE164(draft.recipientContactPhoneE164)) {
      issues.push({ field: "recipientContactPhoneE164", code: "invalid-phone" });
    }
  }

  return issues;
}

export function validatePrototypeDraft(draft: V2IntakePrototypeDraft) {
  return ([1, 2, 3] as PrototypeStep[]).flatMap((step) => validatePrototypeStep(step, draft));
}

export function validatePrototypeReview(draft: V2IntakePrototypeDraft) {
  for (const step of [1, 2, 3] as PrototypeStep[]) {
    const issues = validatePrototypeStep(step, draft);
    if (issues.length) return { valid: false as const, invalidStep: step, issues };
  }
  return { valid: true as const, invalidStep: null, issues: [] as PrototypeValidationIssue[] };
}

export function findIntakeFacility(options: IntakeOptionsData, id: string) {
  return options.facilities.find((facility) => facility.facilityId === id) ?? null;
}

export function filterIntakeFacilities(
  facilities: IntakeFacilityOption[],
  query: string,
  excludedFacilityId?: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  return facilities.filter((facility) => {
    if (excludedFacilityId && facility.facilityId === excludedFacilityId) return false;
    if (!normalized) return true;
    return [facility.code, facility.label, facility.city, facility.region, facility.countryCode]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalized));
  });
}

function toIso(localDateTime: string) {
  return new Date(localDateTime).toISOString();
}

function locationFromFacility(facility: IntakeFacilityOption) {
  return {
    facilityId: facility.facilityId,
    label: facility.label,
    countryCode: facility.countryCode,
    region: facility.region ?? null,
    city: facility.city,
    lat: facility.lat,
    lng: facility.lng,
  };
}

export function mapDraftToCreateFreightRequestV2Input(
  draft: V2IntakePrototypeDraft,
  options: IntakeOptionsData,
): CreateFreightRequestV2Input {
  const validation = validatePrototypeReview(draft);
  if (!validation.valid) throw new Error(`INVALID_DRAFT_STEP_${validation.invalidStep}`);
  const origin = findIntakeFacility(options, draft.originFacilityId);
  const destination = findIntakeFacility(options, draft.destinationFacilityId);
  if (!origin || !destination) throw new Error("FACILITY_OPTION_NOT_FOUND");
  const hasCode = (group: ReadonlyArray<{ code: string }>, code: string) => (
    group.some((option) => option.code === code)
  );
  if (!hasCode(options.cargoCategories, draft.categoryCode)) throw new Error("CATEGORY_OPTION_NOT_FOUND");
  if (!hasCode(options.packagingOptions, draft.packaging)) throw new Error("PACKAGING_OPTION_NOT_FOUND");
  if (cargoGroups(draft).some(g=>!hasCode(options.packagingOptions,g.unitPackageType))) throw new Error("UNIT_PACKAGING_OPTION_NOT_FOUND");
  if (!hasCode(options.equipmentOptions, draft.requiredEquipment)) throw new Error("EQUIPMENT_OPTION_NOT_FOUND");
  if (draft.requirements.some((code) => !hasCode(options.requirementOptions, code))) {
    throw new Error("REQUIREMENT_OPTION_NOT_FOUND");
  }

  return {
    schemaVersion: "2.0",
    origin: locationFromFacility(origin),
    destination: locationFromFacility(destination),
    pickupWindow: {
      startsAt: toIso(draft.pickupWindowStartsAt),
      endsAt: toIso(draft.pickupWindowEndsAt),
    },
    deliveryWindow: {
      startsAt: toIso(draft.deliveryWindowStartsAt),
      endsAt: toIso(draft.deliveryWindowEndsAt),
    },
    acceptedModes: ["ROAD"],
    requiredEquipment: draft.requiredEquipment,
    cargoSpecification: {
      categoryCode: draft.categoryCode,
      description: draft.cargoDescription.trim(),
      packaging: draft.packaging,
      totalWeightKg: Number(draft.totalWeightKg),
      totalVolumeM3: Number(draft.totalVolumeM3),
      divisible: draft.divisible,
      requirements: [...draft.requirements],
      temperatureRange: draft.requirements.includes("TEMP_CONTROLLED")
        ? {
            minCelsius: Number(draft.temperatureMinCelsius),
            maxCelsius: Number(draft.temperatureMaxCelsius),
          }
        : null,
      units: cargoGroups(draft).map(cargoGroupInput),
    },
    contacts: {
      pickup: {
        name: draft.pickupContactName.trim(),
        phoneE164: draft.pickupContactPhoneE164.trim(),
        email: draft.pickupContactEmail.trim(),
      },
      recipient: {
        name: draft.recipientContactName.trim(),
        phoneE164: draft.recipientContactPhoneE164.trim(),
        email: draft.recipientContactEmail.trim(),
      },
    },
  };
}

/** Preserve persisted fields this guided intake does not expose while revising its supported fields. */
export function mapDraftToRevisionInput(
  draft: V2IntakePrototypeDraft,
  options: IntakeOptionsData,
  request: FreightRequestV2Data,
): CreateFreightRequestV2Input {
  if (!requestToPrototypeDraft(request)) throw new Error("REQUEST_NOT_EDITABLE_IN_INTAKE");
  const edited = mapDraftToCreateFreightRequestV2Input(draft, options);
  return {
    ...edited,
    acceptedModes: request.acceptedModes,
    serviceType: request.serviceType,
    selectionObjective: request.selectionObjective ?? undefined,
    preferredEquipment: request.preferredEquipment,
    budget: request.budget,
    cargoSpecification: {
      ...request.cargoSpecification,
      ...edited.cargoSpecification,
      units: edited.cargoSpecification.units.map((unit,index)=>({...request.cargoSpecification.units[cargoGroups(draft)[index].originalIndex??-1],...unit})),
    },
    contacts: {
      pickup: { ...request.contacts.pickup, ...edited.contacts.pickup },
      recipient: { ...request.contacts.recipient, ...edited.contacts.recipient },
    },
  };
}

export function toggleRequirement(
  requirements: string[],
  requirement: string,
  selected: boolean,
) {
  if (selected) return requirements.includes(requirement) ? requirements : [...requirements, requirement];
  return requirements.filter((candidate) => candidate !== requirement);
}
