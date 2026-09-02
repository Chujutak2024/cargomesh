import "server-only";

import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  FREIGHT_REQUEST_DRAFT_SELECT,
  RecommendationDraftError,
  getAuthorizedFreightRequestDraftRow,
  patchForDatabase,
} from "@/features/recommendations/recommendation-draft-server";
import { persistEditableFreightRequest } from "@/features/recommendations/recommendation-draft-persistence";

import {
  parseManualFreightRequestIntakeInput,
  type OfficialCargoCategoryCode,
} from "./manual-intake-contracts";
import {
  normalizeManualFreightRequestIntake,
  type ManualFreightRequestDraftRow,
} from "./manual-intake-normalizer";
import { getFreightRequestIntake } from "./intake-server";

async function resolveOfficialCargoCategoryId(code: OfficialCargoCategoryCode): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cargo_categories")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    throw new RecommendationDraftError("DRAFT_UNAVAILABLE", "No fue posible validar la categoría.", 500);
  }
  if (!data) {
    throw new RecommendationDraftError("INVALID_DRAFT", "La categoría seleccionada no está disponible.", 422);
  }
  return (data as { id: string }).id;
}

/**
 * C-owned writer for direct user edits. D1-01 remains exclusively for the
 * explicit acceptance of a WebMCP recommendation.
 */
export async function persistManualFreightRequestIntake(
  freightRequestId: string,
  rawInput: unknown,
) {
  const input = parseManualFreightRequestIntakeInput(rawInput);
  const current = await getAuthorizedFreightRequestDraftRow(freightRequestId) as ManualFreightRequestDraftRow;
  if (current.draft_version !== input.draftVersion) {
    throw new RecommendationDraftError(
      "STALE_DRAFT",
      "El borrador cambió; recárgalo antes de guardar.",
      409,
    );
  }
  if (!new Set(["DRAFT", "PENDING"]).has(current.status)) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "La solicitud ya no acepta cambios de borrador.",
      422,
    );
  }
  await requireAuthenticatedMember({
    organizationId: current.organization_id,
    requiredRole: "SUPERVISOR",
  });

  const categoryId = input.fields.cargoCategoryCode
    ? await resolveOfficialCargoCategoryId(input.fields.cargoCategoryCode)
    : undefined;
  const manual = normalizeManualFreightRequestIntake(current, input.fields, categoryId);
  const patch = {
    ...patchForDatabase(manual.normalized, current.draft_version),
    origin_region: manual.originRegion,
    destination_region: manual.destinationRegion,
    required_pickup: manual.requiredPickup,
  };
  const supabase = await createServerSupabaseClient();
  const persisted = await persistEditableFreightRequest(
    supabase.from("freight_requests").update(patch as never),
    current,
    FREIGHT_REQUEST_DRAFT_SELECT,
  );
  return getFreightRequestIntake(persisted.code);
}

export { RecommendationDraftError };
