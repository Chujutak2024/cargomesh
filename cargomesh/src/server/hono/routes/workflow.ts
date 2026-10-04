import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth";
import { v2AuthMiddleware } from "../middleware/v2-auth";
import { v2Error } from "../middleware/v2-error";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import type { WorkflowActionV2 } from "@/shared/schemas/v2/workflow";

export const workflowRouter = new Hono<{ Variables: AuthVariables }>();
workflowRouter.use("*", v2AuthMiddleware);
async function service() {
  const { workflowRepositoryV2 } = await import("@/server/modules/workflow/infrastructure/supabase-workflow-repository");
  return new WorkflowServiceV2(await workflowRepositoryV2());
}
const collections: [string, string, WorkflowActionV2 | null][] = [
  ["nodes", "/routing/nodes", "nodes.publish"], ["corridors", "/routing/corridors", "corridors.publish"],
  ["route-policies", "/routing/policies", "route-policies.publish"], ["conditions", "/routing/conditions", "conditions.publish"],
  ["limits", "/carriers/:carrierId/route-limits", "limits.publish"],
  ["scoring-policies", "/scoring/policies", "scoring-policies.publish"],
  ["metrics", "/carriers/:carrierId/metrics", "metrics.publish"],
  ["routes", "/freight/requests/:requestId/routes", "routes.create"],
  ["plans", "/freight/requests/:requestId/plans", "plans.create"],
  ["opportunities", "/freight/requests/:requestId/opportunities", "opportunities.create"],
  ["offers", "/freight/requests/:requestId/offers", null],
  ["ranking", "/freight/requests/:requestId/ranking", "ranking.create"],
  ["decisions", "/freight/requests/:requestId/decisions", "decisions.create"],
  ["bookings", "/bookings", "bookings.create"], ["holds", "/capacity/holds", "holds.create"],
  ["executions", "/executions", "executions.create"],
  ["incidents", "/executions/:parentId/incidents", null],
  ["incident-updates", "/incidents/:parentId/updates", null],
  ["asset-events", "/carriers/:carrierId/assets/:parentId/events", "asset-events.create"],
  ["execution-events", "/executions/:parentId/events", null],
  ["opportunities", "/carriers/:carrierId/opportunities", null],
  ["offers", "/carriers/:carrierId/offers", null],
  ["bookings", "/carriers/:carrierId/bookings", null],
  ["executions", "/carriers/:carrierId/executions", null],
  ["incidents", "/carriers/:carrierId/executions/:parentId/incidents", "incidents.create"],
  ["execution-events", "/carriers/:carrierId/executions/:parentId/events", null],
  ["incident-updates", "/carriers/:carrierId/incidents/:parentId/updates", null],
  ["holds", "/carriers/:carrierId/capacity/holds", null],
  ["holds", "/bookings/:parentId/reservations", null],
  ["executions", "/bookings/:parentId/execution", null],
  ["consolidations", "/carriers/:carrierId/consolidations", "consolidations.create"],
];
function context(params: Record<string, string>, id: string | null = null) {
  return { requestId: params.requestId ?? null, carrierId: params.carrierId ?? null, parentId: params.parentId ?? null, id };
}
function post(path: string, action: WorkflowActionV2, param?: string) {
  workflowRouter.post(path, async c => {
    try {
      let body: unknown;
      try { body = await c.req.json(); } catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
      const result = await (await service()).command(c.get("member"), action,
        context(c.req.param(), param ? c.req.param(param) ?? null : null), body, c.req.header("Idempotency-Key"));
      return c.json(result, result.meta.idempotentReplay || param !== undefined
        || !action.endsWith(".create") && !action.endsWith(".publish") ? 200 : 201);
    } catch (error) { return v2Error(c, error); }
  });
}
for (const [kind, path, action] of collections) {
  for (const detail of [false, true]) workflowRouter.get(path + (detail ? "/:id" : ""), async c => {
    try { return c.json(await (await service()).read(c.get("member"), kind,
      context(c.req.param(), detail ? c.req.param("id") ?? null : null), c.req.query())); }
    catch (error) { return v2Error(c, error); }
  });
  if (action) post(path, action);
  if (action?.endsWith(".publish")) post(path + "/:id/revisions", action, "id");
}
for (const [kind, path] of [["routes", "/routes/:id"], ["plans", "/plans/:id"], ["offers", "/offers/:id"],
  ["decisions", "/decisions/:id"]]) workflowRouter.get(path, async c => {
  try { return c.json(await (await service()).read(c.get("member"), kind, context(c.req.param(), c.req.param("id") ?? null), c.req.query())); }
  catch (error) { return v2Error(c, error); }
});
for (const [path, action] of [
  ["/carriers/:carrierId/opportunities/:id/responses", "opportunities.respond"],
  ["/carriers/:carrierId/opportunities/:parentId/offers", "offers.create"],
  ["/carriers/:carrierId/offers/:id/withdrawals", "offers.withdraw"],
  ["/freight/requests/:requestId/decisions/:id/revocations", "decisions.revoke"],
  ["/carriers/:carrierId/bookings/:id/confirmations", "bookings.confirm"],
  ["/bookings/:id/cancellations", "bookings.cancel"],
  ["/capacity/holds/:id/releases", "holds.release"],
  ["/carriers/:carrierId/capacity/holds/:id/confirmations", "holds.confirm"],
  ["/carriers/:carrierId/capacity/holds/:id/releases", "holds.release"],
  ["/carriers/:carrierId/bookings/:id/cancellations", "bookings.cancel"],
  ["/carriers/:carrierId/executions/:id/starts", "executions.start"],
  ["/carriers/:carrierId/executions/:id/completions", "executions.complete"],
  ["/carriers/:carrierId/executions/:id/cancellations", "executions.cancel"],
  ["/carriers/:carrierId/executions/:id/positions", "executions.position"],
  ["/carriers/:carrierId/incidents/:id/updates", "incidents.update"],
  ["/carriers/:carrierId/consolidations/:id/closures", "consolidations.close"],
] as [string, WorkflowActionV2][]) post(path, action, "id");
