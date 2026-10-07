import {
  RECOMMENDATION_PROPOSED_FIELD_NAMES,
  type FreightRecommendationEnvelope,
  type FreightRecommendationErrorCode,
  type FreightRecommendationInput,
  type FreightRecommendationSourceType,
  type FreightRecommendationToolEnvelope,
  type RecommendationJsonValue,
  type RecommendationProposedFields,
} from "./contracts";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const inputKeys = new Set(["freightRequestId", "draftVersion"]);
const envelopeKeys = new Set([
  "schemaVersion",
  "freightRequestId",
  "draftVersion",
  "suggestions",
]);
const suggestionKeys = new Set([
  "suggestionId",
  "sourceType",
  "sourceRequestId",
  "sourceProfileId",
  "reasonCodes",
  "explanation",
  "proposedFields",
]);
const proposedFieldNames = new Set<string>(RECOMMENDATION_PROPOSED_FIELD_NAMES);
const sourceTypes = new Set<FreightRecommendationSourceType>([
  "ORGANIZATION_HISTORY",
  "SYNTHETIC_RECOMMENDATION_HISTORY",
  "CARGO_PROFILE",
]);
const errorCodes = new Set<FreightRecommendationErrorCode>([
  "INVALID_INPUT",
  "FORBIDDEN",
  "REQUEST_NOT_FOUND",
  "STALE_DRAFT",
  "INVALID_RECOMMENDATION_RESPONSE",
  "RECOMMENDATIONS_UNAVAILABLE",
]);
const unitizedOnlyFields = [
  "entry_quantity",
  "entry_unit_weight_kg",
  "units_per_entry",
] as const;
const unitizedEntryMethods = new Set([
  "UNITS",
  "PACKAGES",
  "PALLETS",
  "LOTS",
  "SACKS",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isJsonValue(value: unknown): value is RecommendationJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function validateProposedFields(value: unknown): ParseResult<RecommendationProposedFields> {
  if (!isRecord(value)) {
    return { ok: false, message: "proposedFields debe ser un objeto JSON." };
  }

  const unknownField = Object.keys(value).find(
    (fieldName) => !proposedFieldNames.has(fieldName),
  );
  if (unknownField) {
    return {
      ok: false,
      message: `proposedFields contiene el campo no canónico '${unknownField}'.`,
    };
  }

  const invalidValue = Object.entries(value).find(([, fieldValue]) =>
    !isJsonValue(fieldValue),
  );
  if (invalidValue) {
    return {
      ok: false,
      message: `proposedFields.${invalidValue[0]} no contiene un valor JSON válido.`,
    };
  }

  const hasUnitizedOnlyFields = unitizedOnlyFields.some((fieldName) =>
    Object.hasOwn(value, fieldName),
  );
  if (hasUnitizedOnlyFields) {
    const entryMethod = value.cargo_entry_method;
    if (typeof entryMethod !== "string" || !unitizedEntryMethods.has(entryMethod)) {
      return {
        ok: false,
        message:
          "Los campos unitizados requieren cargo_entry_method explícito y distinto de TOTAL_WEIGHT.",
      };
    }
  }

  return { ok: true, value: value as RecommendationProposedFields };
}

export function parseFreightRecommendationInput(
  value: unknown,
): ParseResult<FreightRecommendationInput> {
  if (!isRecord(value)) {
    return { ok: false, message: "El payload debe ser un objeto JSON." };
  }
  if (!hasOnlyKeys(value, inputKeys) || Object.keys(value).length !== 2) {
    return {
      ok: false,
      message: "El payload admite únicamente freightRequestId y draftVersion.",
    };
  }
  if (!isUuid(value.freightRequestId)) {
    return { ok: false, message: "freightRequestId debe ser un UUID válido." };
  }
  if (
    typeof value.draftVersion !== "number" ||
    !Number.isInteger(value.draftVersion) ||
    value.draftVersion < 1
  ) {
    return { ok: false, message: "draftVersion debe ser un entero mayor o igual a 1." };
  }
  return {
    ok: true,
    value: {
      freightRequestId: value.freightRequestId,
      draftVersion: value.draftVersion,
    },
  };
}

export function validateFreightRecommendationEnvelope(
  value: unknown,
  expected: FreightRecommendationInput,
): ParseResult<FreightRecommendationEnvelope> {
  if (!isRecord(value) || !hasOnlyKeys(value, envelopeKeys)) {
    return { ok: false, message: "El envelope de recomendaciones no es válido." };
  }
  if (value.schemaVersion !== "1.0") {
    return { ok: false, message: "schemaVersion debe ser '1.0'." };
  }
  if (value.freightRequestId !== expected.freightRequestId) {
    return { ok: false, message: "freightRequestId no coincide con la consulta." };
  }
  if (value.draftVersion !== expected.draftVersion) {
    return { ok: false, message: "draftVersion no coincide con la consulta." };
  }
  if (!Array.isArray(value.suggestions)) {
    return { ok: false, message: "suggestions debe ser un arreglo." };
  }

  for (const [index, suggestion] of value.suggestions.entries()) {
    if (!isRecord(suggestion) || !hasOnlyKeys(suggestion, suggestionKeys)) {
      return { ok: false, message: `suggestions[${index}] no es válido.` };
    }
    if (!isNonEmptyString(suggestion.suggestionId)) {
      return {
        ok: false,
        message: `suggestions[${index}].suggestionId es obligatorio.`,
      };
    }
    if (!sourceTypes.has(suggestion.sourceType as FreightRecommendationSourceType)) {
      return {
        ok: false,
        message: `suggestions[${index}].sourceType no pertenece al contrato.`,
      };
    }
    for (const sourceIdField of ["sourceRequestId", "sourceProfileId"] as const) {
      if (
        suggestion[sourceIdField] !== undefined &&
        !isUuid(suggestion[sourceIdField])
      ) {
        return {
          ok: false,
          message: `suggestions[${index}].${sourceIdField} debe ser UUID.`,
        };
      }
    }
    if (
      !Array.isArray(suggestion.reasonCodes) ||
      !suggestion.reasonCodes.every(isNonEmptyString) ||
      new Set(suggestion.reasonCodes).size !== suggestion.reasonCodes.length
    ) {
      return {
        ok: false,
        message: `suggestions[${index}].reasonCodes debe contener strings únicos.`,
      };
    }
    if (!isNonEmptyString(suggestion.explanation)) {
      return {
        ok: false,
        message: `suggestions[${index}].explanation es obligatorio.`,
      };
    }

    const proposedFields = validateProposedFields(suggestion.proposedFields);
    if (!proposedFields.ok) {
      return {
        ok: false,
        message: `suggestions[${index}]: ${proposedFields.message}`,
      };
    }
  }

  return { ok: true, value: value as FreightRecommendationEnvelope };
}

export function createRecommendationError(
  code: FreightRecommendationErrorCode,
  message: string,
  retryable = false,
): FreightRecommendationToolEnvelope {
  return { ok: false, error: { code, message, retryable } };
}

export function validateFreightRecommendationToolEnvelope(
  value: unknown,
  expected: FreightRecommendationInput,
): ParseResult<FreightRecommendationToolEnvelope> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return { ok: false, message: "La respuesta de la tool no es un envelope válido." };
  }

  if (value.ok) {
    if (!hasOnlyKeys(value, new Set(["ok", "data"]))) {
      return { ok: false, message: "El envelope exitoso contiene campos adicionales." };
    }
    const data = validateFreightRecommendationEnvelope(value.data, expected);
    return data.ok
      ? { ok: true, value: { ok: true, data: data.value } }
      : data;
  }

  if (!hasOnlyKeys(value, new Set(["ok", "error"])) || !isRecord(value.error)) {
    return { ok: false, message: "El envelope de error no es válido." };
  }
  if (
    !isNonEmptyString(value.error.code) ||
    !errorCodes.has(value.error.code as FreightRecommendationErrorCode) ||
    !isNonEmptyString(value.error.message) ||
    typeof value.error.retryable !== "boolean" ||
    !hasOnlyKeys(value.error, new Set(["code", "message", "retryable"]))
  ) {
    return { ok: false, message: "El error de la tool no pertenece al contrato." };
  }

  return { ok: true, value: value as FreightRecommendationToolEnvelope };
}
