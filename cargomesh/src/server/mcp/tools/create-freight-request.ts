import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";
import {
  CreateFreightRequestInputSchema, CreateFreightRequestOutputSchema, CreatedFreightRequestSchema,
  type CreateFreightRequestInput, type CreatedFreightRequest,
} from "@/shared/schemas/freight-creation";
import { publicMcpError } from "../errors";

export type CreateFreightRequest = (input: CreateFreightRequestInput) => Promise<CreatedFreightRequest>;
export const createPersistedFreightRequest: CreateFreightRequest = async (input) => {
  const { createIdempotentFreightRequestDraftServer } = await import("@/server/services/freight-requests/draft-creation-server");
  return createIdempotentFreightRequestDraftServer(input);
};

function safeCreationError(error: unknown) {
  const auth = publicMcpError(error);
  if (["UNAUTHENTICATED", "FORBIDDEN"].includes(auth.code)) return auth;
  if (error instanceof RecommendationDraftError) {
    const messages: Record<string, string> = {
      INVALID_INPUT: "Creation input is invalid.", INVALID_DRAFT: "Freight details are invalid.",
      FORBIDDEN: "An active OWNER or SUPERVISOR membership is required.",
      UNAUTHENTICATED: "A CargoMesh session is required.",
      IDEMPOTENCY_CONFLICT: "This key was already used with different input. Reuse the original input or use a new key for a new request.",
      REQUEST_CODE_COLLISION: "Unable to allocate a request code. Retry with the same key.",
    };
    if (messages[error.code]) return { code: error.code, message: messages[error.code] };
  }
  return { code: "DRAFT_CREATION_UNAVAILABLE", message: "Unable to confirm draft creation. Retry with the same key and input." };
}

export function registerCreateFreightRequest(server: McpServer, create: CreateFreightRequest) {
  server.registerTool("create_freight_request", {
    title: "Create a freight draft",
    description: "V1 regression contract: persist a DRAFT for ROAD/FTL/BALANCED scheduled-pallet freight. " +
      "This is not the canonical V2 FreightRequest schema; the V2 application service is not implemented. " +
      "Requires an active OWNER or SUPERVISOR. Does not search, submit or book. " +
      "Generate one UUID idempotencyKey per intended request; retain the same key and input on every retry. " +
      "Replays return the existing request's current status/version, which may no longer be DRAFT.",
    inputSchema: CreateFreightRequestInputSchema,
    outputSchema: CreateFreightRequestOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    try {
      const data = CreatedFreightRequestSchema.parse(await create(input));
      const output = { ok: true as const, data };
      return { structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const output = { ok: false as const, error: safeCreationError(error) };
      return { isError: true, structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    }
  });
}
