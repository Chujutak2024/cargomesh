import type { McpPrincipal } from "./principal";

export function testMcpUserPrincipal(): McpPrincipal {
  return {
    kind: "user",
    authMethod: "cookie",
    scopes: ["mcp:tools"],
    userId: "test-user",
    userEmail: "test@example.invalid",
    memberId: "test-member",
    organizationId: "org-a",
    role: "OWNER",
    status: "ACTIVE",
  };
}
