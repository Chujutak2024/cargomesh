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

export const PROTOTYPE_SCENARIO = {
  packageName: "HAC-23-V2-ROAD-BASELINE",
  provenance: "SYNTHETIC_DEMO_ONLY",
  organizationId: "c2300000-0000-4000-8000-000000000001",
  organizationName: "[SYNTHETIC] V2 ROAD tenant A",
} as const;

export type PrototypeFacilityScenarioRole =
  | "DECLARED_LANE_ENDPOINT"
  | "NO_DECLARED_COVERAGE";

export const PROTOTYPE_FACILITIES: V2Facility[] = [
  {
    id: "c2330000-0000-4000-8000-000000000001",
    organizationId: PROTOTYPE_SCENARIO.organizationId,
    code: "QA-A-LIMA",
    name: "[SYNTHETIC] Lima pickup site",
    facilityType: "SHIPPER_SITE",
    countryCode: "PE",
    regionCode: null,
    city: "Lima",
    postalCode: null,
    addressLine: "Synthetic Lima address",
    latitude: null,
    longitude: null,
    active: true,
  },
  {
    id: "c2330000-0000-4000-8000-000000000002",
    organizationId: PROTOTYPE_SCENARIO.organizationId,
    code: "QA-A-AREQUIPA",
    name: "[SYNTHETIC] Arequipa delivery site",
    facilityType: "WAREHOUSE",
    countryCode: "PE",
    regionCode: null,
    city: "Arequipa",
    postalCode: null,
    addressLine: "Synthetic Arequipa address",
    latitude: null,
    longitude: null,
    active: true,
  },
  {
    id: "c2330000-0000-4000-8000-000000000003",
    organizationId: PROTOTYPE_SCENARIO.organizationId,
    code: "QA-A-PIURA",
    name: "[SYNTHETIC] Piura site without declared coverage",
    facilityType: "SHIPPER_SITE",
    countryCode: "PE",
    regionCode: null,
    city: "Piura",
    postalCode: null,
    addressLine: "Synthetic Piura address",
    latitude: null,
    longitude: null,
    active: true,
  },
].map((facility) => v2FacilitySchema.parse(facility));

const PROTOTYPE_FACILITY_SCENARIO_ROLES = new Map<string, PrototypeFacilityScenarioRole>([
  [PROTOTYPE_FACILITIES[0].id, "DECLARED_LANE_ENDPOINT"],
  [PROTOTYPE_FACILITIES[1].id, "DECLARED_LANE_ENDPOINT"],
  [PROTOTYPE_FACILITIES[2].id, "NO_DECLARED_COVERAGE"],
]);

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
  cargoType: "INDUSTRIAL_SUPPLIES",
  packagingType: "CRATE",
  cargoDescription: "Equipos de mantenimiento industrial para escenario sintético V2",
  weightKg: "6000",
  volumeM3: "14",
  pickupDate: "2026-10-05",
  equipmentPreference: "NO_PREFERENCE",
  notes: "Escenario sintético: confirmar ruta, cobertura, capacidad y condiciones antes de persistir.",
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

export function validatePrototypeReview(draft: V2IntakePrototypeDraft) {
  for (const step of [1, 2, 3] as PrototypeStep[]) {
    const issues = validatePrototypeStep(step, draft);
    if (issues.length) {
      return { valid: false as const, invalidStep: step, issues };
    }
  }

  return {
    valid: true as const,
    invalidStep: null,
    issues: [] as PrototypeValidationIssue[],
  };
}

export function findPrototypeFacility(id: string) {
  return PROTOTYPE_FACILITIES.find((facility) => facility.id === id) ?? null;
}

export function getPrototypeFacilityScenarioRole(id: string) {
  return PROTOTYPE_FACILITY_SCENARIO_ROLES.get(id) ?? null;
}

export function getPrototypeEvidence(draft: V2IntakePrototypeDraft) {
  return {
    formData: { status: "preliminary" as const, value: draft },
    facilityContract: {
      status: "confirmed" as const,
      source: "HAC-21 / V2Facility",
      scenario: PROTOTYPE_SCENARIO.packageName,
      provenance: PROTOTYPE_SCENARIO.provenance,
    },
    transportMode: { status: "confirmed" as const, value: "ROAD" as const },
    route: { status: "unknown" as const, reason: "FACILITY_SELECTION_ONLY" },
    coverage: { status: "unknown" as const, value: null },
    capacity: { status: "unknown" as const, value: null },
    distance: { status: "unknown" as const, value: null },
    estimatedTransit: { status: "unknown" as const, value: null },
    carrierAvailability: { status: "unknown" as const, value: null },
    price: { status: "unknown" as const, value: null },
    persistence: { status: "confirmed" as const, value: "NOT_CONNECTED" as const },
  };
}
