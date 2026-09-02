import "server-only";

import type {
  FreightRecommendationEnvelope,
  FreightRecommendationSuggestion,
} from "./contracts";
import {
  FREIGHT_REQUEST_DRAFT_SCHEMA_VERSION,
  type ApplyRecommendationDraftInput,
  type FreightRequestDraft,
  type FreightRequestDraftRow,
  type NormalizedDraft,
  RecommendationDraftError,
  currentFields,
  draftFromRow,
  invalidDraft,
  invalidInput,
  isUuid,
  jsonObject,
  normalizedDraft,
  optionalString,
  parseApplyInput,
  requiredString,
  stringArray,
  __test__,
} from "./recommendation-draft-contracts";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistEditableFreightRequest } from "./recommendation-draft-persistence";

const FREIGHT_REQUEST_DRAFT_SELECT = [
  "id",
  "code",
  "organization_id",
  "draft_version",
  "cargo_category_id",
  "origin_country",
  "origin_city",
  "origin_address",
  "pickup_contact_name",
  "pickup_contact_phone",
  "destination_country",
  "destination_city",
  "destination_address",
  "receiver_name",
  "receiver_company",
  "receiver_phone",
  "cargo_description",
  "cargo_entry_method",
  "entry_quantity",
  "entry_unit_weight_kg",
  "units_per_entry",
  "entry_length_cm",
  "entry_width_cm",
  "entry_height_cm",
  "package_count",
  "cargo_specifications",
  "requires_refrigeration",
  "temperature_min_c",
  "temperature_max_c",
  "is_hazardous",
  "is_fragile",
  "is_oversized",
  "is_high_value",
  "is_stackable",
  "special_instructions",
  "pickup_mode",
  "pickup_window_start",
  "pickup_window_end",
  "required_pickup",
  "delivery_deadline",
  "budget_max",
  "optimization_strategy",
  "available_documents",
  "cross_border",
  "cargo_weight_kg",
  "cargo_volume_m3",
  "service_type",
  "transport_mode",
  "status",
].join(",");

async function getAuthorizedRow(freightRequestId: string): Promise<FreightRequestDraftRow> {
  if (!isUuid(freightRequestId)) throw invalidInput("freightRequestId debe ser UUID.");
  await requireAuthenticatedMember();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("freight_requests")
    .select(FREIGHT_REQUEST_DRAFT_SELECT)
    .eq("id", freightRequestId)
    .maybeSingle();

  if (error) {
    throw new RecommendationDraftError("DRAFT_UNAVAILABLE", "No fue posible leer el borrador.", 500);
  }
  if (data) return data as unknown as FreightRequestDraftRow;

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("freight_requests")
    .select("id")
    .eq("id", freightRequestId)
    .maybeSingle();
  if (lookupError) {
    throw new RecommendationDraftError("DRAFT_UNAVAILABLE", "No fue posible verificar el acceso al borrador.", 500);
  }
  if (existing) {
    throw new RecommendationDraftError("FORBIDDEN", "La sesión no puede acceder a este borrador.", 403);
  }
  throw new RecommendationDraftError("NOT_FOUND", "La solicitud no existe.", 404);
}

async function assertCargoCategoryExists(categoryId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cargo_categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw new RecommendationDraftError("DRAFT_UNAVAILABLE", "No fue posible validar la categoría.", 500);
  if (!data) throw invalidDraft("cargo_category_id no pertenece a una categoría disponible.");
}

function patchForDatabase(normalized: NormalizedDraft, currentVersion: number) {
  const fields = normalized.fields;
  return {
    origin_country: fields.origin_country as string,
    origin_city: fields.origin_city as string,
    origin_address: optionalString(fields.origin_address) ?? null,
    pickup_contact_name: optionalString(fields.pickup_contact_name) ?? null,
    pickup_contact_phone: optionalString(fields.pickup_contact_phone) ?? null,
    destination_country: fields.destination_country as string,
    destination_city: fields.destination_city as string,
    destination_address: optionalString(fields.destination_address) ?? null,
    receiver_name: optionalString(fields.receiver_name) ?? null,
    receiver_company: optionalString(fields.receiver_company) ?? null,
    receiver_phone: optionalString(fields.receiver_phone) ?? null,
    cargo_category_id: fields.cargo_category_id as string,
    cargo_description: optionalString(fields.cargo_description) ?? null,
    cargo_entry_method: fields.cargo_entry_method as string,
    entry_quantity: (fields.entry_quantity as number | undefined) ?? null,
    entry_unit_weight_kg: (fields.entry_unit_weight_kg as number | undefined) ?? null,
    units_per_entry: (fields.units_per_entry as number | undefined) ?? null,
    entry_length_cm: (fields.entry_length_cm as number | undefined) ?? null,
    entry_width_cm: (fields.entry_width_cm as number | undefined) ?? null,
    entry_height_cm: (fields.entry_height_cm as number | undefined) ?? null,
    package_count: (fields.package_count as number | undefined) ?? null,
    cargo_specifications: jsonObject(fields.cargo_specifications),
    requires_refrigeration: fields.requires_refrigeration as boolean,
    temperature_min_c: (fields.temperature_min_c as number | undefined) ?? null,
    temperature_max_c: (fields.temperature_max_c as number | undefined) ?? null,
    is_hazardous: fields.is_hazardous as boolean,
    is_fragile: fields.is_fragile as boolean,
    is_oversized: fields.is_oversized as boolean,
    is_high_value: fields.is_high_value as boolean,
    is_stackable: fields.is_stackable as boolean,
    special_instructions: optionalString(fields.special_instructions) ?? null,
    pickup_mode: fields.pickup_mode as string,
    pickup_window_start: (fields.pickup_window_start as string | undefined) ?? null,
    pickup_window_end: (fields.pickup_window_end as string | undefined) ?? null,
    delivery_deadline: (fields.delivery_deadline as string | undefined) ?? null,
    budget_max: (fields.budget_max as number | undefined) ?? null,
    optimization_strategy: fields.optimization_strategy as string,
    available_documents: stringArray(fields.available_documents),
    cross_border: fields.cross_border as boolean,
    cargo_weight_kg: normalized.cargoWeightKg,
    cargo_volume_m3: normalized.cargoVolumeM3,
    draft_version: currentVersion + 1,
    updated_at: new Date().toISOString(),
  };
}

function historySuggestion(row: FreightRequestDraftRow): FreightRecommendationSuggestion {
  const proposedFields = currentFields(row);
  delete proposedFields.pickup_window_start;
  delete proposedFields.pickup_window_end;
  delete proposedFields.delivery_deadline;
  const historicalSpecifications = jsonObject(row.cargo_specifications);
  const synthetic =
    historicalSpecifications.fixtureProvenance ===
    "D1_SYNTHETIC_RECOMMENDATION_HISTORY";
  // Provenance describes the historical source, never the cargo a user is
  // about to create. Keep it in sourceType/reasonCodes and out of the patch.
  delete historicalSpecifications.fixtureProvenance;
  delete historicalSpecifications.scenarioVersion;
  delete historicalSpecifications.notARealRun;
  proposedFields.cargo_specifications = historicalSpecifications;
  if (
    typeof proposedFields.special_instructions === "string" &&
    proposedFields.special_instructions.startsWith("[SYNTHETIC HISTORY]")
  ) {
    delete proposedFields.special_instructions;
  }
  return {
    suggestionId: `history:${row.id}:v1`,
    sourceType: synthetic ? "SYNTHETIC_RECOMMENDATION_HISTORY" : "ORGANIZATION_HISTORY",
    sourceRequestId: row.id,
    reasonCodes: synthetic
      ? ["SAME_CORRIDOR", "SAME_CATEGORY", "SYNTHETIC_DEMO_HISTORY"]
      : ["SAME_CORRIDOR", "SAME_CATEGORY"],
    explanation: synthetic
      ? "Antecedente sintético compatible para revisión humana; no representa una tarifa ni disponibilidad vigente."
      : "Antecedente de la misma organización y corredor para revisión humana.",
    proposedFields,
  };
}

export async function getFreightRequestDraft(freightRequestId: string): Promise<FreightRequestDraft> {
  return draftFromRow(await getAuthorizedRow(freightRequestId));
}

export async function getFreightRequestRecommendations(
  freightRequestId: string,
  draftVersion: number,
): Promise<FreightRecommendationEnvelope> {
  if (!Number.isInteger(draftVersion) || draftVersion < 1) {
    throw invalidInput("draftVersion debe ser un entero mayor o igual a 1.");
  }
  const current = await getAuthorizedRow(freightRequestId);
  if (current.draft_version !== draftVersion) {
    throw new RecommendationDraftError(
      "STALE_DRAFT",
      "El borrador cambió; recárgalo antes de consultar sugerencias.",
      409,
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("freight_requests")
    .select(FREIGHT_REQUEST_DRAFT_SELECT)
    .eq("organization_id", current.organization_id)
    .neq("id", current.id)
    .eq("status", "BOOKED")
    .eq("origin_country", current.origin_country)
    .eq("origin_city", current.origin_city)
    .eq("destination_country", current.destination_country)
    .eq("destination_city", current.destination_city)
    .eq("cargo_category_id", current.cargo_category_id)
    .eq("cross_border", current.cross_border)
    .order("updated_at", { ascending: false })
    .limit(3);
  if (error) {
    throw new RecommendationDraftError(
      "DRAFT_UNAVAILABLE",
      "No fue posible consultar los antecedentes autorizados.",
      500,
    );
  }

  return {
    schemaVersion: "1.0",
    freightRequestId: current.id,
    draftVersion: current.draft_version,
    suggestions: (data as unknown as FreightRequestDraftRow[] | null ?? []).map(historySuggestion),
  };
}

export async function applyFreightRequestRecommendation(
  freightRequestId: string,
  rawInput: unknown,
): Promise<FreightRequestDraft> {
  const input = parseApplyInput(rawInput);
  const current = await getAuthorizedRow(freightRequestId);
  if (current.draft_version !== input.draftVersion) {
    throw new RecommendationDraftError(
      "STALE_DRAFT",
      "El borrador cambió; no se aplicó ninguna sugerencia.",
      409,
    );
  }
  if (!new Set(["DRAFT", "PENDING"]).has(current.status)) {
    throw invalidDraft("La solicitud ya no acepta cambios de borrador.");
  }
  await requireAuthenticatedMember({
    organizationId: current.organization_id,
    requiredRole: "SUPERVISOR",
  });

  const normalized = normalizedDraft(current, input.proposedFields);
  await assertCargoCategoryExists(
    requiredString(normalized.fields.cargo_category_id, "cargo_category_id"),
  );

  const supabase = await createServerSupabaseClient();
  const databasePatch = patchForDatabase(normalized, current.draft_version);
  const persisted = await persistEditableFreightRequest(
    supabase.from("freight_requests").update(databasePatch as never),
    current,
    FREIGHT_REQUEST_DRAFT_SELECT,
  );
  return draftFromRow(persisted);
}

export { RecommendationDraftError, __test__ };
