import type { IntakeOptionsData, IntakeOptionsResponse } from "./contracts";
import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";

export const REQUIRED_INTAKE_OPTION_GROUPS = [
  "facilities",
  "cargoCategories",
  "packagingTypes",
  "equipmentTypes",
  "requirementTypes",
] as const satisfies ReadonlyArray<keyof IntakeOptionsData>;

export type IntakeOptionCoverage = {
  complete: boolean;
  missing: Array<(typeof REQUIRED_INTAKE_OPTION_GROUPS)[number]>;
};

export function auditIntakeOptions(options: IntakeOptionsData): IntakeOptionCoverage {
  const missing = REQUIRED_INTAKE_OPTION_GROUPS.filter((key) => options[key].length === 0);
  return { complete: missing.length === 0, missing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOption(value: unknown) {
  return isRecord(value)
    && typeof value.value === "string"
    && typeof value.labelEs === "string"
    && typeof value.labelEn === "string";
}

function isFacility(value: unknown) {
  return isRecord(value)
    && typeof value.facilityId === "string"
    && typeof value.code === "string"
    && typeof value.label === "string"
    && typeof value.countryCode === "string"
    && typeof value.city === "string"
    && (typeof value.lat === "number" || value.lat === null)
    && (typeof value.lng === "number" || value.lng === null);
}

export function parseIntakeOptionsResponse(value: unknown): IntakeOptionsResponse | null {
  if (!isRecord(value) || value.schemaVersion !== "2.0" || !isRecord(value.data)) return null;
  const data = value.data;
  if (
    !Array.isArray(data.facilities)
    || !data.facilities.every(isFacility)
    || !Array.isArray(data.cargoCategories)
    || !data.cargoCategories.every(isOption)
    || !Array.isArray(data.packagingTypes)
    || !data.packagingTypes.every(isOption)
    || !Array.isArray(data.equipmentTypes)
    || !data.equipmentTypes.every(isOption)
    || !Array.isArray(data.requirementTypes)
    || !data.requirementTypes.every(isOption)
  ) return null;
  return value as IntakeOptionsResponse;
}

export function getIntakeOptionsFixture() {
  return structuredClone(INTAKE_OPTIONS_FIXTURE);
}
