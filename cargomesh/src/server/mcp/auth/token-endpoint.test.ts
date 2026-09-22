import assert from "node:assert/strict";
import test from "node:test";
import { decodeJwt } from "jose";
import { createMcpTokenHandler } from "./token-endpoint";
import { issueMcpServiceToken } from "./service-token";
import { TEST_SERVICE_AUTH } from "./test-configuration";

const URL = `${TEST_SERVICE_AUTH.issuer}/oauth/token`;
const basic = (id = TEST_SERVICE_AUTH.clientId, secret = TEST_SERVICE_AUTH.clientSecret) =>
  `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
const request = (body: string, authorization = basic(), contentType = "application/x-www-form-urlencoded") =>
  new Request(URL, { method: "POST", headers: { Authorization: authorization, "Content-Type": contentType }, body });
const validBody = new URLSearchParams({
  grant_type: "client_credentials",
  scope: "mcp:service",
  resource: TEST_SERVICE_AUTH.canonicalResource,
}).toString();
const handler = createMcpTokenHandler({
  configuration: () => TEST_SERVICE_AUTH,
  issueToken: (config) => issueMcpServiceToken(config, new Date("2026-09-21T12:00:00Z")),
});

test("token endpoint issues a signed bearer token without a refresh token", async () => {
  const response = await handler(request(validBody));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.token_type, "Bearer");
  assert.equal(body.expires_in, 900);
  assert.equal(body.scope, "mcp:service");
  assert.equal("refresh_token" in body, false);
  const claims = decodeJwt(body.access_token);
  assert.equal(claims.iss, TEST_SERVICE_AUTH.issuer);
  assert.equal(claims.aud, TEST_SERVICE_AUTH.canonicalResource);
  assert.equal(claims.exp! - claims.iat!, 900);
});

test("token endpoint rejects invalid and malformed Basic credentials", async () => {
  for (const authorization of [basic("wrong", "wrong"), "Basic !!!", "Bearer value", "Basic Zm9v", ""]) {
    const response = await handler(request(validBody, authorization));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "invalid_client");
  }
});

test("token endpoint rejects unsupported grant, scope and resource", async () => {
  const cases = [
    [{ grant_type: "authorization_code", scope: "mcp:service", resource: TEST_SERVICE_AUTH.canonicalResource }, "unsupported_grant_type"],
    [{ grant_type: "client_credentials", scope: "mcp:tools", resource: TEST_SERVICE_AUTH.canonicalResource }, "invalid_scope"],
    [{ grant_type: "client_credentials", scope: "mcp:service", resource: "https://other.example/mcp" }, "invalid_target"],
  ] as const;
  for (const [values, error] of cases) {
    const response = await handler(request(new URLSearchParams(values).toString()));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, error);
  }
});

test("token endpoint requires form encoding and client_secret_basic", async () => {
  assert.equal((await handler(request(validBody, basic(), "application/json"))).status, 400);
  const bodyCredentials = `${validBody}&client_id=x&client_secret=y`;
  const response = await handler(request(bodyCredentials));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_request");
});
