import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpPrincipal } from "../auth/principal";
import { persistedV2WorkflowToolServices, type V2WorkflowToolServices } from "./v2-workflow-services";
import { V2WorkflowToolDescriptions } from "@/shared/schemas/v2/mcp-workflow-catalog";
import { WorkflowContextV2Schema, WorkflowInputsV2 } from "@/shared/schemas/v2/workflow";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { ReviseRequestV2Schema } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { RoutePlannerSearchV2Schema, RoutePlannerReplanV2Schema, RoutePlannerResultV2Schema } from "@/shared/schemas/v2/route-planner";
import { PrepareWorkflowActionV2Schema, ConfirmWorkflowActionV2Schema, WorkflowConfirmationV2Schema,
  WorkflowCommandResponseV2Schema, WorkflowReadResponseV2Schema, JsonV2Schema } from "@/shared/schemas/v2/mcp-workflow";
import { LocationResolutionInputV2Schema, LocationConfirmationInputV2Schema, LocationResolutionV2Schema,
  LocationCandidateV2Schema } from "@/shared/schemas/v2/location-resolution";
import { V2DraftError, type V2Actor } from "@/server/modules/freight-requests/application/draft-service";
const Id = z.string().uuid();
const Pagination = z.object({ limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100000).default(0) }).strict();
const PageMetadata = z.object({ limit: z.number().int(), offset: z.number().int(), nextOffset: z.number().int().nullable() }).strict();
const RequestList = z.object({ schemaVersion: z.literal("2.0"),
  data: z.array(FreightRequestV2ResponseSchema.shape.data), meta: PageMetadata }).strict();
const PlannerResponse = z.object({ schemaVersion: z.literal("2.0"), data: RoutePlannerResultV2Schema,
  meta: z.object({ idempotentReplay: z.boolean() }).strict() }).strict();
const Explanation = z.object({ schemaVersion: z.literal("2.0"), data: z.object({
  routeId: Id, version: z.number().int().positive(), evaluatedAt: z.string().datetime({ offset: true }),
  status: z.string(), planner: JsonV2Schema, reasons: z.array(z.string()), confidence: z.enum(["UNKNOWN", "VERIFIED", "SIMULATED", "ESTIMATED"]),
  distanceKm: z.number().nullable(), durationSeconds: z.number().nullable(), legs: z.array(JsonV2Schema),
  scope: z.literal("PERSISTED_ROUTE_SNAPSHOT"), currentAvailabilityConfirmed: z.literal(false),
}).strict() }).strict();
function actor(principal: McpPrincipal): V2Actor {
  if (principal.kind !== "user" || principal.status !== "ACTIVE" || !principal.scopes.includes("mcp:tools")) {
    throw new V2DraftError("FORBIDDEN", "An authorized CargoMesh user is required.", 403);
  }
  return { memberId: principal.memberId, organizationId: principal.organizationId };
}
function failure(error: unknown) {
  const output = { ok: false as const, error: error instanceof V2DraftError
    ? { code: error.code, message: "The action could not be completed. Review its current state and permissions." }
    : error instanceof z.ZodError ? { code: "VALIDATION_ERROR", message: "Review the tool fields." }
    : { code: "V2_SERVICE_UNAVAILABLE", message: "The V2 service is unavailable." } };
  return { isError: true, structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
}
export function registerV2WorkflowTools(server: McpServer, principal: McpPrincipal,
  services: V2WorkflowToolServices = persistedV2WorkflowToolServices) {
  function register<S extends z.AnyZodObject, O extends z.AnyZodObject>(name: keyof typeof V2WorkflowToolDescriptions,
    input: S, output: O, operation: (input: z.output<S>, actor: V2Actor) => Promise<unknown>, readOnly = false, destructive = false) {
    const sdkInput: z.AnyZodObject = input;
    server.registerTool(name, { title: name.replaceAll("_", " "), description: V2WorkflowToolDescriptions[name],
      inputSchema: sdkInput, outputSchema: z.object({ ok: z.literal(true), data: output }).strict(),
      annotations: { readOnlyHint: readOnly, destructiveHint: destructive, idempotentHint: true, openWorldHint: false },
    }, async (raw): Promise<CallToolResult> => {
      try {
        const data = output.parse(await operation(input.parse(raw), actor(principal)));
        const result = { ok: true as const, data };
        return { structuredContent: result, content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) { return failure(error); }
    });
  }
  register("list_v2_freight_requests", Pagination, RequestList, (input, actor) => services.list(actor, input), true);
  register("revise_v2_freight_request", z.object({ requestId: Id, idempotencyKey: Id, value: ReviseRequestV2Schema }).strict(),
    FreightRequestV2ResponseSchema, (input, actor) => services.revise(actor, input.requestId, input.value, input.idempotencyKey));
  register("submit_v2_freight_request", z.object({ requestId: Id, idempotencyKey: Id, expectedDraftVersion: z.number().int().positive(),
    confirmed: z.literal(true) }).strict(), FreightRequestV2ResponseSchema,
    (input, actor) => services.submit(actor, input.requestId, input.expectedDraftVersion, input.idempotencyKey));
  for (const [name, action, schema] of [["find_v2_route_alternatives", "find", RoutePlannerSearchV2Schema],
    ["replan_v2_route", "replan", RoutePlannerReplanV2Schema]] as const) register(name,
    z.object({ targetId: Id, idempotencyKey: Id, value: schema }).strict(), PlannerResponse,
    (input, actor) => services.planner(actor, action, input.targetId, input.value, input.idempotencyKey));
  register("explain_v2_route", z.object({ routeId: Id }).strict(), Explanation, (input, actor) => services.explain(actor, input.routeId), true);
  for (const [name, action] of [["build_v2_transport_plan", "plans.create"], ["rank_v2_offers", "ranking.create"]] as const) register(name,
    z.object({ context: WorkflowContextV2Schema, idempotencyKey: Id, value: WorkflowInputsV2[action] }).strict(),
    WorkflowCommandResponseV2Schema, (input, actor) => services.command(actor, action, input.context, input.value, input.idempotencyKey));
  register("read_v2_workflow", z.object({ kind: z.enum(["routes", "plans", "opportunities", "offers", "ranking", "decisions", "bookings", "holds",
    "executions", "incidents", "incident-updates", "execution-events", "consolidations"]), context: WorkflowContextV2Schema,
    page: Pagination.default({}) }).strict(), WorkflowReadResponseV2Schema,
    (input, actor) => services.read(actor, input.kind, input.context, input.page), true);
  register("prepare_v2_commercial_action", PrepareWorkflowActionV2Schema,
    z.object({ schemaVersion: z.literal("2.0"), data: WorkflowConfirmationV2Schema }).strict(),
    (input, actor) => services.prepare(actor, input));
  register("confirm_v2_commercial_action", ConfirmWorkflowActionV2Schema, WorkflowCommandResponseV2Schema,
    (input, actor) => services.confirm(actor, input), false, true);
  register("resolve_v2_location", LocationResolutionInputV2Schema,
    z.object({ schemaVersion: z.literal("2.0"), data: LocationResolutionV2Schema }).strict(),
    (input, actor) => services.resolveLocation(actor, input), true);
  register("confirm_v2_location", LocationConfirmationInputV2Schema,
    z.object({ schemaVersion: z.literal("2.0"), data: LocationCandidateV2Schema.extend({
      confirmed: z.literal(true), confirmedByMemberId: Id, organizationId: Id }).strict() }).strict(),
    (input, actor) => services.confirmLocation(actor, input), true);
}
