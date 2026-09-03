import {
  ENTRY_METHODS,
  RecommendationDraftError,
  isRecord,
  isoDate,
  invalidInput,
  requiredString,
} from "@/features/recommendations/recommendation-draft-contracts";

export const OFFICIAL_CARGO_CATEGORY_CODES = [
  "MACHINERY",
  "GENERAL",
  "AGRICULTURAL",
  "CONSTRUCTION",
] as const;

export type OfficialCargoCategoryCode = (typeof OFFICIAL_CARGO_CATEGORY_CODES)[number];

export const SUPPORTED_COUNTRY_CODES = ["PE", "CL", "CO", "BO", "AR", "EC"] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export type ManualFreightRequestIntakeFields = {
  cargoCategoryCode?: OfficialCargoCategoryCode;
  originCountry?: SupportedCountryCode;
  originRegion?: string | null;
  originCity?: string;
  originAddress?: string | null;
  destinationCountry?: SupportedCountryCode;
  destinationRegion?: string | null;
  destinationCity?: string;
  destinationAddress?: string | null;
  pickupContactName?: string | null;
  pickupContactPhone?: string | null;
  receiverName?: string | null;
  receiverCompany?: string | null;
  receiverPhone?: string | null;
  cargoDescription?: string | null;
  cargoEntryMethod?: string;
  entryQuantity?: number | null;
  entryUnitWeightKg?: number | null;
  unitsPerEntry?: number | null;
  entryLengthCm?: number | null;
  entryWidthCm?: number | null;
  entryHeightCm?: number | null;
  totalWeightKg?: number;
  pickupMode?: "ASAP" | "SCHEDULED";
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
  deliveryDeadline?: string | null;
  budgetMax?: number | null;
  specialInstructions?: string | null;
  availableDocuments?: string[];
};

export type ManualFreightRequestIntakeInput = {
  draftVersion: number;
  fields: ManualFreightRequestIntakeFields;
};

const FIELD_NAMES = new Set<keyof ManualFreightRequestIntakeFields>([
  "cargoCategoryCode",
  "originCountry",
  "originRegion",
  "originCity",
  "originAddress",
  "destinationCountry",
  "destinationRegion",
  "destinationCity",
  "destinationAddress",
  "pickupContactName",
  "pickupContactPhone",
  "receiverName",
  "receiverCompany",
  "receiverPhone",
  "cargoDescription",
  "cargoEntryMethod",
  "entryQuantity",
  "entryUnitWeightKg",
  "unitsPerEntry",
  "entryLengthCm",
  "entryWidthCm",
  "entryHeightCm",
  "totalWeightKg",
  "pickupMode",
  "pickupWindowStart",
  "pickupWindowEnd",
  "deliveryDeadline",
  "budgetMax",
  "specialInstructions",
  "availableDocuments",
]);

function nullableText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function nullablePositiveNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw invalidInput(`${field} debe ser un número mayor que cero o null.`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, field: string): number | null {
  const result = nullablePositiveNumber(value, field);
  if (result !== null && !Number.isInteger(result)) {
    throw invalidInput(`${field} debe ser un entero mayor que cero o null.`);
  }
  return result;
}

function nullableIsoDate(value: unknown, field: string): string | null {
  if (value === null) return null;
  return isoDate(requiredString(value, field), field);
}

function country(value: unknown, field: string): SupportedCountryCode {
  const normalized = requiredString(value, field).toUpperCase() as SupportedCountryCode;
  if (!SUPPORTED_COUNTRY_CODES.includes(normalized)) {
    throw invalidInput(`${field} debe ser uno de: ${SUPPORTED_COUNTRY_CODES.join(", ")}.`);
  }
  return normalized;
}

function documentCodes(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw invalidInput("availableDocuments debe ser una lista de textos no vacíos.");
  }
  return [...new Set(value.map((item) => item.trim()))];
}

export function parseManualFreightRequestIntakeFields(raw: unknown): ManualFreightRequestIntakeFields {
  if (!isRecord(raw) || Object.keys(raw).length === 0) {
    throw invalidInput("fields debe incluir al menos un cambio manual.");
  }
  const unknown = Object.keys(raw).find((key) => !FIELD_NAMES.has(key as keyof ManualFreightRequestIntakeFields));
  if (unknown) throw invalidInput(`fields contiene '${unknown}', que no está permitido.`);

  const fields: ManualFreightRequestIntakeFields = {};
  if ("cargoCategoryCode" in raw) {
    const code = requiredString(raw.cargoCategoryCode, "cargoCategoryCode").toUpperCase();
    if (!OFFICIAL_CARGO_CATEGORY_CODES.includes(code as OfficialCargoCategoryCode)) {
      throw invalidInput("cargoCategoryCode no pertenece a las categorías oficiales.");
    }
    fields.cargoCategoryCode = code as OfficialCargoCategoryCode;
  }
  if ("originCountry" in raw) fields.originCountry = country(raw.originCountry, "originCountry");
  if ("originRegion" in raw) fields.originRegion = nullableText(raw.originRegion, "originRegion");
  if ("originCity" in raw) fields.originCity = requiredString(raw.originCity, "originCity");
  if ("originAddress" in raw) fields.originAddress = nullableText(raw.originAddress, "originAddress");
  if ("destinationCountry" in raw) fields.destinationCountry = country(raw.destinationCountry, "destinationCountry");
  if ("destinationRegion" in raw) fields.destinationRegion = nullableText(raw.destinationRegion, "destinationRegion");
  if ("destinationCity" in raw) fields.destinationCity = requiredString(raw.destinationCity, "destinationCity");
  if ("destinationAddress" in raw) fields.destinationAddress = nullableText(raw.destinationAddress, "destinationAddress");
  if ("pickupContactName" in raw) fields.pickupContactName = nullableText(raw.pickupContactName, "pickupContactName");
  if ("pickupContactPhone" in raw) fields.pickupContactPhone = nullableText(raw.pickupContactPhone, "pickupContactPhone");
  if ("receiverName" in raw) fields.receiverName = nullableText(raw.receiverName, "receiverName");
  if ("receiverCompany" in raw) fields.receiverCompany = nullableText(raw.receiverCompany, "receiverCompany");
  if ("receiverPhone" in raw) fields.receiverPhone = nullableText(raw.receiverPhone, "receiverPhone");
  if ("cargoDescription" in raw) fields.cargoDescription = nullableText(raw.cargoDescription, "cargoDescription");
  if ("cargoEntryMethod" in raw) {
    const entryMethod = requiredString(raw.cargoEntryMethod, "cargoEntryMethod");
    if (!ENTRY_METHODS.has(entryMethod)) throw invalidInput("cargoEntryMethod no está permitido.");
    fields.cargoEntryMethod = entryMethod;
  }
  if ("entryQuantity" in raw) fields.entryQuantity = nullablePositiveNumber(raw.entryQuantity, "entryQuantity");
  if ("entryUnitWeightKg" in raw) fields.entryUnitWeightKg = nullablePositiveNumber(raw.entryUnitWeightKg, "entryUnitWeightKg");
  if ("unitsPerEntry" in raw) fields.unitsPerEntry = nullablePositiveInteger(raw.unitsPerEntry, "unitsPerEntry");
  if ("entryLengthCm" in raw) fields.entryLengthCm = nullablePositiveNumber(raw.entryLengthCm, "entryLengthCm");
  if ("entryWidthCm" in raw) fields.entryWidthCm = nullablePositiveNumber(raw.entryWidthCm, "entryWidthCm");
  if ("entryHeightCm" in raw) fields.entryHeightCm = nullablePositiveNumber(raw.entryHeightCm, "entryHeightCm");
  if ("totalWeightKg" in raw) {
    if (typeof raw.totalWeightKg !== "number" || !Number.isFinite(raw.totalWeightKg) || raw.totalWeightKg <= 0) {
      throw invalidInput("totalWeightKg debe ser un número mayor que cero.");
    }
    fields.totalWeightKg = raw.totalWeightKg;
  }
  if ("pickupMode" in raw) {
    if (raw.pickupMode !== "ASAP" && raw.pickupMode !== "SCHEDULED") {
      throw invalidInput("pickupMode debe ser ASAP o SCHEDULED.");
    }
    fields.pickupMode = raw.pickupMode;
  }
  if ("pickupWindowStart" in raw) fields.pickupWindowStart = nullableIsoDate(raw.pickupWindowStart, "pickupWindowStart");
  if ("pickupWindowEnd" in raw) fields.pickupWindowEnd = nullableIsoDate(raw.pickupWindowEnd, "pickupWindowEnd");
  if ("deliveryDeadline" in raw) fields.deliveryDeadline = nullableIsoDate(raw.deliveryDeadline, "deliveryDeadline");
  if ("budgetMax" in raw) fields.budgetMax = nullablePositiveNumber(raw.budgetMax, "budgetMax");
  if ("specialInstructions" in raw) fields.specialInstructions = nullableText(raw.specialInstructions, "specialInstructions");
  if ("availableDocuments" in raw) fields.availableDocuments = documentCodes(raw.availableDocuments);
  return fields;
}

export function parseManualFreightRequestIntakeInput(raw: unknown): ManualFreightRequestIntakeInput {
  if (!isRecord(raw) || Object.keys(raw).length !== 2 || !("draftVersion" in raw) || !("fields" in raw)) {
    throw invalidInput("El payload admite únicamente draftVersion y fields.");
  }
  if (typeof raw.draftVersion !== "number" || !Number.isInteger(raw.draftVersion) || raw.draftVersion < 1) {
    throw invalidInput("draftVersion debe ser un entero mayor o igual a 1.");
  }
  return { draftVersion: raw.draftVersion, fields: parseManualFreightRequestIntakeFields(raw.fields) };
}

export function isManualIntakeError(error: unknown): error is RecommendationDraftError {
  return error instanceof RecommendationDraftError;
}
