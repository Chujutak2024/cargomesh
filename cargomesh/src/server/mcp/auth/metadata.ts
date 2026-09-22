import { readMcpServiceAuthConfiguration, type McpServiceAuthConfiguration } from "./configuration";

export function protectedResourceMetadata(config: McpServiceAuthConfiguration) {
  return {
    resource: config.canonicalResource,
    authorization_servers: [config.issuer],
    scopes_supported: ["mcp:service"],
  };
}

export function authorizationServerMetadata(config: McpServiceAuthConfiguration) {
  return {
    issuer: config.issuer,
    token_endpoint: new URL("/oauth/token", config.issuer).toString(),
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    scopes_supported: ["mcp:service"],
  };
}

export function createMetadataHandler(
  build: (config: McpServiceAuthConfiguration) => Record<string, unknown>,
  configuration: () => McpServiceAuthConfiguration = readMcpServiceAuthConfiguration,
) {
  return async function handleMetadata(): Promise<Response> {
    try {
      return Response.json(build(configuration()), {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    } catch {
      return Response.json({ error: "temporarily_unavailable" }, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
  };
}
