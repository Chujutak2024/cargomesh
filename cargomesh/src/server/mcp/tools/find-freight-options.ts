import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrchestrationError, type StartOrchestrationRunResult } from "@/features/orchestration/contracts";
import {
  FindFreightOptionsInputSchema, FindFreightOptionsOutputSchema, StartedFreightOptionsSchema,
} from "@/shared/schemas/orchestration";

export type FindFreightOptions = (input: { freightRequestId: string; idempotencyKey: string }) => Promise<StartOrchestrationRunResult>;

export async function startPersistedFreightOptions(input: { freightRequestId: string; idempotencyKey: string }) {
  const { start_orchestration_run } = await import("@/server/services/orchestration/start-run");
  return start_orchestration_run(input);
}

function safeStartError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) {
    return { code: "UNAUTHENTICATED", message: "A CargoMesh session is required." };
  }
  if (message.startsWith("FORBIDDEN:") ||
      (error instanceof OrchestrationError && error.code === "FORBIDDEN")) {
    return { code: "FORBIDDEN", message: "Access to this FreightRequest is not permitted." };
  }
  if (error instanceof OrchestrationError) {
    if (error.code === "NOT_FOUND") return { code: "NOT_FOUND", message: "FreightRequest not found." };
    if (error.code === "FREIGHT_REQUEST_NOT_READY") {
      return { code: "FREIGHT_REQUEST_NOT_READY", message: "The FreightRequest must be PENDING before option discovery can start." };
    }
  }
  return { code: "ORCHESTRATION_START_FAILED", message: "Unable to start freight option discovery. Retry with the same key." };
}

export function registerFindFreightOptions(server: McpServer, start: FindFreightOptions) {
  server.registerTool("find_freight_options", {
    title: "Start freight option discovery",
    description: "Create or resume an INITIAL orchestration run for an existing PENDING FreightRequest. " +
      "The returned RUNNING state means a browser WebMCP executor must continue provider collection; " +
      "this call does not itself contact carriers or promise completed quotes. " +
      "Reuse the same idempotencyKey on retries, then poll get_freight_options with runId.",
    inputSchema: FindFreightOptionsInputSchema,
    outputSchema: FindFreightOptionsOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try {
      const data = StartedFreightOptionsSchema.parse(await start(input));
      if (data.freightRequestId.toLowerCase() !== input.freightRequestId.toLowerCase()) {
        throw new Error("Invalid start result correlation");
      }
      const output = { ok: true as const, data };
      return { structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const output = { ok: false as const, error: safeStartError(error) };
      return { isError: true, structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    }
  });
}
