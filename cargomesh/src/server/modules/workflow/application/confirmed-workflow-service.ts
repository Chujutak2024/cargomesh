import { z } from "zod";
import { PrepareWorkflowActionV2Schema, ConfirmWorkflowActionV2Schema, WorkflowConfirmationV2Schema,
  WorkflowCommandResponseV2Schema, JsonV2Schema } from "@/shared/schemas/v2/mcp-workflow";
import { isDeepStrictEqual } from "node:util";
import { WorkflowInputsV2 } from "@/shared/schemas/v2/workflow";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";
export interface ConfirmedWorkflowRepositoryV2 {
  prepare(actor: V2Actor, input: z.infer<typeof PrepareWorkflowActionV2Schema>): Promise<unknown>;
  confirm(actor: V2Actor, id: string): Promise<{ record: unknown; replay: boolean; confirmation: unknown }>;
}
export class ConfirmedWorkflowServiceV2 {
  constructor(private readonly repository: ConfirmedWorkflowRepositoryV2) {}
  async prepare(actor: V2Actor, raw: unknown) {
    const input = PrepareWorkflowActionV2Schema.parse(raw);
    // Reuse exactly the Web command's domain input, including resource groups.
    const value = WorkflowInputsV2[input.action].parse(input.value);
    const confirmation = WorkflowConfirmationV2Schema.parse(await this.repository.prepare(actor,
      { ...input, value: JsonV2Schema.parse(value) }));
    if (confirmation.action !== input.action
      || !isDeepStrictEqual(confirmation.context, input.context)
      || !isDeepStrictEqual(confirmation.proposedValue, value)) {
      throw new V2DraftError("FORBIDDEN_WORKFLOW", "Confirmation scope mismatch.", 403);
    }
    return { schemaVersion: "2.0" as const, data: confirmation };
  }
  async confirm(actor: V2Actor, raw: unknown) {
    const input = ConfirmWorkflowActionV2Schema.parse(raw);
    const result = await this.repository.confirm(actor, input.confirmationId);
    const confirmation = WorkflowConfirmationV2Schema.parse(result.confirmation);
    const response = WorkflowCommandResponseV2Schema.parse({ schemaVersion: "2.0", data: result.record,
      meta: { idempotentReplay: result.replay, environmentProfile: "v2-clean" } });
    // Carrier commands are independently authorized by the stored proposal and
    // server-bound operator. Shipper commands remain in the linked organization.
    const scope = confirmation.context;
    if (confirmation.id !== input.confirmationId || response.data.kind !== confirmation.action.split(".")[0]
      || scope.carrierId === null && response.data.organizationId !== actor.organizationId
      || scope.carrierId !== null && response.data.carrierId !== scope.carrierId
      || scope.id !== null && response.data.id !== scope.id
      || scope.requestId !== null && response.data.requestId !== scope.requestId) {
      throw new V2DraftError("FORBIDDEN_WORKFLOW", "Confirmation result scope mismatch.", 403);
    }
    return response;
  }
}
