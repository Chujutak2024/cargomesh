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
      authMethod: "cookie";
      scopes: readonly [McpUserScope];
    } & AuthenticatedMemberContext);

export function userMcpPrincipal(member: AuthenticatedMemberContext): McpPrincipal {
  return { kind: "user", authMethod: "cookie", scopes: ["mcp:tools"], ...member };
}

export function requireMcpUser(principal: McpPrincipal): void {
  if (principal.kind !== "user") {
    throw new Error("FORBIDDEN: Business MCP tools require an authenticated CargoMesh user.");
  }
}
