import type { V2Actor } from "@/server/modules/freight-requests/application/draft-service";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { RequestLifecycleServiceV2 } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { RoutePlannerServiceV2 } from "@/server/modules/workflow/application/route-planner-service";
import { ConfirmedWorkflowServiceV2 } from "@/server/modules/workflow/application/confirmed-workflow-service";
import { LocationServiceV2 } from "@/server/modules/locations/application/location-service";
import { WorkflowContextV2Schema } from "@/shared/schemas/v2/workflow";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
async function persisted(actor: V2Actor) {
  const [{ requestLifecycleRepositoryV2 }, { workflowRepositoryV2 }, { routePlannerRepositoryV2 },
    { confirmedWorkflowRepositoryV2 }, { locationRepositoryV2 }, { createV2ServerSupabaseClient }, { identityDatabaseError }] = await Promise.all([
    import("@/server/modules/freight-requests/infrastructure/supabase-request-lifecycle-repository"),
    import("@/server/modules/workflow/infrastructure/supabase-workflow-repository"),
    import("@/server/modules/workflow/infrastructure/supabase-route-planner-repository"),
    import("@/server/modules/workflow/infrastructure/supabase-confirmed-workflow-repository"),
    import("@/server/modules/locations/infrastructure/supabase-location-repository"),
    import("@/server/db/supabase/v2"), import("@/server/modules/identity/infrastructure/supabase-identity-repository"),
  ]);
  const db = await createV2ServerSupabaseClient();
  const { error } = await db.rpc("check_v2_mcp_actor", { p_organization_id: actor.organizationId, p_member_id: actor.memberId });
  if (error) identityDatabaseError(error);
  const [lifecycle, workflow, planner, confirmations, locations] = await Promise.all([
    requestLifecycleRepositoryV2(), workflowRepositoryV2(), routePlannerRepositoryV2(),
    confirmedWorkflowRepositoryV2(), locationRepositoryV2(),
  ]);
  const sharedWorkflow = new WorkflowServiceV2(workflow);
  return { lifecycle: new RequestLifecycleServiceV2(lifecycle), workflow: sharedWorkflow,
    planner: new RoutePlannerServiceV2(planner, sharedWorkflow),
    confirmations: new ConfirmedWorkflowServiceV2(confirmations), locations: new LocationServiceV2(locations) };
}
export const persistedV2WorkflowToolServices = {
  async list(actor: V2Actor, raw: unknown) { return (await persisted(actor)).lifecycle.list(actor, raw); },
  async revise(actor: V2Actor, requestId: string, value: unknown, key: string) {
    return (await persisted(actor)).lifecycle.revise(actor, requestId, value, key);
  },
  async submit(actor: V2Actor, requestId: string, version: number, key: string) {
    return (await persisted(actor)).lifecycle.submit(actor, requestId, { expectedDraftVersion: version }, key);
  },
  async read(actor: V2Actor, kind: string, rawContext: unknown, page: unknown) {
    const context = WorkflowContextV2Schema.parse(rawContext);
    const services = await persisted(actor);
    const { requireAuthenticatedCarrier } = await import("@/server/auth/carrier");
    return services.workflow.read(context.carrierId ? await requireAuthenticatedCarrier(context.carrierId) : actor, kind, context, page);
  },
  async planner(actor: V2Actor, action: "find" | "replan", id: string, value: unknown, key: string) {
    return (await persisted(actor)).planner.command(actor, action, id, value, key);
  },
  async explain(actor: V2Actor, id: string) { return (await persisted(actor)).planner.explain(actor, id); },
  async command(actor: V2Actor, action: "plans.create" | "ranking.create", rawContext: unknown, value: unknown, key: string) {
    const context = WorkflowContextV2Schema.parse(rawContext);
    if (context.carrierId !== null) throw new V2DraftError("FORBIDDEN_WORKFLOW", "Shipper context required.", 403);
    return (await persisted(actor)).workflow.command(actor, action, context, value, key);
  },
  async prepare(actor: V2Actor, raw: unknown) { return (await persisted(actor)).confirmations.prepare(actor, raw); },
  async confirm(actor: V2Actor, raw: unknown) { return (await persisted(actor)).confirmations.confirm(actor, raw); },
  async resolveLocation(actor: V2Actor, raw: unknown) { return (await persisted(actor)).locations.resolve(actor, raw); },
  async confirmLocation(actor: V2Actor, raw: unknown) { return (await persisted(actor)).locations.confirm(actor, raw); },
};
export type V2WorkflowToolServices = typeof persistedV2WorkflowToolServices;
