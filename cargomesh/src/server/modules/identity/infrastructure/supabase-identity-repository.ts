import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import type { IdentityRepositoryV2 } from "../application/identity-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";

export function identityDatabaseError(error: { code?: string; message: string }): never {
  const status: Record<string, number> = { PT400: 400, PT403: 403, PT404: 404, PT409: 409,
    "23514": 400, "23503": 400, "22P02": 400, "22003": 400, "23505": 409 };
  const httpStatus = status[error.code ?? ""];
  if (!httpStatus) throw new Error("V2_IDENTITY_DATABASE_ERROR");
  const code = error.code?.startsWith("PT") && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : "VALIDATION_ERROR";
  throw new V2DraftError(code, code, httpStatus);
}
export async function identityRepositoryV2(): Promise<IdentityRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async configure(carrierId, key, value) {
      const { data, error } = await db.rpc("command_v2_response_integration", { p_carrier_id: carrierId, p_key: key, p_value: value });
      if (error) identityDatabaseError(error);
      const result = z.object({ record: z.unknown(), replay: z.boolean() }).parse(data);
      return { record: result.record, replay: result.replay };
    },
    async diagnose(carrierId, id) {
      const { data, error } = await db.rpc("diagnose_v2_response_integration", { p_carrier_id: carrierId, p_id: id });
      if (error) identityDatabaseError(error);
      return data;
    },
    async directory(kind, action, scope, id, key, value) {
      const { data, error } = await db.rpc("command_v2_identity_directory", { p_kind: kind, p_action: action,
        p_organization_id: scope.organizationId, p_carrier_id: scope.carrierId, p_id: id, p_key: key, p_value: value });
      if (error) identityDatabaseError(error);
      const result = z.object({ record: z.unknown(), replay: z.boolean() }).parse(data);
      return { record: result.record, replay: result.replay };
    },
    async read(kind, scope, page) {
      const { data, error } = await db.rpc("read_v2_identity", { p_kind: kind,
        p_organization_id: scope.organizationId, p_carrier_id: scope.carrierId,
        p_limit: page.limit, p_offset: page.offset });
      if (error) identityDatabaseError(error);
      return z.array(z.unknown()).parse(data);
    },
    async link(action, organizationId, id, key, value) {
      const { data, error } = await db.rpc("command_v2_mcp_link", { p_action: action,
        p_organization_id: organizationId, p_id: id, p_key: key, p_value: value });
      if (error) identityDatabaseError(error);
      const result = z.object({ record: z.unknown(), replay: z.boolean() }).parse(data);
      return { record: result.record, replay: result.replay };
    },
  };
}
