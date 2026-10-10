import type { V2Actor } from "@/server/modules/freight-requests/application/draft-service";
/** Recheck consent even when a long-lived MCP transport cached its principal. */
export async function requireCurrentMcpActor(actor: V2Actor) {
  const [{ createV2ServerSupabaseClient }, { identityDatabaseError }] = await Promise.all([
    import("@/server/db/supabase/v2"), import("@/server/modules/identity/infrastructure/supabase-identity-repository"),
  ]);
  const db = await createV2ServerSupabaseClient();
  const { error } = await db.rpc("check_v2_mcp_actor", { p_organization_id: actor.organizationId, p_member_id: actor.memberId });
  if (error) identityDatabaseError(error);
}
