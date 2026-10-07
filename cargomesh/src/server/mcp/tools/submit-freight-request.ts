import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SubmitFreightRequestInputSchema, SubmitFreightRequestOutputSchema, SubmittedFreightRequestSchema,
} from "@/shared/schemas/freight-creation";
import type { SubmitFreightRequestInput, SubmittedFreightRequest } from "@/server/services/freight-requests/submit-request";

export type SubmitFreightRequest = (input: SubmitFreightRequestInput) => Promise<SubmittedFreightRequest>;
export async function submitPersistedFreightRequest(input: SubmitFreightRequestInput) {
  const { submitFreightRequest } = await import("@/server/services/freight-requests/submit-request");
  return submitFreightRequest(input);
}

function safeSubmitError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) return { code: "UNAUTHENTICATED", message: "A CargoMesh session is required." };
  if (message.startsWith("FORBIDDEN:")) return { code: "FORBIDDEN", message: "An active OWNER or SUPERVISOR is required." };
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "NOT_FOUND") return { code, message: "FreightRequest not found." };
  if (code === "INVALID_DRAFT") return { code, message: "The persisted draft is incomplete, unsupported, or expired." };
  if (code === "STALE_DRAFT") return { code, message: "The draft changed. Reload its status and version before retrying." };
  return { code: "SUBMISSION_UNAVAILABLE", message: "Unable to confirm submission. Reload the request before retrying." };
}

export function registerSubmitFreightRequest(server: McpServer, submit: SubmitFreightRequest) {
  server.registerTool("submit_freight_request", {
    title: "Submit a freight draft",
    description: "V1 regression contract: validate and submit an existing V1 DRAFT as PENDING. " +
      "This is not the canonical V2 FreightRequest submission contract; the V2 application service is not implemented. " +
      "Requires its current draftVersion and an active OWNER or SUPERVISOR. " +
      "A successful exact retry returns replayed:true. This does not contact providers or book freight.",
    inputSchema: SubmitFreightRequestInputSchema,
    outputSchema: SubmitFreightRequestOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try {
      const data = SubmittedFreightRequestSchema.parse(await submit(input));
      if (data.freightRequestId.toLowerCase() !== input.freightRequestId.toLowerCase() ||
          data.draftVersion !== input.draftVersion + 1) throw new Error("Invalid submission result correlation");
      const output = { ok: true as const, data };
      return { structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const output = { ok: false as const, error: safeSubmitError(error) };
      return { isError: true, structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    }
  });
}
