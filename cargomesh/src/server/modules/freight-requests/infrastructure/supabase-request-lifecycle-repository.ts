import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { asV2RequestRecord } from "./supabase-draft-repository";
import { V2DraftError } from "../application/draft-service";
import type { RequestLifecycleRepositoryV2 } from "../application/request-lifecycle-service";
export async function requestLifecycleRepositoryV2(): Promise<RequestLifecycleRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async list(actor, page) {
      const { data, error } = await db.from("freight_requests")
        .select("id,code,organization_id,status,draft_version,v2_snapshot,creation_payload_hash,created_at,updated_at")
        .eq("organization_id", actor.organizationId).eq("v2_contract_version", "2.0")
        .order("created_at", { ascending: false }).order("id")
        .range(page.offset, page.offset + page.limit - 1);
      if (error) throw new Error("V2_REQUEST_LIST_DATABASE_ERROR");
      return (data ?? []).map(asV2RequestRecord);
    },
    async command(actor, request) {
      const { data, error } = await db.rpc("command_v2_freight_request", {
        p_organization_id: actor.organizationId, p_member_id: actor.memberId,
        p_idempotency_key: request.key, p_request_id: request.id,
        p_expected_version: request.expectedVersion, p_action: request.action, p_value: request.value,
      });
      if (error) {
        const codes: Record<string, number> = { PT400: 400, PT403: 403, PT404: 404, PT409: 409 };
        const status = codes[error.code];
        const permitted = new Set(["VALIDATION_ERROR", "FORBIDDEN_TENANT", "REQUEST_NOT_FOUND",
          "STALE_DRAFT", "INVALID_TRANSITION", "IDEMPOTENCY_CONFLICT"]);
        if (status && permitted.has(error.message)) throw new V2DraftError(error.message, error.message, status);
        if (["23514", "22P02"].includes(error.code)) throw new V2DraftError("VALIDATION_ERROR", "Invalid request.", 400);
        throw new Error("V2_REQUEST_COMMAND_DATABASE_ERROR");
      }
      const result = z.object({ data: FreightRequestV2ResponseSchema.shape.data, replay: z.boolean(),
        payloadHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict().parse(data);
      return { record: { data: result.data, payloadHash: result.payloadHash }, replay: result.replay };
    },
  };
}
