import { readMcpServiceAuthConfiguration, type McpServiceAuthConfiguration } from "./configuration";
import { userMcpPrincipal, type McpPrincipal } from "./principal";
import { verifyMcpServiceToken } from "./service-token";

type Dependencies = {
  resolveCookieMember: () => Promise<import("@/server/auth/member").AuthenticatedMemberContext>;
  configuration: () => McpServiceAuthConfiguration;
  verifyServiceToken: typeof verifyMcpServiceToken;
};

const defaults: Dependencies = {
  // Lazy server-only import keeps the boundary testable without mocking Next.
  resolveCookieMember: async () => {
    const { requireAuthenticatedMember } = await import("@/server/auth/member");
    return requireAuthenticatedMember();
  },
  configuration: readMcpServiceAuthConfiguration,
  verifyServiceToken: verifyMcpServiceToken,
};

export async function authenticateMcpRequest(
  request: Request,
  dependencies: Dependencies = defaults,
): Promise<McpPrincipal> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) throw new Error("UNAUTHENTICATED: Invalid bearer authorization.");
    try {
      return await dependencies.verifyServiceToken(match[1], dependencies.configuration());
    } catch {
      // A supplied Bearer credential is authoritative and never falls back to cookies.
      throw new Error("UNAUTHENTICATED: Invalid bearer token.");
    }
  }
  return userMcpPrincipal(await dependencies.resolveCookieMember());
}
