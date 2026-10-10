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
  provider: "ALEXA_PLUS" | "OTHER" | null;
  externalSubjectRef: string | null;
  verifiedAt: string | null;
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
  emailConfirmedAt: string | null;
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

// getUser verifies the token with the configured Supabase Auth project. These
// claim checks additionally bind that verified user to this OAuth client and
// project; a regular Supabase session must never inherit an MCP account link.
export function requireSupabaseOAuthClaims(
  claims: ReturnType<typeof decodeJwt>,
  userId: string,
  clientId: string,
  supabaseUrl: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  let expectedIssuer: string;
  try {
    const url = new URL(supabaseUrl);
    if (!(["https:", "http:"].includes(url.protocol)) || url.search || url.hash) throw new Error();
    expectedIssuer = `${url.origin}${url.pathname.replace(/\/$/, "")}/auth/v1`;
  } catch {
    throw new Error("UNAUTHENTICATED: Supabase OAuth issuer is not configured.");
  }
  if (
    claims.iss !== expectedIssuer || claims.sub !== userId ||
    claims.aud !== "authenticated" || claims.role !== "authenticated" ||
    claims.client_id !== clientId ||
    typeof claims.iat !== "number" || claims.iat > nowSeconds + 60 ||
    typeof claims.exp !== "number" || claims.exp <= nowSeconds
  ) {
    throw new Error("UNAUTHENTICATED: User token client binding is invalid.");
  }
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
  const oauthClientId = configuredOAuthClientId();
  requireSupabaseOAuthClaims(claims, user.id, oauthClientId, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  return { userId: user.id, userEmail: user.email ?? "", emailConfirmedAt: user.email_confirmed_at ?? null, oauthClientId };
}

const supabaseAccountLinks: McpAccountLinkRepository = {
  async findByUserAndClient(authUserId, oauthClientId, accessToken) {
    const client = createUserAccessSupabaseClient(accessToken);
    const { data, error } = await client.from("mcp_account_links")
      .select("auth_user_id,oauth_client_id,organization_id,organization_member_id,status,scopes,expires_at,revoked_at,provider,external_subject_ref,verified_at")
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
      provider: data.provider as McpAccountLink["provider"],
      externalSubjectRef: data.external_subject_ref,
      verifiedAt: data.verified_at,
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
  // Recheck Auth's current user record: a link or JWT reflects earlier consent.
  if (!identity.userEmail || !identity.emailConfirmedAt ||
      !Number.isFinite(Date.parse(identity.emailConfirmedAt)) || Date.parse(identity.emailConfirmedAt) > Date.now()) {
    throw new Error("FORBIDDEN: A currently confirmed email is required for MCP access.");
  }
  const link = await dependencies.accountLinks.findByUserAndClient(identity.userId, identity.oauthClientId, accessToken);
  if (
    !link || link.status !== "ACTIVE" || link.authUserId !== identity.userId ||
    link.oauthClientId !== identity.oauthClientId || !link.scopes.includes("mcp:tools") ||
    link.revokedAt !== null || !link.expiresAt ||
    !["ALEXA_PLUS", "OTHER"].includes(link.provider ?? "") || link.externalSubjectRef !== identity.userId ||
    !link.verifiedAt || !Number.isFinite(Date.parse(link.verifiedAt)) || Date.parse(link.verifiedAt) > Date.now() ||
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
