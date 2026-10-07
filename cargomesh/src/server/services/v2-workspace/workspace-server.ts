import "server-only";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import { RequestLifecycleServiceV2 } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { requestLifecycleRepositoryV2 } from "@/server/modules/freight-requests/infrastructure/supabase-request-lifecycle-repository";
import { SupabaseV2DraftRepository } from "@/server/modules/freight-requests/infrastructure/supabase-draft-repository";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { getV2Draft } from "@/server/modules/freight-requests/application/draft-service";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { workflowRepositoryV2 } from "@/server/modules/workflow/infrastructure/supabase-workflow-repository";

export async function listWorkspaceRequests() {
  const actor = await requireOperationalRouteAccess();
  return (await new RequestLifecycleServiceV2(await requestLifecycleRepositoryV2()).list(actor, { limit: 50, offset: 0 })).data;
}
export async function readWorkspaceRequest(id: string) {
  const actor = await requireOperationalRouteAccess();
  return (await getV2Draft(id, actor, new SupabaseV2DraftRepository(await createV2ServerSupabaseClient()))).data;
}
export async function listWorkspaceWorkflow(kind: "bookings" | "executions") {
  const actor = await requireOperationalRouteAccess();
  const result = await new WorkflowServiceV2(await workflowRepositoryV2()).read(actor, kind,
    { requestId: null, carrierId: null, parentId: null, id: null }, { limit: 50, offset: 0 });
  if (!Array.isArray(result.data)) throw new Error("V2_WORKSPACE_INVALID_LIST");
  return result.data;
}
