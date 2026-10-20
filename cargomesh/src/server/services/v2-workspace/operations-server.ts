import "server-only";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import { RequestLifecycleServiceV2 } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { requestLifecycleRepositoryV2 } from "@/server/modules/freight-requests/infrastructure/supabase-request-lifecycle-repository";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { workflowRepositoryV2 } from "@/server/modules/workflow/infrastructure/supabase-workflow-repository";
import { FacilityServiceV2 } from "@/server/modules/facilities/application/facility-service";
import { facilityRepositoryV2 } from "@/server/modules/facilities/infrastructure/supabase-facility-repository";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { readWorkspaceRequest, type WorkspaceWorkflowKind } from "./workspace-server";
import { collectOperationsPages, operationsReadIssues, OperationsReadContractError } from "./operations-collection";

/** Client-owned reads; leaves the shared identity/Facilities helper and Carrier wrappers untouched. */
export async function operationsReader(expectedOrganizationId?: string) {
  const actor = await requireOperationalRouteAccess();
  if (expectedOrganizationId && actor.organizationId !== expectedOrganizationId) {
    throw new V2DraftError("FORBIDDEN_TENANT", "Request and active organization differ.", 403);
  }
  return {
    async requests(offset = 0) {
      const service = new RequestLifecycleServiceV2(await requestLifecycleRepositoryV2());
      return collectOperationsPages(page => service.list(actor, page), record => {
        if (record.organizationId !== actor.organizationId) throw new V2DraftError("FORBIDDEN_TENANT", "Request scope mismatch.", 403);
      }, offset);
    },
    async workflow(kind: WorkspaceWorkflowKind, requestId: string | null = null) {
      const service = new WorkflowServiceV2(await workflowRepositoryV2());
      return collectOperationsPages(async page => {
        const response = await service.read(actor, kind, { requestId, carrierId: null, parentId: null, id: null }, page);
        if (!Array.isArray(response.data)) throw new OperationsReadContractError("Expected a collection.");
        return { data: response.data, meta: response.meta };
      }, record => {
        if (record.kind !== kind) throw new OperationsReadContractError("Workflow kind mismatch.");
        if (record.organizationId !== actor.organizationId || (requestId !== null && record.requestId !== requestId)) {
          throw new V2DraftError("FORBIDDEN_WORKFLOW", "Workflow scope mismatch.", 403);
        }
      });
    },
    async facilities() {
      const service = new FacilityServiceV2(await facilityRepositoryV2());
      return collectOperationsPages(page => service.list(actor, page), record => {
        if (record.organizationId !== actor.organizationId) throw new V2DraftError("FORBIDDEN_TENANT", "Facility scope mismatch.", 403);
      });
    },
  };
}

export async function readOperationsRequestFlow(id: string) {
  // Read the exact authorized request before any commercial collection. 401/403/404 remain errors.
  const request = await readWorkspaceRequest(id);
  const reader = await operationsReader(request.organizationId);
  const kinds: WorkspaceWorkflowKind[] = ["routes", "plans", "opportunities", "offers", "ranking", "decisions", "bookings", "executions", "incidents"];
  const values = await Promise.all(kinds.map(kind => reader.workflow(kind, request.id)));
  const collections = Object.fromEntries(kinds.map((kind, index) => [kind, values[index]]));
  return { request, workflow: Object.fromEntries(kinds.map((kind, index) => [kind, values[index].data])),
    issues: operationsReadIssues(collections) };
}
