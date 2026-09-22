import "server-only";

import { requireAuthenticatedMember } from "@/server/auth/member";
import { createServerSupabaseClient } from "@/server/db/supabase/server";
import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";
import type { OfficialCargoCategoryCode } from "../../../features/freight-requests/manual-intake-contracts";
import { getFreightRequestIntake } from "./intake-server";
import type { FreightRequestIntakeViewModel } from "../../../features/freight-requests/intake-contracts";
import { createIdempotentFreightRequestDraft, type CreationRecord } from "./idempotent-draft-creation";
import {
  createFreightRequestDraftWithDependencies,
  type DraftCreationDependencies,
} from "./draft-creation-policy";

async function defaultResolveCargoCategoryId(code: OfficialCargoCategoryCode): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cargo_categories")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    throw new RecommendationDraftError(
      "DRAFT_CREATION_UNAVAILABLE",
      "No fue posible validar la categoría de carga.",
      500,
    );
  }
  if (!data) {
    throw new RecommendationDraftError(
      "INVALID_DRAFT",
      "La categoría de carga no está disponible.",
      422,
    );
  }
  return (data as { id: string }).id;
}

async function defaultGenerateRequestCode(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `FR-${Math.floor(2000 + Math.random() * 7900)}`;
    if (candidate === "FR-1042") continue;
    const { data } = await supabase
      .from("freight_requests")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `FR-${Date.now().toString().slice(-4)}`;
}

async function defaultInsertFreightRequest(
  row: Record<string, unknown>,
): Promise<{ id: string; code: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("freight_requests")
    .insert(row as never)
    .select("id, code")
    .single();
  if (error) {
    if (
      error.code === "23505" ||
      error.message?.includes("23505") ||
      error.message?.includes("freight_requests_code_key")
    ) {
      const collisionError = new Error(`PG_UNIQUE_23505: ${error.message}`);
      (collisionError as unknown as { code: string }).code = "23505";
      throw collisionError;
    }
    throw new RecommendationDraftError(
      "DRAFT_CREATION_UNAVAILABLE",
      `No fue posible persistir el borrador en la base de datos: ${error.message}`,
      500,
    );
  }
  return data as { id: string; code: string };
}

async function defaultLoadIntake(requestCode: string): Promise<FreightRequestIntakeViewModel> {
  return getFreightRequestIntake(requestCode);
}

const defaultDependencies: DraftCreationDependencies = {
  resolveMember: requireAuthenticatedMember,
  resolveCargoCategoryId: defaultResolveCargoCategoryId,
  generateRequestCode: defaultGenerateRequestCode,
  insertFreightRequest: defaultInsertFreightRequest,
  loadIntake: defaultLoadIntake,
};

export async function createFreightRequestDraftServer(
  rawInput: unknown,
): Promise<FreightRequestIntakeViewModel> {
  return createFreightRequestDraftWithDependencies(rawInput, defaultDependencies);
}

export { RecommendationDraftError };
export * from "./draft-creation-policy";

export async function createIdempotentFreightRequestDraftServer(rawInput: unknown) {
  return createIdempotentFreightRequestDraft(rawInput, {
    ...defaultDependencies,
    findCreation: async (organizationId, memberId, key) => {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.from("freight_requests")
        .select("id, code, creation_payload_hash")
        .eq("organization_id", organizationId)
        .eq("requested_by_member_id", memberId)
        .eq("creation_idempotency_key", key)
        .maybeSingle<CreationRecord>();
      if (error || (data && !data.creation_payload_hash)) {
        throw new RecommendationDraftError("DRAFT_CREATION_UNAVAILABLE", "Unable to read creation receipt.", 500);
      }
      return data;
    },
  });
}
