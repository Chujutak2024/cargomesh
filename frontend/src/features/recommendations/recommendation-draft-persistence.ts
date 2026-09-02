import {
  RecommendationDraftError,
  type FreightRequestDraftRow,
} from "./recommendation-draft-contracts";

type DraftIdentity = Pick<FreightRequestDraftRow, "id" | "organization_id" | "draft_version">;
// Use only the query operations required here so the helper works with both
// the SSR client's bundled PostgREST version and the direct SDK client.
interface DraftMutationQuery {
  eq(column: string, value: unknown): DraftMutationQuery;
  in(column: string, values: readonly unknown[]): DraftMutationQuery;
  select(columns: string): {
    maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
  };
}

// The caller authorizes the member and validates the patch first. These guards
// must still hold at UPDATE time: starting a run changes status without changing
// draft_version, so version alone cannot protect an in-flight draft write.
export async function persistEditableFreightRequest(
  mutation: DraftMutationQuery,
  current: DraftIdentity,
  select: string,
): Promise<FreightRequestDraftRow> {
  const { data, error } = await mutation
    .eq("id", current.id)
    .eq("organization_id", current.organization_id)
    .eq("draft_version", current.draft_version)
    .in("status", ["DRAFT", "PENDING"])
    .select(select)
    .maybeSingle();

  if (error) {
    throw new RecommendationDraftError(
      "DRAFT_UNAVAILABLE",
      "No fue posible persistir el borrador validado.",
      500,
    );
  }
  if (!data) {
    throw new RecommendationDraftError(
      "STALE_DRAFT",
      "El borrador o su estado cambió; no se aplicó ninguna sugerencia.",
      409,
    );
  }
  return data as unknown as FreightRequestDraftRow;
}
