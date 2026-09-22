import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizationServerMetadata, createMetadataHandler, protectedResourceMetadata,
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
