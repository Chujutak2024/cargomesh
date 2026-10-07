import { z } from "zod";
import { RoutePlannerSearchV2Schema, RoutePlannerReplanV2Schema, RoutePlannerResultV2Schema } from "@/shared/schemas/v2/route-planner";
import type { V2Actor } from "../../freight-requests/application/draft-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";
import type { WorkflowServiceV2 } from "./workflow-service";

export interface RoutePlannerRepositoryV2 {
  command(actor: V2Actor, action: "find" | "replan", targetId: string, key: string, value: Record<string, unknown>):
    Promise<{ result: unknown; replay: boolean }>;
}
export class RoutePlannerServiceV2 {
  constructor(private readonly repository: RoutePlannerRepositoryV2, private readonly workflow: WorkflowServiceV2) {}
  async command(actor: V2Actor, action: "find" | "replan", targetId: string, raw: unknown, key?: string) {
    const value = (action === "find" ? RoutePlannerSearchV2Schema : RoutePlannerReplanV2Schema).parse(raw);
    const persisted = await this.repository.command(actor, action, z.string().uuid().parse(targetId), z.string().uuid().parse(key), value);
    const data = RoutePlannerResultV2Schema.parse(persisted.result);
    if (data.search.returnedPaths !== data.alternatives.length || data.search.evaluatedPaths < data.search.returnedPaths
      || data.search.maxLegs !== value.maxLegs || data.alternatives.length > value.maxAlternatives
      || action === "find" && (data.search.requestId !== targetId || data.decision !== null || !('policyId' in value) || data.search.policyId !== value.policyId)
      || action === "replan" && (data.decision?.originalRouteId !== targetId
        || !('conditionId' in value) || data.decision.conditionId !== value.conditionId)) {
      throw new V2DraftError("FORBIDDEN_WORKFLOW", "Route search metadata mismatch.", 403);
    }
    for (const route of data.alternatives) {
      if (route.kind !== "routes" || route.organizationId !== actor.organizationId
        || route.requestId !== data.search.requestId) {
        throw new V2DraftError("FORBIDDEN_WORKFLOW", "Route search scope mismatch.", 403);
      }
    }
    return { schemaVersion: "2.0" as const, data, meta: { idempotentReplay: persisted.replay } };
  }
  async explain(actor: V2Actor, id: string) {
    const response = await this.workflow.read(actor, "routes", { requestId: null, carrierId: null, parentId: null,
      id: z.string().uuid().parse(id) }, {});
    const record = response.data;
    if (Array.isArray(record) || record.kind !== "routes") throw new V2DraftError("WORKFLOW_NOT_FOUND", "Route not found.", 404);
    return { schemaVersion: "2.0" as const, data: { routeId: record.id, version: record.version, evaluatedAt: record.updatedAt,
      status: record.status, planner: record.data.planner, reasons: record.data.reasons,
      confidence: record.data.confidence, distanceKm: record.data.estimatedDistanceKm,
      durationSeconds: record.data.estimatedDurationSeconds, legs: record.data.legs,
      scope: "PERSISTED_ROUTE_SNAPSHOT" as const, currentAvailabilityConfirmed: false as const } };
  }
}
