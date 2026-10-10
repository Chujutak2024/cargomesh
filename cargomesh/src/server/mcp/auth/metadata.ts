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

/** User discovery points at Supabase; CargoMesh's /oauth/token stays service-only. */
export function createProtectedResourceMetadataHandler(
  env: Readonly<Record<string, string | undefined>> = process.env,
  serviceConfiguration: () => McpServiceAuthConfiguration = readMcpServiceAuthConfiguration,
) {
  if (env.CARGOMESH_MCP_USER_BEARER_ENABLED !== "true") {
    return createMetadataHandler(protectedResourceMetadata, serviceConfiguration);
  }
  return async function handleUserMetadata(): Promise<Response> {
    try {
      const resource = new URL(env.CARGOMESH_MCP_CANONICAL_RESOURCE ?? "");
      const provider = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
      if (resource.protocol !== "https:" || resource.pathname !== "/mcp" || resource.username || resource.password
        || resource.search || resource.hash || provider.protocol !== "https:" || provider.pathname !== "/"
        || provider.username || provider.password || provider.search || provider.hash
        || resource.origin !== env.CARGOMESH_MCP_CANONICAL_ORIGIN
        || !env.CARGOMESH_MCP_USER_OAUTH_CLIENT_ID?.match(/^\S{1,256}$/)) throw new Error("Invalid user OAuth discovery configuration.");
      return Response.json({ resource: resource.toString(), authorization_servers: [`${provider.origin}/auth/v1`],
        scopes_supported: ["openid", "email", "profile"], bearer_methods_supported: ["header"] },
      { headers: { "Cache-Control": "public, max-age=300" } });
    } catch {
      return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  };
}
