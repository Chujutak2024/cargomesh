import assert from "node:assert/strict";
import test from "node:test";
import { authenticateMcpUserBearer, requireSupabaseOAuthClaims, type McpAccountLink } from "./user-token";

const identity = { userId: "user-a", userEmail: "a@example.invalid", emailConfirmedAt: "2026-01-01T00:00:00Z", oauthClientId: "alexa-client" };
const link: McpAccountLink = {
  authUserId: "user-a", oauthClientId: "alexa-client", organizationId: "org-a", organizationMemberId: "member-a",
  status: "ACTIVE", scopes: ["mcp:tools"],
  expiresAt: "2999-01-01T00:00:00.000Z", revokedAt: null,
  provider: "OTHER", externalSubjectRef: "user-a", verifiedAt: "2026-01-01T00:00:00Z",
};
const membership = {
  memberId: "member-a", organizationId: "org-a", role: "SUPERVISOR" as const, status: "ACTIVE",
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    verifyIdentity: async () => identity,
    accountLinks: { findByUserAndClient: async () => link },
    memberships: { findActive: async () => membership },
    ...overrides,
  } as Parameters<typeof authenticateMcpUserBearer>[1];
}

test("active user/client link and exact membership produce a request-scoped user principal", async () => {
  const result = await authenticateMcpUserBearer("user-token", dependencies());
  assert.equal(result.supabaseAccessToken, "user-token");
  assert.deepEqual(result.principal, {
    kind: "user", authMethod: "supabase_oauth", scopes: ["mcp:tools"],
    userId: "user-a", userEmail: "a@example.invalid", oauthClientId: "alexa-client",
    memberId: "member-a", organizationId: "org-a", role: "SUPERVISOR", status: "ACTIVE",
  });
});

test("account linking fails closed for missing, revoked, expired, wrong-client and unauthorized-scope links", async () => {
  const rejected = [
    null,
    { ...link, status: "REVOKED" },
    { ...link, revokedAt: "2026-01-01T00:00:00.000Z" },
    { ...link, expiresAt: "2020-01-01T00:00:00.000Z" },
    { ...link, expiresAt: "invalid" },
    { ...link, oauthClientId: "other-client" },
    { ...link, scopes: [] },
    { ...link, provider: null }, { ...link, externalSubjectRef: "another-user" },
    { ...link, verifiedAt: null }, { ...link, verifiedAt: "invalid" },
    { ...link, verifiedAt: "2999-01-01T00:00:00Z" },
  ];
  for (const candidate of rejected) {
    await assert.rejects(authenticateMcpUserBearer("user-token", dependencies({
      accountLinks: { findByUserAndClient: async () => candidate },
    })), /FORBIDDEN/);
  }
});

test("each call requires current Auth email confirmation even with the same valid link and token", async () => {
  let currentIdentity: typeof identity | (Omit<typeof identity, "emailConfirmedAt"> & { emailConfirmedAt: null }) = identity;
  const deps = dependencies({ verifyIdentity: async () => currentIdentity });
  assert.equal((await authenticateMcpUserBearer("same-token", deps)).principal.kind, "user");
  for (const candidate of [
    { ...identity, emailConfirmedAt: null }, { ...identity, emailConfirmedAt: "invalid" },
    { ...identity, emailConfirmedAt: "2999-01-01T00:00:00Z" }, { ...identity, userEmail: "" },
  ]) {
    currentIdentity = candidate;
    await assert.rejects(authenticateMcpUserBearer("same-token", deps), /FORBIDDEN: A currently confirmed email/);
  }
  currentIdentity = identity;
  assert.equal((await authenticateMcpUserBearer("same-token", deps)).principal.kind, "user");
});

test("the link fixes organization A and cannot be replaced by organization B membership", async () => {
  const requestedOrganizations: string[] = [];
  await assert.rejects(authenticateMcpUserBearer("user-token", dependencies({
    memberships: { findActive: async (_user: string, organizationId: string) => {
      requestedOrganizations.push(organizationId);
      return { ...membership, organizationId: "org-b" };
    } },
  })), /FORBIDDEN/);
  assert.deepEqual(requestedOrganizations, ["org-a"]);
});

test("inactive or absent exact membership is rejected", async () => {
  for (const candidate of [null, { ...membership, status: "INACTIVE" }, { ...membership, memberId: "other-member" }]) {
    await assert.rejects(authenticateMcpUserBearer("user-token", dependencies({
      memberships: { findActive: async () => candidate },
    })), /FORBIDDEN/);
  }
});

test("verified OAuth claims require the configured issuer, audience, expiry and exact client_id", () => {
  const now = 1_800_000_000;
  const claims = {
    iss: "https://v2.example.supabase.co/auth/v1",
    sub: "user-a",
    aud: "authenticated",
    role: "authenticated",
    client_id: "alexa-client",
    iat: now - 10,
    exp: now + 900,
  };
  const check = (candidate: Record<string, unknown>) =>
    requireSupabaseOAuthClaims(candidate, "user-a", "alexa-client", "https://v2.example.supabase.co", now);
  assert.doesNotThrow(() => check(claims));
  for (const candidate of [
    { ...claims, iss: "https://other.example.supabase.co/auth/v1" },
    { ...claims, sub: "user-b" },
    { ...claims, aud: "other-resource" },
    { ...claims, role: "service_role" },
    { ...claims, client_id: undefined, azp: "alexa-client" },
    { ...claims, client_id: "other-client" },
    { ...claims, exp: now },
    { ...claims, iat: now + 61 },
  ]) assert.throws(() => check(candidate), /UNAUTHENTICATED/);
});
