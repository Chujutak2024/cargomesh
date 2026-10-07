import type { McpServiceAuthConfiguration } from "./configuration";

export const TEST_SERVICE_AUTH: McpServiceAuthConfiguration = {
  issuer: "https://mcp.cargomesh.test",
  canonicalResource: "https://mcp.cargomesh.test/mcp",
  clientId: "alexa-service-test",
  clientSecret: "client-secret-used-only-for-tests-1234567890",
  signingSecret: "separate-signing-secret-used-for-tests-1234567890",
  tokenTtlSeconds: 900,
};
