import { readMcpServiceAuthConfiguration, type McpServiceAuthConfiguration } from "./configuration";
import { userMcpPrincipal, type McpPrincipal } from "./principal";
import { verifyMcpServiceToken } from "./service-token";
import { authenticateMcpUserBearer, type AuthenticatedMcpUserBearer } from "./user-token";

type Dependencies = {
  resolveCookieMember: () => Promise<import("@/server/auth/member").AuthenticatedMemberContext>;
  configuration: () => McpServiceAuthConfiguration;
  verifyServiceToken: typeof verifyMcpServiceToken;
  verifyUserToken?: typeof authenticateMcpUserBearer;
};

export type McpAuthentication = {
  principal: McpPrincipal;
  supabaseAccessToken?: string;
};

const defaults: Dependencies = {
  // Lazy server-only import keeps the boundary testable without mocking Next.
  resolveCookieMember: async () => {
    const { requireAuthenticatedMember } = await import("@/server/auth/member");
    return requireAuthenticatedMember();
  },
  configuration: readMcpServiceAuthConfiguration,
  verifyServiceToken: verifyMcpServiceToken,
  verifyUserToken: authenticateMcpUserBearer,
};

export async function authenticateMcpRequestContext(
  request: Request,
  dependencies: Dependencies = defaults,
): Promise<McpAuthentication> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) throw new Error("UNAUTHENTICATED: Invalid bearer authorization.");
    try {
      return { principal: await dependencies.verifyServiceToken(match[1], dependencies.configuration()) };
    } catch { /* A non-service bearer may be a Supabase OAuth user token. */ }
    try {
      const user = await (dependencies.verifyUserToken ?? authenticateMcpUserBearer)(match[1]);
      return user;
    } catch (error) {
      // A supplied Bearer credential is authoritative and never falls back to cookies.
      if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) throw error;
      throw new Error("UNAUTHENTICATED: Invalid bearer token.");
    }
  }
  return { principal: userMcpPrincipal(await dependencies.resolveCookieMember()) };
}

export async function authenticateMcpRequest(
  request: Request,
  dependencies: Dependencies = defaults,
): Promise<McpPrincipal> {
  return (await authenticateMcpRequestContext(request, dependencies)).principal;
}
