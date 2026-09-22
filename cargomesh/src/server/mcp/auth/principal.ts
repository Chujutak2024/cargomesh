import type { AuthenticatedMemberContext } from "@/server/auth/member";

export type McpServiceScope = "mcp:service";
export type McpUserScope = "mcp:tools";

export type McpPrincipal =
  | {
      kind: "service";
      clientId: string;
      scopes: readonly [McpServiceScope];
      tokenId: string;
      issuedAt: number;
      expiresAt: number;
    }
  | ({
      kind: "user";
      authMethod: "cookie" | "supabase_oauth";
      scopes: readonly [McpUserScope];
      oauthClientId?: string;
    } & AuthenticatedMemberContext);

export function userMcpPrincipal(
  member: AuthenticatedMemberContext,
  authMethod: "cookie" | "supabase_oauth" = "cookie",
  oauthClientId?: string,
): McpPrincipal {
  return {
    kind: "user", authMethod, scopes: ["mcp:tools"], ...member,
    ...(oauthClientId ? { oauthClientId } : {}),
  };
}

export function requireMcpUser(principal: McpPrincipal): void {
  if (principal.kind !== "user") {
    throw new Error("FORBIDDEN: Business MCP tools require an authenticated CargoMesh user.");
  }
}
