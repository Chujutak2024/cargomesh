import { z } from "zod";
import { PageV2Schema } from "@/shared/schemas/v2/facilities";
import { WorkflowContextV2Schema, WorkflowInputsV2, WorkflowRecordV2Schema,
  type WorkflowActionV2, type WorkflowContextV2, type WorkflowValueV2 } from "@/shared/schemas/v2/workflow";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";

export interface WorkflowRepositoryV2 {
  read(actor: V2Actor, kind: string, context: WorkflowContextV2, page: { limit: number; offset: number }): Promise<unknown[]>;
  command(actor: V2Actor, action: WorkflowActionV2, context: WorkflowContextV2, key: string,
    value: WorkflowValueV2 | { expectedVersion: number; value: WorkflowValueV2 }):
    Promise<{ record: unknown; replay: boolean }>;
}
/** SQL evaluates persistent facts and commits compound state changes in one transaction. */
export class WorkflowServiceV2 {
  constructor(private readonly repository: WorkflowRepositoryV2) {}
  private record(actor: V2Actor, context: WorkflowContextV2, value: unknown) {
    const record = WorkflowRecordV2Schema.parse(value);
    if ((context.carrierId !== null && record.carrierId !== context.carrierId)
      || (context.carrierId === null && record.organizationId !== null && record.organizationId !== actor.organizationId)
      || (context.requestId !== null && record.requestId !== context.requestId)) {
      throw new V2DraftError("FORBIDDEN_WORKFLOW", "Resource scope mismatch.", 403);
    }
    return record;
  }
  async read(actor: V2Actor, kind: string, rawContext: WorkflowContextV2, rawPage: unknown) {
    const context = WorkflowContextV2Schema.parse(rawContext);
    const page = PageV2Schema.parse(rawPage);
    const rows = await this.repository.read(actor, kind, context, page);
    const records = rows.map(row => this.record(actor, context, row));
    if (context.id !== null) {
      if (!records.length) throw new V2DraftError("WORKFLOW_NOT_FOUND", "Resource not found.", 404);
      return { schemaVersion: "2.0" as const, data: records[0] };
    }
    return { schemaVersion: "2.0" as const, data: records,
      meta: { ...page, nextOffset: records.length === page.limit ? page.offset + page.limit : null } };
  }
  async command(actor: V2Actor, action: WorkflowActionV2, rawContext: WorkflowContextV2, body: unknown, key?: string) {
    const context = WorkflowContextV2Schema.parse(rawContext);
    let value: WorkflowValueV2 | { expectedVersion: number; value: WorkflowValueV2 };
    if (action.endsWith(".publish") && context.id !== null) {
      const revision = z.object({ expectedVersion: z.number().int().positive(), value: z.unknown() }).strict().parse(body);
      value = { expectedVersion: revision.expectedVersion, value: WorkflowInputsV2[action].parse(revision.value) };
    } else value = WorkflowInputsV2[action].parse(body);
    const result = await this.repository.command(actor, action, context, z.string().uuid().parse(key), value);
    return { schemaVersion: "2.0" as const, data: this.record(actor, context, result.record),
      meta: { idempotentReplay: result.replay, environmentProfile: "v2-clean" as const } };
  }
}
