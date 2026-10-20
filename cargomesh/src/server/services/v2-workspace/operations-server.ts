import "server-only";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import { RequestLifecycleServiceV2 } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { requestLifecycleRepositoryV2 } from "@/server/modules/freight-requests/infrastructure/supabase-request-lifecycle-repository";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { workflowRepositoryV2 } from "@/server/modules/workflow/infrastructure/supabase-workflow-repository";
import { FacilityServiceV2 } from "@/server/modules/facilities/application/facility-service";
import { facilityRepositoryV2 } from "@/server/modules/facilities/infrastructure/supabase-facility-repository";
import { CatalogServiceV2 } from "@/server/modules/catalog/application/catalog-service";
import { catalogRepositoryV2 } from "@/server/modules/catalog/infrastructure/supabase-catalog-repository";
import { commercialCatalogReferences, readCommercialCatalog } from "@/features/shipper-portal/commercial-catalog";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { readWorkspaceRequest, type WorkspaceWorkflowKind } from "./workspace-server";
import { collectOperationsPages, operationsReadIssues, OperationsReadContractError } from "./operations-collection";
import { readRequestChildren } from "./request-workflow";

/** Client-owned reads; leaves the shared identity/Facilities helper and Carrier wrappers untouched. */
export async function operationsReader(expectedOrganizationId?: string) {
  const actor = await requireOperationalRouteAccess();
  if (expectedOrganizationId && actor.organizationId !== expectedOrganizationId) {
    throw new V2DraftError("FORBIDDEN_TENANT", "Request and active organization differ.", 403);
  }
  return {
    actor,
    async commercialCatalog(workflow: Record<string, WorkflowRecordV2[]>) {
      const refs = commercialCatalogReferences(workflow);
      const service = new CatalogServiceV2(await catalogRepositoryV2());
      return readCommercialCatalog(refs.carrierIds, refs.serviceRefs, async ref => (await service.get(actor, ref.kind,
        { carrierId: ref.carrierId, serviceId: null }, ref.id)).data);
    },
    async requests(offset = 0) {
      const service = new RequestLifecycleServiceV2(await requestLifecycleRepositoryV2());
      return collectOperationsPages(page => service.list(actor, page), record => {
        if (record.organizationId !== actor.organizationId) throw new V2DraftError("FORBIDDEN_TENANT", "Request scope mismatch.", 403);
      }, offset);
    },
    async workflow(kind: WorkspaceWorkflowKind, requestId: string | null = null, parentId: string | null = null) {
      const service = new WorkflowServiceV2(await workflowRepositoryV2());
      return collectOperationsPages(async page => {
        const response = await service.read(actor, kind, { requestId, carrierId: null, parentId, id: null }, page);
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
  const kinds: WorkspaceWorkflowKind[] = ["routes", "plans", "opportunities", "offers", "ranking", "decisions", "bookings"];
  const values = await Promise.all(kinds.map(kind => reader.workflow(kind, request.id)));
  const collections = Object.fromEntries(kinds.map((kind, index) => [kind, values[index]]));
  const workflow = Object.fromEntries(kinds.map((kind, index) => [kind, values[index].data]));
  collections.executions = await readRequestChildren("executions", workflow.bookings, request.organizationId, request.id,
    (kind, parentId) => reader.workflow(kind, null, parentId));
  workflow.executions = collections.executions.data;
  collections.incidents = await readRequestChildren("incidents", workflow.executions, request.organizationId, request.id,
    (kind, parentId) => reader.workflow(kind, null, parentId));
  workflow.incidents = collections.incidents.data;
  collections.holds = await readRequestChildren("holds", workflow.bookings, request.organizationId, request.id,
    (kind, parentId) => reader.workflow(kind, null, parentId));
  workflow.holds = collections.holds.data;
  const catalog = await reader.commercialCatalog(workflow);
  return { request, workflow, catalog, memberId: reader.actor.memberId,
    issues: operationsReadIssues(collections) };
}

export async function readOperationsBookingResources(bookings: WorkflowRecordV2[], reader: Awaited<ReturnType<typeof operationsReader>>) {
  const values = await Promise.all(bookings.slice(0,25).map(async booking => {
    if (!booking.organizationId || !booking.requestId) throw new OperationsReadContractError("Unscoped booking.");
    const read = (kind: "holds" | "executions" | "incidents", parentId: string) => reader.workflow(kind, null, parentId);
    const [holds, executions] = await Promise.all(["holds", "executions"].map(kind =>
      readRequestChildren(kind as "holds" | "executions", [booking], booking.organizationId!, booking.requestId!, read)));
    return { holds, executions };
  }));
  return { data: values.flatMap(value => [...value.holds.data,...value.executions.data]),
    complete: bookings.length <= 25 && values.every(value => value.holds.complete && value.executions.complete && !value.holds.error && !value.executions.error) };
}
