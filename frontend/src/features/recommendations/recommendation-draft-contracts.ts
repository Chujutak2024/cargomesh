import {
  RECOMMENDATION_PROPOSED_FIELD_NAMES,
  type RecommendationJsonValue,
  type RecommendationProposedFieldName,
  type RecommendationProposedFields,
} from "./contracts";

export const FREIGHT_REQUEST_DRAFT_SCHEMA_VERSION = "1.0" as const;

export type FreightRequestDraft = {
  schemaVersion: typeof FREIGHT_REQUEST_DRAFT_SCHEMA_VERSION;
  freightRequestId: string;
  requestCode: string;
  draftVersion: number;
  fields: RecommendationProposedFields;
  normalized: {
    cargoWeightKg: number;
    cargoVolumeM3: number | null;
  };
};

/**
 * The client sends only the human-selected canonical fields. The server reads
 * the persisted base draft, validates the combined result, derives normalized
 * totals, and increments draftVersion atomically.
 */
export type ApplyRecommendationDraftInput = {
  draftVersion: number;
  proposedFields: RecommendationProposedFields;
};

export type ApplyRecommendationDraftResult = {
  draft: FreightRequestDraft;
};

export type RecommendationDraftErrorCode =
  | "INVALID_INPUT"
  | "INVALID_DRAFT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STALE_DRAFT"
  | "DRAFT_UNAVAILABLE";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ENTRY_METHODS = new Set([
  "TOTAL_WEIGHT",
  "UNITS",
  "PACKAGES",
  "PALLETS",
  "LOTS",
  "SACKS",
]);
export const UNITIZED_METHODS = new Set([
  "UNITS",
  "PACKAGES",
  "PALLETS",
  "LOTS",
  "SACKS",
]);
export const UNITIZED_FIELDS = new Set<RecommendationProposedFieldName>([
  "entry_quantity",
  "entry_unit_weight_kg",
  "units_per_entry",
]);
export const BOOLEAN_FIELDS = new Set<RecommendationProposedFieldName>([
  "requires_refrigeration",
  "is_hazardous",
  "is_fragile",
  "is_oversized",
  "is_high_value",
  "is_stackable",
  "cross_border",
]);
export const POSITIVE_NUMBER_FIELDS = new Set<RecommendationProposedFieldName>([
  "entry_quantity",
  "entry_unit_weight_kg",
  "entry_length_cm",
  "entry_width_cm",
  "entry_height_cm",
  "budget_max",
]);
export const OPTIONAL_NUMBER_FIELDS = new Set<RecommendationProposedFieldName>([
  "temperature_min_c",
  "temperature_max_c",
]);
export const TEXT_FIELDS = new Set<RecommendationProposedFieldName>([
  "origin_city",
  "origin_address",
  "pickup_contact_name",
  "pickup_contact_phone",
  "destination_city",
  "destination_address",
  "receiver_name",
  "receiver_company",
  "receiver_phone",
  "cargo_description",
  "special_instructions",
  "pickup_window_start",
  "pickup_window_end",
  "delivery_deadline",
]);

export type FreightRequestDraftRow = {
  id: string;
  code: string;
  organization_id: string;
  draft_version: number;
  cargo_category_id: string;
  origin_country: string;
  origin_city: string;
  origin_address: string | null;
  pickup_contact_name: string | null;
  pickup_contact_phone: string | null;
  destination_country: string;
  destination_city: string;
  destination_address: string | null;
  receiver_name: string | null;
  receiver_company: string | null;
  receiver_phone: string | null;
  cargo_description: string | null;
  cargo_entry_method: string;
  entry_quantity: number | null;
  entry_unit_weight_kg: number | null;
  units_per_entry: number | null;
  entry_length_cm: number | null;
  entry_width_cm: number | null;
  entry_height_cm: number | null;
  package_count: number | null;
  cargo_specifications: unknown;
  requires_refrigeration: boolean;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  is_hazardous: boolean;
  is_fragile: boolean;
  is_oversized: boolean;
  is_high_value: boolean;
  is_stackable: boolean;
  special_instructions: string | null;
  pickup_mode: string;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  required_pickup: string;
  delivery_deadline: string | null;
  budget_max: number | null;
  optimization_strategy: string;
  available_documents: unknown;
  cross_border: boolean;
  cargo_weight_kg: number;
  cargo_volume_m3: number | null;
  service_type: string;
  transport_mode: string;
  status: string;
};

export type NormalizedDraft = {
  fields: RecommendationProposedFields;
  cargoWeightKg: number;
  cargoVolumeM3: number | null;
};

export class RecommendationDraftError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "RecommendationDraftError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is RecommendationJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function asFiniteNumber(value: unknown, field: string, required = true): number | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidDraft(`${field} debe ser un número finito.`);
  }
  return value;
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidDraft(`${field} debe ser un texto no vacío.`);
  }
  return value.trim();
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function invalidDraft(message: string): RecommendationDraftError {
  return new RecommendationDraftError("INVALID_DRAFT", message, 422);
}

export function invalidInput(message: string): RecommendationDraftError {
  return new RecommendationDraftError("INVALID_INPUT", message, 400);
}

export function optionalField(
  target: RecommendationProposedFields,
  field: RecommendationProposedFieldName,
  value: RecommendationJsonValue | null | undefined,
) {
  if (value !== null && value !== undefined) target[field] = value;
}

export function jsonObject(value: unknown): Record<string, RecommendationJsonValue> {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? (value as Record<string, RecommendationJsonValue>)
    : {};
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...new Set(value.map((item) => item.trim()).filter(Boolean))]
    : [];
}

export function isoDate(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw invalidDraft(`${field} debe ser fecha ISO válida.`);
  return new Date(timestamp).toISOString();
}

export function currentFields(row: FreightRequestDraftRow): RecommendationProposedFields {
  const fields: RecommendationProposedFields = {
    origin_country: row.origin_country,
    origin_city: row.origin_city,
    destination_country: row.destination_country,
    destination_city: row.destination_city,
    cargo_category_id: row.cargo_category_id,
    cargo_entry_method: row.cargo_entry_method,
    cargo_specifications: jsonObject(row.cargo_specifications),
    requires_refrigeration: row.requires_refrigeration,
    is_hazardous: row.is_hazardous,
    is_fragile: row.is_fragile,
    is_oversized: row.is_oversized,
    is_high_value: row.is_high_value,
    is_stackable: row.is_stackable,
    pickup_mode: row.pickup_mode,
    available_documents: stringArray(row.available_documents),
    cross_border: row.origin_country !== row.destination_country,
  };

  optionalField(fields, "origin_address", row.origin_address);
  optionalField(fields, "pickup_contact_name", row.pickup_contact_name);
  optionalField(fields, "pickup_contact_phone", row.pickup_contact_phone);
  optionalField(fields, "destination_address", row.destination_address);
  optionalField(fields, "receiver_name", row.receiver_name);
  optionalField(fields, "receiver_company", row.receiver_company);
  optionalField(fields, "receiver_phone", row.receiver_phone);
  optionalField(fields, "cargo_description", row.cargo_description);
  optionalField(fields, "entry_quantity", row.entry_quantity);
  optionalField(fields, "entry_unit_weight_kg", row.entry_unit_weight_kg);
  optionalField(fields, "units_per_entry", row.units_per_entry);
  optionalField(fields, "entry_length_cm", row.entry_length_cm);
  optionalField(fields, "entry_width_cm", row.entry_width_cm);
  optionalField(fields, "entry_height_cm", row.entry_height_cm);
  optionalField(fields, "package_count", row.package_count);
  optionalField(fields, "temperature_min_c", row.temperature_min_c);
  optionalField(fields, "temperature_max_c", row.temperature_max_c);
  optionalField(fields, "special_instructions", row.special_instructions);
  optionalField(fields, "pickup_window_start", row.pickup_window_start);
  optionalField(fields, "pickup_window_end", row.pickup_window_end);
  optionalField(fields, "delivery_deadline", row.delivery_deadline);
  optionalField(fields, "budget_max", row.budget_max);
  optionalField(fields, "optimization_strategy", row.optimization_strategy);
  return fields;
}

export function draftFromRow(row: FreightRequestDraftRow): FreightRequestDraft {
  return {
    schemaVersion: FREIGHT_REQUEST_DRAFT_SCHEMA_VERSION,
    freightRequestId: row.id,
    requestCode: row.code,
    draftVersion: row.draft_version,
    fields: currentFields(row),
    normalized: {
      cargoWeightKg: row.cargo_weight_kg,
      cargoVolumeM3: row.cargo_volume_m3,
    },
  };
}

export function parseApplyInput(raw: unknown): ApplyRecommendationDraftInput {
  if (!isRecord(raw) || Object.keys(raw).length !== 2 || !("draftVersion" in raw) || !("proposedFields" in raw)) {
    throw invalidInput("El payload admite únicamente draftVersion y proposedFields.");
  }
  if (typeof raw.draftVersion !== "number" || !Number.isInteger(raw.draftVersion) || raw.draftVersion < 1) {
    throw invalidInput("draftVersion debe ser un entero mayor o igual a 1.");
  }
  if (!isRecord(raw.proposedFields) || Object.keys(raw.proposedFields).length === 0) {
    throw invalidInput("proposedFields debe contener al menos un campo seleccionado.");
  }
  const unknown = Object.keys(raw.proposedFields).find(
    (field) => !RECOMMENDATION_PROPOSED_FIELD_NAMES.includes(field as RecommendationProposedFieldName),
  );
  if (unknown) throw invalidInput(`proposedFields contiene '${unknown}', que no es canónico.`);
  if (!Object.values(raw.proposedFields).every(isJsonValue)) {
    throw invalidInput("proposedFields contiene un valor JSON no válido.");
  }
  return {
    draftVersion: raw.draftVersion,
    proposedFields: raw.proposedFields as RecommendationProposedFields,
  };
}

export function validateSelectedValue(field: RecommendationProposedFieldName, value: RecommendationJsonValue) {
  if (BOOLEAN_FIELDS.has(field)) {
    if (typeof value !== "boolean") throw invalidDraft(`${field} debe ser booleano.`);
    return;
  }
  if (POSITIVE_NUMBER_FIELDS.has(field)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw invalidDraft(`${field} debe ser un número mayor que cero.`);
    }
    return;
  }
  if (OPTIONAL_NUMBER_FIELDS.has(field)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw invalidDraft(`${field} debe ser un número finito.`);
    }
    return;
  }
  if (TEXT_FIELDS.has(field)) {
    requiredString(value, field);
    if (field.endsWith("_start") || field.endsWith("_end") || field === "delivery_deadline") {
      isoDate(value as string, field);
    }
    return;
  }
  if (field === "origin_country" || field === "destination_country") {
    if (typeof value !== "string" || !/^[A-Za-z]{2}$/.test(value.trim())) {
      throw invalidDraft(`${field} debe ser un código ISO de país de dos letras.`);
    }
    return;
  }
  if (field === "cargo_category_id") {
    if (!isUuid(value)) throw invalidDraft("cargo_category_id debe ser UUID.");
    return;
  }
  if (field === "cargo_entry_method") {
    if (typeof value !== "string" || !ENTRY_METHODS.has(value)) {
      throw invalidDraft("cargo_entry_method no está permitido.");
    }
    return;
  }
  if (field === "package_count" || field === "units_per_entry") {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw invalidDraft(`${field} debe ser un entero mayor que cero.`);
    }
    return;
  }
  if (field === "pickup_mode") {
    if (value !== "ASAP" && value !== "SCHEDULED") throw invalidDraft("pickup_mode no está permitido.");
    return;
  }
  if (field === "optimization_strategy") {
    if (value !== "BALANCED") throw invalidDraft("optimization_strategy no está permitido.");
    return;
  }
  if (field === "available_documents") {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
      throw invalidDraft("available_documents debe ser un arreglo de textos no vacíos.");
    }
    return;
  }
  if (field === "cargo_specifications") {
    if (!isRecord(value)) throw invalidDraft("cargo_specifications debe ser un objeto JSON.");
  }
}

export function normalizedDraft(
  row: FreightRequestDraftRow,
  proposedFields: RecommendationProposedFields,
): NormalizedDraft {
  for (const [field, value] of Object.entries(proposedFields) as Array<[RecommendationProposedFieldName, RecommendationJsonValue]>) {
    validateSelectedValue(field, value);
  }

  const fields: RecommendationProposedFields = { ...currentFields(row), ...proposedFields };
  fields.origin_country = requiredString(fields.origin_country, "origin_country").toUpperCase();
  fields.destination_country = requiredString(fields.destination_country, "destination_country").toUpperCase();
  fields.origin_city = requiredString(fields.origin_city, "origin_city");
  fields.destination_city = requiredString(fields.destination_city, "destination_city");
  fields.cargo_category_id = requiredString(fields.cargo_category_id, "cargo_category_id");

  const entryMethod = requiredString(fields.cargo_entry_method, "cargo_entry_method");
  if (!ENTRY_METHODS.has(entryMethod)) throw invalidDraft("cargo_entry_method no está permitido.");
  fields.cargo_entry_method = entryMethod;

  let cargoWeightKg = row.cargo_weight_kg;
  let cargoVolumeM3 = row.cargo_volume_m3;
  if (entryMethod === "TOTAL_WEIGHT") {
    const prohibited = [...UNITIZED_FIELDS].find((field) => Object.hasOwn(proposedFields, field));
    if (prohibited) throw invalidDraft(`${prohibited} no se aplica con TOTAL_WEIGHT.`);
    delete fields.entry_quantity;
    delete fields.entry_unit_weight_kg;
    delete fields.units_per_entry;
    if (!(cargoWeightKg > 0)) throw invalidDraft("TOTAL_WEIGHT requiere un peso total persistido válido.");
  } else if (UNITIZED_METHODS.has(entryMethod)) {
    const quantity = asFiniteNumber(fields.entry_quantity, "entry_quantity");
    const unitWeight = asFiniteNumber(fields.entry_unit_weight_kg, "entry_unit_weight_kg");
    const unitsPerEntry = asFiniteNumber(fields.units_per_entry, "units_per_entry");
    const length = asFiniteNumber(fields.entry_length_cm, "entry_length_cm");
    const width = asFiniteNumber(fields.entry_width_cm, "entry_width_cm");
    const height = asFiniteNumber(fields.entry_height_cm, "entry_height_cm");
    if (!quantity || !unitWeight || !unitsPerEntry || !length || !width || !height || !Number.isInteger(unitsPerEntry)) {
      throw invalidDraft("El método unitizado requiere cantidad, peso, unidades por entrada y dimensiones válidas.");
    }
    cargoWeightKg = quantity * unitWeight * unitsPerEntry;
    cargoVolumeM3 = (quantity * unitsPerEntry * length * width * height) / 1_000_000;
  }

  const pickupMode = fields.pickup_mode;
  if (pickupMode === "ASAP") {
    delete fields.pickup_window_start;
    delete fields.pickup_window_end;
  } else if (pickupMode === "SCHEDULED") {
    const start = isoDate(requiredString(fields.pickup_window_start, "pickup_window_start"), "pickup_window_start");
    const end = isoDate(requiredString(fields.pickup_window_end, "pickup_window_end"), "pickup_window_end");
    if (Date.parse(end) <= Date.parse(start)) throw invalidDraft("pickup_window_end debe ser posterior a pickup_window_start.");
    fields.pickup_window_start = start;
    fields.pickup_window_end = end;
    if (fields.delivery_deadline !== undefined) {
      const deadline = isoDate(requiredString(fields.delivery_deadline, "delivery_deadline"), "delivery_deadline");
      if (Date.parse(deadline) <= Date.parse(start)) throw invalidDraft("delivery_deadline debe ser posterior al recojo.");
      fields.delivery_deadline = deadline;
    }
  } else {
    throw invalidDraft("pickup_mode no está permitido.");
  }

  if (fields.requires_refrigeration === false) {
    delete fields.temperature_min_c;
    delete fields.temperature_max_c;
  } else if (fields.temperature_min_c !== undefined && fields.temperature_max_c !== undefined) {
    if (Number(fields.temperature_min_c) > Number(fields.temperature_max_c)) {
      throw invalidDraft("temperature_min_c no puede superar temperature_max_c.");
    }
  }

  const derivedCrossBorder = fields.origin_country !== fields.destination_country;
  if (Object.hasOwn(proposedFields, "cross_border") && fields.cross_border !== derivedCrossBorder) {
    throw invalidDraft("cross_border debe coincidir con los países de origen y destino.");
  }
  fields.cross_border = derivedCrossBorder;

  if (Array.isArray(fields.available_documents)) {
    fields.available_documents = stringArray(fields.available_documents);
  }
  return { fields, cargoWeightKg, cargoVolumeM3 };
}

export const __test__ = {
  currentFields,
  normalizedDraft,
  parseApplyInput,
};
