import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import type { RoutePlannerRepositoryV2 } from "../application/route-planner-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";
import type { Json } from "@/types/database-v2.types";

export async function routePlannerRepositoryV2(): Promise<RoutePlannerRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return { async command(actor, action, targetId, key, value) {
    const { data, error } = await db.rpc("command_v2_route_planner", { p_organization_id: actor.organizationId,
      p_member_id: actor.memberId, p_action: action, p_target_id: targetId, p_key: key, p_value: value as Json });
    if (error) {
      const status = ({ PT400: 400, PT403: 403, PT404: 404, PT409: 409 } as Record<string, number>)[error.code];
      if (!status) throw new Error("V2_ROUTE_PLANNER_DATABASE_ERROR");
      throw new V2DraftError(/^[A-Z][A-Z0-9_]{0,80}$/.test(error.message) ? error.message : "VALIDATION_ERROR", error.message, status);
    }
    const parsed = z.object({ result: z.unknown(), replay: z.boolean() }).strict().parse(data);
    return { result: parsed.result, replay: parsed.replay };
  } };
}
