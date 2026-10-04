import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import type { CatalogRepositoryV2 } from "../application/catalog-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";

function dbError(error: { code?: string; message: string }): never {
  const mapped: Record<string, [number, string]> = {
    PT400: [400, "VALIDATION_ERROR"], PT403: [403, "FORBIDDEN_CATALOG"], PT404: [404, "CATALOG_NOT_FOUND"],
    PT409: [409, error.message === "IDEMPOTENCY_CONFLICT" ? "IDEMPOTENCY_CONFLICT" : "STALE_DRAFT"],
    "23505": [409, "CATALOG_CONFLICT"], "23503": [400, "INVALID_CATALOG_REFERENCE"],
    "23514": [400, "VALIDATION_ERROR"], "22P02": [400, "VALIDATION_ERROR"],
    "22007": [400, "VALIDATION_ERROR"], "22008": [400, "VALIDATION_ERROR"], "22003": [400, "VALIDATION_ERROR"],
  };
  const result = mapped[error.code ?? ""];
  if (result) throw new V2DraftError(result[1], result[1], result[0]);
  throw new Error("V2_CATALOG_DATABASE_ERROR");
}
export async function catalogRepositoryV2(): Promise<CatalogRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async read(actor, kind, scope, page, id) {
      const { data, error } = await db.rpc("read_v2_catalog", {
        p_organization_id: actor.organizationId, p_member_id: actor.memberId, p_kind: kind,
        p_carrier_id: scope.carrierId, p_service_id: scope.serviceId, p_id: id,
        p_limit: page.limit, p_offset: page.offset,
      });
      if (error) dbError(error);
      return z.array(z.unknown()).parse(data);
    },
    async command(actor, kind, scope, input) {
      const { data, error } = await db.rpc("command_v2_catalog", {
        p_organization_id: actor.organizationId, p_member_id: actor.memberId, p_kind: kind,
        p_carrier_id: scope.carrierId, p_service_id: scope.serviceId, p_id: input.id,
        p_idempotency_key: input.key, p_expected_version: input.expectedVersion, p_value: input.value,
      });
      if (error) dbError(error);
      const result = z.object({ record: z.unknown(), replay: z.boolean() }).parse(data);
      return { record: result.record, replay: result.replay };
    },
  };
}
