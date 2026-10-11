import "server-only";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import { RequestLifecycleServiceV2 } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { requestLifecycleRepositoryV2 } from "@/server/modules/freight-requests/infrastructure/supabase-request-lifecycle-repository";
import { SupabaseV2DraftRepository } from "@/server/modules/freight-requests/infrastructure/supabase-draft-repository";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { getV2Draft } from "@/server/modules/freight-requests/application/draft-service";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { workflowRepositoryV2 } from "@/server/modules/workflow/infrastructure/supabase-workflow-repository";
import { FacilityServiceV2 } from "@/server/modules/facilities/application/facility-service";
import { facilityRepositoryV2 } from "@/server/modules/facilities/infrastructure/supabase-facility-repository";
import { CatalogServiceV2 } from "@/server/modules/catalog/application/catalog-service";
import { catalogRepositoryV2 } from "@/server/modules/catalog/infrastructure/supabase-catalog-repository";
import type { CatalogKindV2 } from "@/shared/schemas/v2/catalog";

export type WorkspaceWorkflowKind = "routes" | "plans" | "opportunities" | "offers" | "ranking"
  | "decisions" | "bookings" | "holds" | "executions" | "incidents" | "execution-events";

export async function listWorkspaceRequests() {
  const actor = await requireOperationalRouteAccess();
  return (await new RequestLifecycleServiceV2(await requestLifecycleRepositoryV2()).list(actor, { limit: 50, offset: 0 })).data;
}
export async function readWorkspaceRequest(id: string) {
  const actor = await requireOperationalRouteAccess();
  return (await getV2Draft(id, actor, new SupabaseV2DraftRepository(await createV2ServerSupabaseClient()))).data;
}
export async function listWorkspaceWorkflow(kind: WorkspaceWorkflowKind, options: {
  requestId?: string | null;
  parentId?: string | null;
} = {}) {
  const actor = await requireOperationalRouteAccess();
  const result = await new WorkflowServiceV2(await workflowRepositoryV2()).read(actor, kind,
    { requestId: options.requestId ?? null, carrierId: null, parentId: options.parentId ?? null, id: null },
    { limit: 100, offset: 0 });
  if (!Array.isArray(result.data)) throw new Error("V2_WORKSPACE_INVALID_LIST");
  return result.data;
}

export async function listWorkspaceFacilities() {
  const actor = await requireOperationalRouteAccess();
  return (await new FacilityServiceV2(await facilityRepositoryV2()).list(actor, { limit: 100, offset: 0 })).data;
}

export async function listWorkspaceCatalog(kind: Extract<CatalogKindV2, "preferences" | "cargo-profiles">) {
  const actor = await requireOperationalRouteAccess();
  return (await new CatalogServiceV2(await catalogRepositoryV2()).list(
    actor,
    kind,
    { carrierId: null, serviceId: null },
    { limit: 100, offset: 0 },
  )).data;
}

export async function readWorkspaceRequestFlow(id: string) {
  const request = await readWorkspaceRequest(id);
  const kinds: WorkspaceWorkflowKind[] = [
    "routes", "plans", "opportunities", "offers", "ranking", "decisions", "bookings", "executions", "incidents",
  ];
  const records = await Promise.all(kinds.map((kind) => listWorkspaceWorkflow(kind, { requestId: id })));
  return { request, workflow: Object.fromEntries(kinds.map((kind, index) => [kind, records[index]])) };
}
