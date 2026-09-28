import type {
  IntakeOption,
  IntakeOptionsData,
  IntakeOptionsResponse,
  NormalizedIntakeOptionsResponse,
} from "./contracts";
import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";

export const REQUIRED_INTAKE_OPTION_GROUPS = [
  "facilities",
  "cargoCategories",
  "equipmentOptions",
  "packagingOptions",
  "requirementOptions",
] as const satisfies ReadonlyArray<keyof IntakeOptionsData>;

const REQUIRED_CATALOG_GROUPS = [
  "cargoCategories",
  "equipmentOptions",
  "packagingOptions",
  "requirementOptions",
] as const satisfies ReadonlyArray<keyof IntakeOptionsData>;

export const EMPTY_INTAKE_OPTIONS: IntakeOptionsData = {
  facilities: [],
  cargoCategories: [],
  equipmentOptions: [],
  packagingOptions: [],
  requirementOptions: [],
};

export type IntakeOptionCoverage = {
  complete: boolean;
  emptyFacilities: boolean;
  missingCatalogGroups: Array<(typeof REQUIRED_CATALOG_GROUPS)[number]>;
};

export function auditIntakeOptions(options: IntakeOptionsData): IntakeOptionCoverage {
  const missingCatalogGroups = REQUIRED_CATALOG_GROUPS.filter((key) => options[key].length === 0);
  return {
    complete: missingCatalogGroups.length === 0,
    emptyFacilities: options.facilities.length === 0,
    missingCatalogGroups,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasExactGroups(value: Record<string, unknown>) {
  return REQUIRED_INTAKE_OPTION_GROUPS.every((key) => Array.isArray(value[key]));
}

function isFacility(value: unknown) {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.code === "string"
    && typeof value.label === "string"
    && typeof value.countryCode === "string"
    && (typeof value.region === "string" || value.region === null || value.region === undefined)
    && typeof value.city === "string"
    && (typeof value.lat === "number" || value.lat === null)
    && (typeof value.lng === "number" || value.lng === null);
}

function isCargoCategory(value: unknown) {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.code === "string"
    && typeof value.name === "string"
    && typeof value.guidance === "string";
}

function isEquipmentOption(value: unknown) {
  return isRecord(value)
    && typeof value.code === "string"
    && typeof value.label === "string"
    && value.mode === "ROAD";
}

function isPackagingOption(value: unknown) {
  return isRecord(value)
    && typeof value.code === "string"
    && typeof value.labelEs === "string"
    && typeof value.labelEn === "string"
    && value.verification === "CAPTURE_ONLY";
}

function isRequirementOption(value: unknown) {
  return isRecord(value)
    && typeof value.code === "string"
    && typeof value.labelEs === "string"
    && typeof value.labelEn === "string"
    && (value.verification === "RESOURCE_EVIDENCE" || value.verification === "REQUIRES_REVIEW");
}

function normalizeOption(code: string, labelEs: string, labelEn: string, extra: Partial<IntakeOption> = {}): IntakeOption {
  return { code, labelEs, labelEn, ...extra };
}

export function parseIntakeOptionsResponse(value: unknown): NormalizedIntakeOptionsResponse | null {
  if (!isRecord(value) || value.schemaVersion !== "2.0" || !isRecord(value.data) || !hasExactGroups(value.data)) {
    return null;
  }
  const data = value.data;
  if (
    !(data.facilities as unknown[]).every(isFacility)
    || !(data.cargoCategories as unknown[]).every(isCargoCategory)
    || !(data.equipmentOptions as unknown[]).every(isEquipmentOption)
    || !(data.packagingOptions as unknown[]).every(isPackagingOption)
    || !(data.requirementOptions as unknown[]).every(isRequirementOption)
  ) return null;

  const response = value as IntakeOptionsResponse;
  return {
    schemaVersion: "2.0",
    data: {
      facilities: response.data.facilities.map((facility) => ({
        facilityId: facility.id,
        code: facility.code,
        label: facility.label,
        countryCode: facility.countryCode,
        region: facility.region ?? null,
        city: facility.city,
        lat: facility.lat,
        lng: facility.lng,
      })),
      cargoCategories: response.data.cargoCategories.map((category) => normalizeOption(
        category.code,
        category.name,
        category.name,
        { guidance: category.guidance },
      )),
      equipmentOptions: response.data.equipmentOptions.map((option) => normalizeOption(
        option.code,
        option.label,
        option.label,
      )),
      packagingOptions: response.data.packagingOptions.map((option) => normalizeOption(
        option.code,
        option.labelEs,
        option.labelEn,
        { verification: option.verification },
      )),
      requirementOptions: response.data.requirementOptions.map((option) => normalizeOption(
        option.code,
        option.labelEs,
        option.labelEn,
        { verification: option.verification },
      )),
    },
    meta: response.meta,
  };
}

export function getIntakeOptionsFixture() {
  const parsed = parseIntakeOptionsResponse(structuredClone(INTAKE_OPTIONS_FIXTURE));
  if (!parsed) throw new Error("The explicit HAC-27 development fixture is invalid.");
  return parsed;
}
