import type { RecommendationProposedFields } from "@/features/recommendations/contracts";
import {
  RecommendationDraftError,
  normalizedDraft,
  type FreightRequestDraftRow,
  type NormalizedDraft,
} from "@/features/recommendations/recommendation-draft-contracts";

import type { ManualFreightRequestIntakeFields } from "./manual-intake-contracts";

export type ManualFreightRequestDraftRow = FreightRequestDraftRow & {
  origin_region: string | null;
  destination_region: string | null;
};

export type NormalizedManualFreightRequestIntake = {
  normalized: NormalizedDraft;
  originRegion: string | null;
  destinationRegion: string | null;
  requiredPickup: string;
};

type FieldValue = ManualFreightRequestIntakeFields[keyof ManualFreightRequestIntakeFields];

function owns(fields: ManualFreightRequestIntakeFields, field: keyof ManualFreightRequestIntakeFields) {
  return Object.hasOwn(fields, field);
}

function setOptional(
  row: ManualFreightRequestDraftRow,
  proposed: RecommendationProposedFields,
  fields: ManualFreightRequestIntakeFields,
  source: keyof ManualFreightRequestIntakeFields,
  target: keyof ManualFreightRequestDraftRow,
  proposedName: keyof RecommendationProposedFields,
) {
  if (!owns(fields, source)) return;
  const value = fields[source] as FieldValue;
  row[target] = value as never;
  if (value !== null && value !== undefined) proposed[proposedName] = value as never;
}

function setRequired(
  row: ManualFreightRequestDraftRow,
  proposed: RecommendationProposedFields,
  fields: ManualFreightRequestIntakeFields,
  source: keyof ManualFreightRequestIntakeFields,
  target: keyof ManualFreightRequestDraftRow,
  proposedName: keyof RecommendationProposedFields,
) {
  if (!owns(fields, source)) return;
  const value = fields[source];
  row[target] = value as never;
  proposed[proposedName] = value as never;
}

/**
 * Normalizes manual input against the last authorized row. Unlike D1-01, this
 * accepts explicit nulls so the manual UI can clear optional values. It still
 * delegates all total and cross-border derivation to the canonical D1 logic.
 */
export function normalizeManualFreightRequestIntake(
  current: ManualFreightRequestDraftRow,
  fields: ManualFreightRequestIntakeFields,
  categoryId: string | undefined,
  now: Date = new Date(),
): NormalizedManualFreightRequestIntake {
  const row = { ...current };
  const proposed: RecommendationProposedFields = {};

  if (categoryId) {
    row.cargo_category_id = categoryId;
    proposed.cargo_category_id = categoryId;
  }
  setRequired(row, proposed, fields, "originCountry", "origin_country", "origin_country");
  setOptional(row, proposed, fields, "originAddress", "origin_address", "origin_address");
  setRequired(row, proposed, fields, "originCity", "origin_city", "origin_city");
  setRequired(row, proposed, fields, "destinationCountry", "destination_country", "destination_country");
  setOptional(row, proposed, fields, "destinationAddress", "destination_address", "destination_address");
  setRequired(row, proposed, fields, "destinationCity", "destination_city", "destination_city");
  setOptional(row, proposed, fields, "pickupContactName", "pickup_contact_name", "pickup_contact_name");
  setOptional(row, proposed, fields, "pickupContactPhone", "pickup_contact_phone", "pickup_contact_phone");
  setOptional(row, proposed, fields, "receiverName", "receiver_name", "receiver_name");
  setOptional(row, proposed, fields, "receiverCompany", "receiver_company", "receiver_company");
  setOptional(row, proposed, fields, "receiverPhone", "receiver_phone", "receiver_phone");
  setOptional(row, proposed, fields, "cargoDescription", "cargo_description", "cargo_description");
  setRequired(row, proposed, fields, "cargoEntryMethod", "cargo_entry_method", "cargo_entry_method");
  setOptional(row, proposed, fields, "entryQuantity", "entry_quantity", "entry_quantity");
  setOptional(row, proposed, fields, "entryUnitWeightKg", "entry_unit_weight_kg", "entry_unit_weight_kg");
  setOptional(row, proposed, fields, "unitsPerEntry", "units_per_entry", "units_per_entry");
  setOptional(row, proposed, fields, "entryLengthCm", "entry_length_cm", "entry_length_cm");
  setOptional(row, proposed, fields, "entryWidthCm", "entry_width_cm", "entry_width_cm");
  setOptional(row, proposed, fields, "entryHeightCm", "entry_height_cm", "entry_height_cm");
  setRequired(row, proposed, fields, "pickupMode", "pickup_mode", "pickup_mode");
  setOptional(row, proposed, fields, "pickupWindowStart", "pickup_window_start", "pickup_window_start");
  setOptional(row, proposed, fields, "pickupWindowEnd", "pickup_window_end", "pickup_window_end");
  setOptional(row, proposed, fields, "deliveryDeadline", "delivery_deadline", "delivery_deadline");
  setOptional(row, proposed, fields, "budgetMax", "budget_max", "budget_max");
  setOptional(row, proposed, fields, "specialInstructions", "special_instructions", "special_instructions");
  setRequired(row, proposed, fields, "availableDocuments", "available_documents", "available_documents");

  if (owns(fields, "originRegion")) row.origin_region = fields.originRegion ?? null;
  if (owns(fields, "destinationRegion")) row.destination_region = fields.destinationRegion ?? null;

  if (owns(fields, "totalWeightKg")) {
    if (row.cargo_entry_method !== "TOTAL_WEIGHT") {
      throw new RecommendationDraftError(
        "INVALID_DRAFT",
        "totalWeightKg solo se aplica con TOTAL_WEIGHT.",
        422,
      );
    }
    row.cargo_weight_kg = fields.totalWeightKg as number;
  }

  const normalized = normalizedDraft(row, proposed);
  const pickupMode = normalized.fields.pickup_mode;
  const requiredPickup = pickupMode === "ASAP"
    ? now.toISOString()
    : normalized.fields.pickup_window_start as string;

  return {
    normalized,
    originRegion: row.origin_region,
    destinationRegion: row.destination_region,
    requiredPickup,
  };
}
