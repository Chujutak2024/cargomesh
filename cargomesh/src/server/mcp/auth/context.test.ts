import assert from "node:assert/strict";
import test from "node:test";
import { authenticateMcpRequest } from "./context";
import { issueMcpServiceToken, verifyMcpServiceToken } from "./service-token";
import { TEST_SERVICE_AUTH } from "./test-configuration";

const member = {
  userId: "user-a", userEmail: "a@example.invalid", memberId: "member-a",
  organizationId: "org-a", role: "OWNER" as const, status: "ACTIVE",
};

test("cookie authentication produces a request-scoped user principal", async () => {
  let cookieCalls = 0;
  const principal = await authenticateMcpRequest(new Request("http://localhost:3000/mcp"), {
    resolveCookieMember: async () => { cookieCalls++; return member; },
    configuration: () => { throw new Error("unexpected config"); },
    verifyServiceToken: verifyMcpServiceToken,
  });
  assert.equal(cookieCalls, 1);
  assert.deepEqual(principal, { kind: "user", authMethod: "cookie", scopes: ["mcp:tools"], ...member });
});

test("valid bearer produces a service principal and never reads cookies", async () => {
  const { accessToken } = await issueMcpServiceToken(TEST_SERVICE_AUTH);
  let cookieCalls = 0;
  const principal = await authenticateMcpRequest(new Request(TEST_SERVICE_AUTH.canonicalResource, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }), {
    resolveCookieMember: async () => { cookieCalls++; return member; },
    configuration: () => TEST_SERVICE_AUTH,
    verifyServiceToken: verifyMcpServiceToken,
  });
  assert.equal(principal.kind, "service");
  assert.equal(cookieCalls, 0);
});

test("invalid bearer never falls back to cookie authentication", async () => {
  let cookieCalls = 0;
  await assert.rejects(authenticateMcpRequest(new Request(TEST_SERVICE_AUTH.canonicalResource, {
    headers: { Authorization: "Bearer invalid" },
  }), {
    resolveCookieMember: async () => { cookieCalls++; return member; },
    configuration: () => TEST_SERVICE_AUTH,
    verifyServiceToken: verifyMcpServiceToken,
  }), /UNAUTHENTICATED/);
  assert.equal(cookieCalls, 0);
});

test("validated Supabase bearer produces a user principal and never reads cookies", async () => {
  let cookieCalls = 0;
  const principal = await authenticateMcpRequest(new Request(TEST_SERVICE_AUTH.canonicalResource, {
    headers: { Authorization: "Bearer supabase-user-token" },
  }), {
    resolveCookieMember: async () => { cookieCalls++; return member; },
    configuration: () => TEST_SERVICE_AUTH,
    verifyServiceToken: async () => { throw new Error("not a service token"); },
    verifyUserToken: async (accessToken) => ({
      principal: { ...member, kind: "user", authMethod: "supabase_oauth", scopes: ["mcp:tools"], oauthClientId: "alexa-client" },
      supabaseAccessToken: accessToken,
    }),
  });
  assert.equal(principal.kind, "user");
  assert.equal(principal.authMethod, "supabase_oauth");
  assert.equal(cookieCalls, 0);
});

test("cookie member authorization errors remain authoritative", async () => {
  for (const error of ["FORBIDDEN: wrong organization", "FORBIDDEN: inactive member"]) {
    await assert.rejects(authenticateMcpRequest(new Request("http://localhost:3000/mcp"), {
      resolveCookieMember: async () => { throw new Error(error); },
      configuration: () => TEST_SERVICE_AUTH,
      verifyServiceToken: verifyMcpServiceToken,
    }), new RegExp(error));
  }
});
