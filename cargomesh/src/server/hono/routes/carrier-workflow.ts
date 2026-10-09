import { Hono, type Context } from "hono";
import { runWithMcpRequestIdentity } from "@/server/mcp/auth/request-context";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { WorkflowServiceV2, type WorkflowActorV2 } from "@/server/modules/workflow/application/workflow-service";
import type { WorkflowActionV2 } from "@/shared/schemas/v2/workflow";
import { v2Error } from "../middleware/v2-error";
import { hasSessionOrigin } from "@/server/auth/session-origin";

export const carrierWorkflowRouter = new Hono();
async function authorized(c: Context, operation: (actor: WorkflowActorV2, service: WorkflowServiceV2) => Promise<Response>) {
  const header = c.req.header("Authorization");
  const token = header?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (header !== undefined && !token) return v2Error(c, new V2DraftError("UNAUTHORIZED", "Authentication required.", 401));
  if (!token && !c.req.header("Cookie")) return v2Error(c, new V2DraftError("UNAUTHORIZED", "Authentication required.", 401));
  if (!token && c.req.method === "POST" && !hasSessionOrigin(c.req.raw)) {
    return v2Error(c, new V2DraftError("FORBIDDEN_ORIGIN", "Same-origin session request required.", 403));
  }
  const run = async () => {
    try {
      const { requireAuthenticatedCarrier } = await import("@/server/auth/carrier");
      const { workflowRepositoryV2 } = await import("@/server/modules/workflow/infrastructure/supabase-workflow-repository");
      return await operation(await requireAuthenticatedCarrier(c.req.param("carrierId") ?? ""),
        new WorkflowServiceV2(await workflowRepositoryV2()));
    } catch (error) { return v2Error(c, error); }
  };
  return token ? runWithMcpRequestIdentity({ supabaseAccessToken: token }, run) : run();
}
function scope(c: Context, id: string | null = null) {
  return { carrierId: c.req.param("carrierId") ?? null, requestId: null,
    parentId: c.req.param("parentId") ?? null, id };
}
const collections: [string, string, WorkflowActionV2 | null][] = [
  ["opportunities", "/opportunities", null], ["offers", "/offers", null], ["bookings", "/bookings", null],
  ["executions", "/executions", null], ["incidents", "/executions/:parentId/incidents", "incidents.create"],
  ["incident-updates", "/incidents/:parentId/updates", null], ["execution-events", "/executions/:parentId/events", null],
  ["holds", "/capacity/holds", null], ["consolidations", "/consolidations", "consolidations.create"],
  ["limits", "/route-limits", "limits.publish"], ["metrics", "/metrics", "metrics.publish"],
  ["asset-events", "/assets/:parentId/events", "asset-events.create"],
];
function post(path: string, action: WorkflowActionV2, detail = true) {
  carrierWorkflowRouter.post("/carriers/:carrierId" + path, c => authorized(c, async (actor, service) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
    const result = await service.command(actor, action, scope(c, detail ? c.req.param("id") ?? null : null),
      body, c.req.header("Idempotency-Key"));
    return c.json(result, !detail && !result.meta.idempotentReplay ? 201 : 200);
  }));
}
for (const [kind, path, action] of collections) {
  for (const detail of [false, true]) carrierWorkflowRouter.get("/carriers/:carrierId" + path + (detail ? "/:id" : ""),
    c => authorized(c, async (actor, service) => c.json(await service.read(actor, kind,
      scope(c, detail ? c.req.param("id") ?? null : null), c.req.query()))));
  if (action) post(path, action, false);
  if (action?.endsWith(".publish")) post(path + "/:id/revisions", action);
}
for (const [path, action] of [
  ["/opportunities/:id/responses", "opportunities.respond"], ["/opportunities/:parentId/offers", "offers.create"],
  ["/offers/:id/withdrawals", "offers.withdraw"], ["/bookings/:id/confirmations", "bookings.confirm"],
  ["/bookings/:id/cancellations", "bookings.cancel"], ["/capacity/holds/:id/confirmations", "holds.confirm"],
  ["/capacity/holds/:id/releases", "holds.release"], ["/incidents/:id/updates", "incidents.update"],
  ["/incidents/:id/conditions", "incidents.conditions"],
  ...["start", "complete", "cancel", "position"].map(action => [
    `/executions/:id/${{ start: "starts", complete: "completions", cancel: "cancellations", position: "positions" }[action]}`,
    `executions.${action}`]),
  ...["close", "start", "complete", "cancel", "position"].map(action => [
    `/consolidations/:id/${{ close: "closures", start: "starts", complete: "completions", cancel: "cancellations", position: "positions" }[action]}`,
    `consolidations.${action}`]),
] as [string, WorkflowActionV2][]) post(path, action, action !== "offers.create");
