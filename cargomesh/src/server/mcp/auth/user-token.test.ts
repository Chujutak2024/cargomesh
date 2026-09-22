import assert from "node:assert/strict";
import test from "node:test";
import { authenticateMcpUserBearer, type McpAccountLink } from "./user-token";

const identity = { userId: "user-a", userEmail: "a@example.invalid", oauthClientId: "alexa-client" };
const link: McpAccountLink = {
  authUserId: "user-a", oauthClientId: "alexa-client", organizationId: "org-a",
  status: "ACTIVE", scopes: ["mcp:tools"],
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

test("account linking fails closed for missing, revoked, wrong-client and unauthorized-scope links", async () => {
  const rejected = [
    null,
    { ...link, status: "REVOKED" },
    { ...link, oauthClientId: "other-client" },
    { ...link, scopes: [] },
  ];
  for (const candidate of rejected) {
    await assert.rejects(authenticateMcpUserBearer("user-token", dependencies({
      accountLinks: { findByUserAndClient: async () => candidate },
    })), /FORBIDDEN/);
  }
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
  for (const candidate of [null, { ...membership, status: "INACTIVE" }]) {
    await assert.rejects(authenticateMcpUserBearer("user-token", dependencies({
      memberships: { findActive: async () => candidate },
    })), /FORBIDDEN/);
  }
});
