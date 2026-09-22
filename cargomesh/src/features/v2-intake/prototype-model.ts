import { v2FacilitySchema, type V2Facility } from "@/types/v2-road-network";

export type PrototypeStatus = "preliminary" | "unknown" | "confirmed";
export type PrototypeStep = 1 | 2 | 3 | 4;

export type V2IntakePrototypeDraft = {
  originFacilityId: string;
  destinationFacilityId: string;
  cargoType: string;
  packagingType: string;
  cargoDescription: string;
  weightKg: string;
  volumeM3: string;
  pickupDate: string;
  equipmentPreference: string;
  notes: string;
};

export type PrototypeValidationIssue = {
  field: keyof V2IntakePrototypeDraft;
  code:
    | "required"
    | "same-facility"
    | "positive-number"
    | "invalid-date";
};

const organizationId = "10000000-0000-4000-8000-000000000001";

export const PROTOTYPE_FACILITIES: V2Facility[] = [
  {
    id: "10000000-0000-4000-8000-000000000101",
    organizationId,
    code: "ACME-CALLAO-01",
    name: "Complejo minero Callao",
    facilityType: "SHIPPER_SITE",
    countryCode: "PE",
    regionCode: "CAL",
    city: "Callao",
    postalCode: null,
    addressLine: "Zona portuaria del Callao",
    latitude: -12.0464,
    longitude: -77.1428,
    active: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000102",
    organizationId,
    code: "ACME-SANTIAGO-01",
    name: "Centro de distribución Santiago",
    facilityType: "DISTRIBUTION_CENTER",
    countryCode: "CL",
    regionCode: "RM",
    city: "Santiago",
    postalCode: null,
    addressLine: "Parque industrial San Bernardo",
    latitude: -33.5922,
    longitude: -70.6996,
    active: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000103",
    organizationId,
    code: "ACME-AREQUIPA-01",
    name: "Sede operativa Arequipa",
    facilityType: "WAREHOUSE",
    countryCode: "PE",
    regionCode: "ARE",
    city: "Arequipa",
    postalCode: null,
    addressLine: "Parque industrial Río Seco",
    latitude: -16.3439,
    longitude: -71.5676,
    active: true,
  },
].map((facility) => v2FacilitySchema.parse(facility));

export const CARGO_TYPES = [
  "MINING_PARTS",
  "INDUSTRIAL_SUPPLIES",
  "GENERAL_CARGO",
  "OTHER",
] as const;

export const PACKAGING_TYPES = ["PALLET", "CRATE", "BULK", "OTHER"] as const;

export const EQUIPMENT_PREFERENCES = [
  "NO_PREFERENCE",
  "DRY_VAN",
  "FLATBED",
  "LOWBOY",
] as const;

export const EMPTY_PROTOTYPE_DRAFT: V2IntakePrototypeDraft = {
  originFacilityId: "",
  destinationFacilityId: "",
  cargoType: "",
  packagingType: "",
  cargoDescription: "",
  weightKg: "",
  volumeM3: "",
  pickupDate: "",
  equipmentPreference: "NO_PREFERENCE",
  notes: "",
};

export const PROVISIONAL_PROTOTYPE_DRAFT: V2IntakePrototypeDraft = {
  originFacilityId: PROTOTYPE_FACILITIES[0].id,
  destinationFacilityId: PROTOTYPE_FACILITIES[1].id,
  cargoType: "MINING_PARTS",
  packagingType: "PALLET",
  cargoDescription: "Repuestos y componentes de maquinaria minera",
  weightKg: "8000",
  volumeM3: "18",
  pickupDate: "2026-10-05",
  equipmentPreference: "DRY_VAN",
  notes: "Prototipo de validación: confirmar ventana y equipo antes de conectar el submit.",
};

function isPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function validatePrototypeStep(
  step: PrototypeStep,
  draft: V2IntakePrototypeDraft,
): PrototypeValidationIssue[] {
  const issues: PrototypeValidationIssue[] = [];
  const required = (field: keyof V2IntakePrototypeDraft) => {
    if (!draft[field].trim()) issues.push({ field, code: "required" });
  };

  if (step === 1) {
    required("originFacilityId");
    required("destinationFacilityId");
    if (
      draft.originFacilityId &&
      draft.destinationFacilityId &&
      draft.originFacilityId === draft.destinationFacilityId
    ) {
      issues.push({ field: "destinationFacilityId", code: "same-facility" });
    }
  }

  if (step === 2) {
    required("cargoType");
    required("packagingType");
    required("cargoDescription");
    required("weightKg");
    required("volumeM3");
    if (draft.weightKg && !isPositiveNumber(draft.weightKg)) {
      issues.push({ field: "weightKg", code: "positive-number" });
    }
    if (draft.volumeM3 && !isPositiveNumber(draft.volumeM3)) {
      issues.push({ field: "volumeM3", code: "positive-number" });
    }
  }

  if (step === 3) {
    required("pickupDate");
    required("equipmentPreference");
    if (draft.pickupDate && Number.isNaN(Date.parse(`${draft.pickupDate}T00:00:00Z`))) {
      issues.push({ field: "pickupDate", code: "invalid-date" });
    }
  }

  return issues;
}

export function validatePrototypeDraft(draft: V2IntakePrototypeDraft) {
  return ([1, 2, 3] as PrototypeStep[]).flatMap((step) => validatePrototypeStep(step, draft));
}

export function findPrototypeFacility(id: string) {
  return PROTOTYPE_FACILITIES.find((facility) => facility.id === id) ?? null;
}

export function getPrototypeEvidence(draft: V2IntakePrototypeDraft) {
  return {
    formData: { status: "preliminary" as const, value: draft },
    facilityContract: { status: "confirmed" as const, source: "HAC-21 / V2Facility" },
    transportMode: { status: "confirmed" as const, value: "ROAD" as const },
    route: { status: "unknown" as const, reason: "MAP_PROVIDER_PENDING_HAC_25" },
    distance: { status: "unknown" as const, value: null },
    estimatedTransit: { status: "unknown" as const, value: null },
    carrierAvailability: { status: "unknown" as const, value: null },
  };
}
