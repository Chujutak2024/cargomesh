import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import type { WorkflowRepositoryV2 } from "../application/workflow-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";

function fail(error: { code?: string; message: string }): never {
  const status: Record<string, number> = { PT400: 400, PT403: 403, PT404: 404, PT409: 409, PT501: 501,
    "23503": 400, "23514": 400, "22P02": 400, "22007": 400, "22008": 400, "22003": 400,
    "23505": 409, "23P01": 409 };
  const httpStatus = status[error.code ?? ""];
  if (!httpStatus) throw new Error("V2_WORKFLOW_DATABASE_ERROR");
  const code = error.code?.startsWith("PT") && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : httpStatus === 409 ? "WORKFLOW_CONFLICT" : "VALIDATION_ERROR";
  throw new V2DraftError(code, code, httpStatus);
}
export async function workflowRepositoryV2(): Promise<WorkflowRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async read(actor, kind, context, page) {
      const { data, error } = await db.rpc("read_v2_workflow", { p_organization_id: actor.organizationId,
        p_member_id: actor.memberId, p_kind: kind, p_context: context, p_limit: page.limit, p_offset: page.offset });
      if (error) fail(error);
      return z.array(z.unknown()).parse(data);
    },
    async command(actor, action, context, key, value) {
      const { data, error } = await db.rpc("command_v2_workflow", { p_organization_id: actor.organizationId,
        p_member_id: actor.memberId, p_action: action, p_context: context, p_key: key, p_value: value });
      if (error) fail(error);
      const result = z.object({ record: z.unknown(), replay: z.boolean() }).parse(data);
      return { record: result.record, replay: result.replay };
    },
  };
}
