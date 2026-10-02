import { decodeJwt } from "jose";
import { createUserAccessSupabaseClient } from "@/server/db/supabase/user-access";
import { userMcpPrincipal, type McpPrincipal } from "./principal";

export type McpAccountLink = {
  authUserId: string;
  oauthClientId: string;
  organizationId: string;
  organizationMemberId: string;
  status: "ACTIVE" | "REVOKED";
  scopes: readonly string[];
  expiresAt: string | null;
  revokedAt: string | null;
};

export type McpAccountLinkRepository = {
  findByUserAndClient(authUserId: string, oauthClientId: string, accessToken: string): Promise<McpAccountLink | null>;
};

export type McpMembership = {
  memberId: string;
  organizationId: string;
  role: "OWNER" | "SUPERVISOR" | "REQUESTER";
  status: string;
};

export type McpMembershipRepository = {
  findActive(authUserId: string, organizationId: string, accessToken: string): Promise<McpMembership | null>;
};

export type VerifiedSupabaseIdentity = {
  userId: string;
  userEmail: string;
  oauthClientId: string;
};

type Dependencies = {
  verifyIdentity: (accessToken: string) => Promise<VerifiedSupabaseIdentity>;
  accountLinks: McpAccountLinkRepository;
  memberships: McpMembershipRepository;
};

export type AuthenticatedMcpUserBearer = {
  principal: McpPrincipal;
  supabaseAccessToken: string;
};

function configuredOAuthClientId(): string {
  const clientId = process.env.CARGOMESH_MCP_USER_OAUTH_CLIENT_ID;
  if (!clientId || clientId.length > 256 || /\s/.test(clientId)) {
    throw new Error("UNAUTHENTICATED: MCP user OAuth client is not configured.");
  }
  return clientId;
}

async function verifySupabaseIdentity(accessToken: string): Promise<VerifiedSupabaseIdentity> {
  if (process.env.CARGOMESH_MCP_USER_BEARER_ENABLED !== "true") {
    throw new Error("UNAUTHENTICATED: MCP user bearer authentication is disabled.");
  }
  const client = createUserAccessSupabaseClient(accessToken);
  const { data: { user }, error } = await client.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHENTICATED: Invalid Supabase user token.");
  let claims: ReturnType<typeof decodeJwt>;
  try { claims = decodeJwt(accessToken); } catch {
    throw new Error("UNAUTHENTICATED: Invalid Supabase user token.");
  }
  const oauthClientId = typeof claims.client_id === "string"
    ? claims.client_id
    : typeof claims.azp === "string" ? claims.azp : null;
  if (claims.sub !== user.id || oauthClientId !== configuredOAuthClientId()) {
    throw new Error("UNAUTHENTICATED: User token client binding is invalid.");
  }
  return { userId: user.id, userEmail: user.email ?? "", oauthClientId };
}

const supabaseAccountLinks: McpAccountLinkRepository = {
  async findByUserAndClient(authUserId, oauthClientId, accessToken) {
    const client = createUserAccessSupabaseClient(accessToken);
    const { data, error } = await client.from("mcp_account_links")
      .select("auth_user_id,oauth_client_id,organization_id,organization_member_id,status,scopes,expires_at,revoked_at")
      .eq("auth_user_id", authUserId)
      .eq("oauth_client_id", oauthClientId)
      .maybeSingle();
    if (error) throw new Error("FORBIDDEN: MCP account-link lookup failed.");
    if (!data) return null;
    return {
      authUserId: data.auth_user_id,
      oauthClientId: data.oauth_client_id,
      organizationId: data.organization_id,
      organizationMemberId: data.organization_member_id,
      status: data.status as McpAccountLink["status"],
      scopes: data.scopes,
      expiresAt: data.expires_at,
      revokedAt: data.revoked_at,
    };
  },
};

const supabaseMemberships: McpMembershipRepository = {
  async findActive(authUserId, organizationId, accessToken) {
    const client = createUserAccessSupabaseClient(accessToken);
    const { data, error } = await client.from("organization_members")
      .select("id,organization_id,role,status")
      .eq("auth_user_id", authUserId)
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (error || !data) return null;
    return {
      memberId: data.id,
      organizationId: data.organization_id,
      role: data.role as McpMembership["role"],
      status: data.status,
    };
  },
};

const defaults: Dependencies = {
  verifyIdentity: verifySupabaseIdentity,
  accountLinks: supabaseAccountLinks,
  memberships: supabaseMemberships,
};

export async function authenticateMcpUserBearer(
  accessToken: string,
  dependencies: Dependencies = defaults,
): Promise<AuthenticatedMcpUserBearer> {
  const identity = await dependencies.verifyIdentity(accessToken);
  const link = await dependencies.accountLinks.findByUserAndClient(identity.userId, identity.oauthClientId, accessToken);
  if (
    !link || link.status !== "ACTIVE" || link.authUserId !== identity.userId ||
    link.oauthClientId !== identity.oauthClientId || !link.scopes.includes("mcp:tools") ||
    link.revokedAt !== null || !link.expiresAt ||
    !Number.isFinite(Date.parse(link.expiresAt)) || Date.parse(link.expiresAt) <= Date.now()
  ) throw new Error("FORBIDDEN: No active MCP account link for this user and client.");

  const membership = await dependencies.memberships.findActive(
    identity.userId,
    link.organizationId,
    accessToken,
  );
  if (
    !membership || membership.status !== "ACTIVE" ||
    membership.organizationId !== link.organizationId || membership.memberId !== link.organizationMemberId
  ) throw new Error("FORBIDDEN: Linked organization membership is not active.");

  return {
    principal: userMcpPrincipal({
      userId: identity.userId,
      userEmail: identity.userEmail,
      memberId: membership.memberId,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
    }, "supabase_oauth", identity.oauthClientId),
    supabaseAccessToken: accessToken,
  };
}
