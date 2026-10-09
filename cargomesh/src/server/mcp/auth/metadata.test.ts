import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizationServerMetadata, createMetadataHandler, protectedResourceMetadata, createProtectedResourceMetadataHandler,
} from "./metadata";
import { TEST_SERVICE_AUTH } from "./test-configuration";

test("protected resource metadata advertises only the canonical Tier 1 resource", async () => {
  const response = await createMetadataHandler(protectedResourceMetadata, () => TEST_SERVICE_AUTH)();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    resource: TEST_SERVICE_AUTH.canonicalResource,
    authorization_servers: [TEST_SERVICE_AUTH.issuer],
    scopes_supported: ["mcp:service"],
  });
});

test("user OAuth discovery exposes the Supabase issuer without requiring service credentials", async () => {
  const response = await createProtectedResourceMetadataHandler({ CARGOMESH_MCP_USER_BEARER_ENABLED: "true",
    CARGOMESH_MCP_CANONICAL_RESOURCE: "https://mcp.cargomesh.test/mcp", CARGOMESH_MCP_CANONICAL_ORIGIN: "https://mcp.cargomesh.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", CARGOMESH_MCP_USER_OAUTH_CLIENT_ID: "approved-client" },
  () => { throw new Error("Service secrets must not be required for user discovery."); })();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { resource: "https://mcp.cargomesh.test/mcp",
    authorization_servers: ["https://project.supabase.co/auth/v1"], scopes_supported: ["openid", "email", "profile"], bearer_methods_supported: ["header"] });
});
test("user OAuth discovery fails closed for a mismatched canonical origin", async () => {
  const response = await createProtectedResourceMetadataHandler({ CARGOMESH_MCP_USER_BEARER_ENABLED: "true",
    CARGOMESH_MCP_CANONICAL_RESOURCE: "https://foreign.test/mcp", CARGOMESH_MCP_CANONICAL_ORIGIN: "https://mcp.cargomesh.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", CARGOMESH_MCP_USER_OAUTH_CLIENT_ID: "approved-client" })();
  assert.equal(response.status, 503);
});

test("authorization server metadata advertises only implemented client_credentials", async () => {
  const response = await createMetadataHandler(authorizationServerMetadata, () => TEST_SERVICE_AUTH)();
  const body = await response.json();
  assert.deepEqual(body, {
    issuer: TEST_SERVICE_AUTH.issuer,
    token_endpoint: `${TEST_SERVICE_AUTH.issuer}/oauth/token`,
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    scopes_supported: ["mcp:service"],
  });
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /authorization_code|refresh_token|authorization_endpoint|code_challenge|S256|openid|registration_endpoint/);
});
