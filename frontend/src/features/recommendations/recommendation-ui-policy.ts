import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import {
  RECOMMENDATION_PROPOSED_FIELD_NAMES,
  type FreightRecommendationToolEnvelope,
  type RecommendationJsonValue,
  type RecommendationProposedFieldName,
  type RecommendationProposedFields,
} from "./contracts";

const UNITIZED_FIELDS = new Set<RecommendationProposedFieldName>([
  "entry_quantity",
  "entry_unit_weight_kg",
  "units_per_entry",
]);

export const SUPPORTED_INTAKE_RECOMMENDATION_FIELDS = new Set<RecommendationProposedFieldName>(
  RECOMMENDATION_PROPOSED_FIELD_NAMES,
);

const FIELD_LABELS: Record<RecommendationProposedFieldName, string> = {
  origin_country: "País de origen",
  origin_city: "Ciudad de origen",
  origin_address: "Dirección de origen",
  pickup_contact_name: "Contacto de recojo",
  pickup_contact_phone: "Teléfono de recojo",
  destination_country: "País de destino",
  destination_city: "Ciudad de destino",
  destination_address: "Dirección de destino",
  receiver_name: "Contacto de entrega",
  receiver_company: "Empresa receptora",
  receiver_phone: "Teléfono de entrega",
  cargo_category_id: "Categoría de carga",
  cargo_description: "Descripción de carga",
  cargo_entry_method: "Método de ingreso",
  entry_quantity: "Cantidad de entradas",
  entry_unit_weight_kg: "Peso unitario (kg)",
  units_per_entry: "Unidades por entrada",
  entry_length_cm: "Largo por entrada (cm)",
  entry_width_cm: "Ancho por entrada (cm)",
  entry_height_cm: "Alto por entrada (cm)",
  package_count: "Cantidad de paquetes",
  cargo_specifications: "Especificaciones de carga",
  requires_refrigeration: "Requiere refrigeración",
  temperature_min_c: "Temperatura mínima (°C)",
  temperature_max_c: "Temperatura máxima (°C)",
  is_hazardous: "Carga peligrosa",
  is_fragile: "Carga frágil",
  is_oversized: "Carga sobredimensionada",
  is_high_value: "Carga de alto valor",
  is_stackable: "Carga apilable",
  special_instructions: "Instrucciones especiales",
  pickup_mode: "Modo de recojo",
  pickup_window_start: "Inicio de ventana de recojo",
  pickup_window_end: "Fin de ventana de recojo",
  delivery_deadline: "Deadline de entrega",
  budget_max: "Presupuesto máximo",
  optimization_strategy: "Estrategia",
  available_documents: "Documentos disponibles",
  cross_border: "Operación transfronteriza",
};

export type RecommendationDiffRow = {
  field: RecommendationProposedFieldName;
  label: string;
  currentValue: RecommendationJsonValue | undefined;
  proposedValue: RecommendationJsonValue;
  selectable: boolean;
};

export type RecommendationResultState = "ready" | "empty" | "stale" | "error";

export function classifyRecommendationResult(
  result: FreightRecommendationToolEnvelope,
): RecommendationResultState {
  if (!result.ok) return result.error.code === "STALE_DRAFT" ? "stale" : "error";
  return result.data.suggestions.length === 0 ? "empty" : "ready";
}

export function recommendationFieldLabel(field: RecommendationProposedFieldName) {
  return FIELD_LABELS[field];
}

export function canonicalValuesFromIntake(
  form: FreightIntakeModel,
): RecommendationProposedFields {
  return {
    ...form.recommendationValues,
    cargo_entry_method: form.entryMethod,
    entry_quantity: form.quantity,
    entry_unit_weight_kg: form.unitWeightKg,
    units_per_entry: form.unitsPerEntry,
    entry_length_cm: form.lengthCm,
    entry_width_cm: form.widthCm,
    entry_height_cm: form.heightCm,
    pickup_mode: form.pickupMode,
    pickup_window_start: form.pickupWindowStart,
    pickup_window_end: form.pickupWindowEnd,
    delivery_deadline: form.deliveryDeadline,
    budget_max: form.budgetMaxUsd,
    optimization_strategy: form.strategy,
    available_documents: [...form.documents],
  };
}

export function buildRecommendationDiff(
  form: FreightIntakeModel,
  proposedFields: RecommendationProposedFields,
): RecommendationDiffRow[] {
  const currentValues = canonicalValuesFromIntake(form);
  return RECOMMENDATION_PROPOSED_FIELD_NAMES.flatMap((field) => {
    const proposedValue = proposedFields[field];
    if (proposedValue === undefined) return [];
    return [{
      field,
      label: recommendationFieldLabel(field),
      currentValue: currentValues[field],
      proposedValue,
      selectable: SUPPORTED_INTAKE_RECOMMENDATION_FIELDS.has(field),
    }];
  });
}

export function selectApplicableRecommendationFields(
  form: FreightIntakeModel,
  proposedFields: RecommendationProposedFields,
  selectedFields: ReadonlySet<RecommendationProposedFieldName>,
): RecommendationProposedFields {
  const selected: RecommendationProposedFields = {};
  const selectedEntryMethod = selectedFields.has("cargo_entry_method")
    ? proposedFields.cargo_entry_method
    : form.entryMethod;
  const totalWeight = selectedEntryMethod === "TOTAL_WEIGHT";

  for (const field of RECOMMENDATION_PROPOSED_FIELD_NAMES) {
    if (!selectedFields.has(field) || !SUPPORTED_INTAKE_RECOMMENDATION_FIELDS.has(field)) continue;
    if (totalWeight && UNITIZED_FIELDS.has(field)) continue;
    const value = proposedFields[field];
    if (value !== undefined) selected[field] = value;
  }
  return selected;
}

function finiteNumber(value: RecommendationJsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: RecommendationJsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function applyRecommendationFieldsToIntake(
  form: FreightIntakeModel,
  fields: RecommendationProposedFields,
): FreightIntakeModel {
  if (Object.keys(fields).length === 0) return form;
  const next = { ...form };
  next.recommendationValues = { ...form.recommendationValues, ...fields };

  const entryMethod = stringValue(fields.cargo_entry_method);
  if (entryMethod) next.entryMethod = entryMethod;
  const quantity = finiteNumber(fields.entry_quantity);
  if (quantity !== undefined) next.quantity = quantity;
  const unitWeight = finiteNumber(fields.entry_unit_weight_kg);
  if (unitWeight !== undefined) next.unitWeightKg = unitWeight;
  const unitsPerEntry = finiteNumber(fields.units_per_entry);
  if (unitsPerEntry !== undefined) next.unitsPerEntry = unitsPerEntry;
  const length = finiteNumber(fields.entry_length_cm);
  if (length !== undefined) next.lengthCm = length;
  const width = finiteNumber(fields.entry_width_cm);
  if (width !== undefined) next.widthCm = width;
  const height = finiteNumber(fields.entry_height_cm);
  if (height !== undefined) next.heightCm = height;
  const pickupMode = stringValue(fields.pickup_mode);
  if (pickupMode === "ASAP" || pickupMode === "SCHEDULED") next.pickupMode = pickupMode;
  const pickupStart = stringValue(fields.pickup_window_start);
  if (pickupStart !== undefined) next.pickupWindowStart = pickupStart;
  const pickupEnd = stringValue(fields.pickup_window_end);
  if (pickupEnd !== undefined) next.pickupWindowEnd = pickupEnd;
  const deadline = stringValue(fields.delivery_deadline);
  if (deadline !== undefined) next.deliveryDeadline = deadline;
  const budget = finiteNumber(fields.budget_max);
  if (budget !== undefined) next.budgetMaxUsd = budget;
  if (fields.optimization_strategy === "BALANCED") next.strategy = "BALANCED";
  if (
    Array.isArray(fields.available_documents) &&
    fields.available_documents.every((value) => typeof value === "string")
  ) {
    next.documents = fields.available_documents as string[];
  }

  if (next.entryMethod === "TOTAL_WEIGHT") {
    next.unitsPerEntry = 0;
    delete next.recommendationValues.entry_quantity;
    delete next.recommendationValues.entry_unit_weight_kg;
    delete next.recommendationValues.units_per_entry;
  }
  return next;
}
