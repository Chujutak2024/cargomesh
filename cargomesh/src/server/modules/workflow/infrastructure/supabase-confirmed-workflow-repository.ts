import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { identityDatabaseError } from "../../identity/infrastructure/supabase-identity-repository";
import type { ConfirmedWorkflowRepositoryV2 } from "../application/confirmed-workflow-service";
export async function confirmedWorkflowRepositoryV2(): Promise<ConfirmedWorkflowRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async prepare(actor, input) {
      const { data, error } = await db.rpc("prepare_v2_mcp_workflow", { p_organization_id: actor.organizationId,
        p_member_id: actor.memberId, p_action: input.action, p_context: input.context,
        p_key: input.idempotencyKey, p_value: input.value });
      if (error) identityDatabaseError(error);
      return data;
    },
    async confirm(actor, id) {
      const { data, error } = await db.rpc("confirm_v2_mcp_workflow", { p_organization_id: actor.organizationId,
        p_member_id: actor.memberId, p_id: id, p_confirmed: true });
      if (error) identityDatabaseError(error);
      const result = z.object({ record: z.unknown(), replay: z.boolean(), confirmation: z.unknown() }).parse(data);
      return { record: result.record, replay: result.replay, confirmation: result.confirmation };
    },
  };
}
