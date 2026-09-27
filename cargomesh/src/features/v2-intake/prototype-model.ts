import type {
  CreateFreightRequestV2Input,
  IntakeFacilityOption,
  IntakeOptionsData,
} from "./contracts";

export type PrototypeStep = 1 | 2 | 3 | 4;

export type V2IntakePrototypeDraft = {
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

export type PrototypeValidationCode =
  | "required"
  | "same-facility"
  | "positive-number"
  | "positive-integer"
  | "invalid-date"
  | "invalid-range"
  | "invalid-email"
  | "invalid-phone"
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
      units: [{
        packageType: draft.unitPackageType,
        quantity: Number(draft.unitQuantity),
        weightPerUnitKg: Number(draft.unitWeightPerUnitKg),
        volumePerUnitM3: Number(draft.unitVolumePerUnitM3),
        dimensionsCm: {
          length: Number(draft.unitLengthCm),
          width: Number(draft.unitWidthCm),
          height: Number(draft.unitHeightCm),
        },
        indivisible: draft.unitIndivisible,
        stackable: draft.unitStackable,
      }],
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

export function toggleRequirement(
  requirements: string[],
  requirement: string,
  selected: boolean,
) {
  if (selected) return requirements.includes(requirement) ? requirements : [...requirements, requirement];
  return requirements.filter((candidate) => candidate !== requirement);
}
