import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OrchestrationViewModel } from "@/features/orchestration/contracts";
import {
  GetFreightOptionsInputSchema, GetFreightOptionsOutputSchema,
  OrchestrationViewModelSchema,
} from "@/shared/schemas/orchestration";
import { publicMcpError } from "../errors";

export type ReadFreightOptions = (runId: string) => Promise<OrchestrationViewModel>;

export async function readPersistedFreightOptions(runId: string) {
  const { get_orchestration_view_model } = await import("@/server/services/orchestration/view-model-server");
  return get_orchestration_view_model(runId);
}

export function registerGetFreightOptions(server: McpServer, read: ReadFreightOptions) {
  server.registerTool("get_freight_options", {
    title: "Read persisted freight options",
    description: "Read persisted orchestration progress and BALANCED-ranked offers for a run. " +
      "Does not contact carriers, start searches, recalculate scores or book freight. " +
      "Offers must be rechecked for eligibility and expiry before booking.",
    inputSchema: GetFreightOptionsInputSchema,
    outputSchema: GetFreightOptionsOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ runId }) => {
    try {
      const data = OrchestrationViewModelSchema.parse(await read(runId));
      if (data.runId.toLowerCase() !== runId.toLowerCase() ||
          (data.ranking && data.ranking.orchestrationRunId.toLowerCase() !== runId.toLowerCase())) {
        throw new Error("Invalid service result correlation");
      }
      // Technical messages can include provider/database details. Keep their
      // structure and retryability but never serialize raw diagnostics.
      data.warnings = data.warnings.map((warning) => ({
        ...warning, code: "PROVIDER_EXECUTION_WARNING",
        message: "A provider tool did not complete successfully.",
      }));
      if (data.status === "error") {
        data.error = { ...data.error, code: "ORCHESTRATION_FAILED", message: "The orchestration did not complete successfully." };
      }
      const output = { ok: true as const, data };
      return { structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const output = { ok: false as const, error: publicMcpError(error) };
      return { isError: true, structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    }
  });
}
