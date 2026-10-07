import assert from "node:assert/strict";
import test from "node:test";
import { readMcpServiceAuthConfiguration } from "./configuration";

const validEnv = {
  CARGOMESH_OAUTH_ISSUER: "https://mcp.cargomesh.test",
  CARGOMESH_MCP_CANONICAL_ORIGIN: "https://mcp.cargomesh.test",
  CARGOMESH_MCP_CANONICAL_RESOURCE: "https://mcp.cargomesh.test/mcp",
  CARGOMESH_MCP_SERVICE_CLIENT_ID: "service-client",
  CARGOMESH_MCP_SERVICE_CLIENT_SECRET: "client-secret-with-more-than-32-bytes-123",
  CARGOMESH_MCP_JWT_SIGNING_SECRET: "different-signing-secret-more-than-32-bytes",
  CARGOMESH_MCP_TOKEN_TTL_SECONDS: "900",
};

test("service auth configuration requires one aligned HTTPS issuer/resource", () => {
  assert.deepEqual(readMcpServiceAuthConfiguration(validEnv), {
    issuer: "https://mcp.cargomesh.test",
    canonicalResource: "https://mcp.cargomesh.test/mcp",
    clientId: "service-client",
    clientSecret: validEnv.CARGOMESH_MCP_SERVICE_CLIENT_SECRET,
    signingSecret: validEnv.CARGOMESH_MCP_JWT_SIGNING_SECRET,
    tokenTtlSeconds: 900,
  });
  assert.throws(() => readMcpServiceAuthConfiguration({
    ...validEnv, CARGOMESH_MCP_CANONICAL_RESOURCE: "https://other.example/mcp",
  }));
  assert.throws(() => readMcpServiceAuthConfiguration({
    ...validEnv, CARGOMESH_OAUTH_ISSUER: "http://mcp.cargomesh.test",
  }));
});

test("service auth configuration caps TTL and separates client/signing secrets", () => {
  assert.throws(() => readMcpServiceAuthConfiguration({
    ...validEnv, CARGOMESH_MCP_TOKEN_TTL_SECONDS: "3601",
  }));
  assert.throws(() => readMcpServiceAuthConfiguration({
    ...validEnv, CARGOMESH_MCP_JWT_SIGNING_SECRET: validEnv.CARGOMESH_MCP_SERVICE_CLIENT_SECRET,
  }));
});
