import "server-only";

import { requireAuthenticatedMember } from "@/server/auth/member";
import { createServerSupabaseClient } from "@/server/db/supabase/server";
import {
  FREIGHT_REQUEST_DRAFT_SELECT,
  RecommendationDraftError,
  getAuthorizedFreightRequestDraftRow,
} from "@/server/services/recommendations/recommendation-draft-server";
import type { FreightRequestDraftRow } from "@/features/recommendations/recommendation-draft-contracts";
import type { FreightRequestIntakeViewModel } from "@/features/freight-requests/intake-contracts";
import { getFreightRequestIntake } from "./intake-server";
import {
  submitFreightRequestDraftWithDependencies,
  type DraftSubmissionDependencies,
} from "./draft-submission-policy";

export * from "./draft-submission-policy";

// ---------------------------------------------------------------------------
// Default production Supabase dependencies
// ---------------------------------------------------------------------------

async function defaultValidateCargoCategory(
  categoryId: string,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cargo_categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  return !error && Boolean(data);
}

async function defaultUpdateStatusToPending(
  current: FreightRequestDraftRow,
  newVersion: number,
): Promise<FreightRequestDraftRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("freight_requests")
    .update({
      status: "PENDING",
      draft_version: newVersion,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", current.id)
    .eq("organization_id", current.organization_id)
    .eq("draft_version", current.draft_version)
    .eq("status", "DRAFT")
    .select(FREIGHT_REQUEST_DRAFT_SELECT)
    .maybeSingle();

  if (error) {
    throw new RecommendationDraftError(
      "DRAFT_UNAVAILABLE",
      `No fue posible actualizar el estado del borrador: ${error.message}`,
      500,
    );
  }

  return (data as unknown as FreightRequestDraftRow) ?? null;
}

const defaultDependencies: DraftSubmissionDependencies = {
  resolveMember: requireAuthenticatedMember,
  findDraft: async (id: string) => {
    try {
      return await getAuthorizedFreightRequestDraftRow(id);
    } catch (err) {
      if (err instanceof RecommendationDraftError) {
        throw err;
      }
      throw new RecommendationDraftError(
        "DRAFT_UNAVAILABLE",
        "Error al consultar el borrador.",
        500,
      );
    }
  },
  validateCargoCategory: defaultValidateCargoCategory,
  updateStatusToPending: defaultUpdateStatusToPending,
  loadIntake: getFreightRequestIntake,
};

/**
 * Server use case for submitting a draft: DRAFT ➔ PENDING transition.
 * Accepts either:
 * - submitFreightRequestDraftServer(freightRequestId, { draftVersion })
 * - submitFreightRequestDraftServer({ freightRequestId, draftVersion })
 */
export async function submitFreightRequestDraftServer(
  freightRequestIdOrInput:
    | string
    | { freightRequestId: string; draftVersion: number },
  rawInput?: unknown,
): Promise<FreightRequestIntakeViewModel> {
  let freightRequestId: string;
  let input: unknown;

  if (typeof freightRequestIdOrInput === "string") {
    freightRequestId = freightRequestIdOrInput;
    input = rawInput;
  } else if (
    typeof freightRequestIdOrInput === "object" &&
    freightRequestIdOrInput !== null &&
    "freightRequestId" in freightRequestIdOrInput
  ) {
    freightRequestId = freightRequestIdOrInput.freightRequestId;
    input = freightRequestIdOrInput;
  } else {
    throw new RecommendationDraftError(
      "INVALID_ARGUMENT",
      "freightRequestId debe ser un UUID válido.",
      400,
    );
  }

  return submitFreightRequestDraftWithDependencies(
    freightRequestId,
    input,
    defaultDependencies,
  );
}
