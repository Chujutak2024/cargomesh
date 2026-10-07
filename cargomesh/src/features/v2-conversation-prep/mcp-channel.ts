import type { McpPrincipal } from "../../server/mcp/auth/principal";

/** Contract-only direct service port. It is not registered as an MCP tool. */
export type ConversationApplicationPort<TCreate, TDraft, TRoad> = {
  createDraft(input: { payload: TCreate; idempotencyKey: string; actor: Actor }): Promise<TDraft>;
  readDraft(input: { requestId: string; actor: Actor }): Promise<TDraft>;
  evaluateRoad(input: { requestId: string; expectedDraftVersion: number; actor: Actor }): Promise<TRoad>;
};

export type Actor = { userId: string; memberId: string; organizationId: string };

function requireActor(principal: McpPrincipal): Actor {
  if (principal.kind !== "user" || !principal.scopes.includes("mcp:tools") || principal.status !== "ACTIVE") {
    throw new Error("FORBIDDEN");
  }
  return { userId: principal.userId, memberId: principal.memberId, organizationId: principal.organizationId };
}

/** Caller must obtain principal through the existing per-request MCP auth/link validation. */
export function createPreparatoryMcpChannel<TCreate, TDraft, TRoad>(
  principal: McpPrincipal,
  application: ConversationApplicationPort<TCreate, TDraft, TRoad>,
) {
  // Avoid a global authenticated client or a transport-to-REST hop.
  return {
    createDraft(payload: TCreate, idempotencyKey: string): Promise<TDraft> {
      return application.createDraft({ payload, idempotencyKey, actor: requireActor(principal) });
    },
    readDraft(requestId: string): Promise<TDraft> {
      return application.readDraft({ requestId, actor: requireActor(principal) });
    },
    evaluateRoad(requestId: string, expectedDraftVersion: number): Promise<TRoad> {
      return application.evaluateRoad({ requestId, expectedDraftVersion, actor: requireActor(principal) });
    },
  };
}
