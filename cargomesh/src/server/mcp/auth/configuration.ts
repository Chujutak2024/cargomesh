export type McpServiceAuthConfiguration = {
  issuer: string;
  canonicalResource: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  tokenTtlSeconds: number;
};

function httpsUrl(value: string | undefined, label: string, requireMcpPath = false): URL {
  if (!value) throw new Error(`Missing ${label}.`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`Invalid ${label}.`); }
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash ||
    (requireMcpPath ? parsed.pathname !== "/mcp" : parsed.pathname !== "/")
  ) throw new Error(`Invalid ${label}.`);
  return parsed;
}

export function readMcpServiceAuthConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
): McpServiceAuthConfiguration {
  const issuerUrl = httpsUrl(env.CARGOMESH_OAUTH_ISSUER, "CARGOMESH_OAUTH_ISSUER");
  const resourceUrl = httpsUrl(
    env.CARGOMESH_MCP_CANONICAL_RESOURCE,
    "CARGOMESH_MCP_CANONICAL_RESOURCE",
    true,
  );
  if (issuerUrl.origin !== resourceUrl.origin) {
    throw new Error("OAuth issuer and canonical MCP resource must share an origin.");
  }
  if (env.CARGOMESH_MCP_CANONICAL_ORIGIN) {
    const transportOrigin = httpsUrl(
      env.CARGOMESH_MCP_CANONICAL_ORIGIN,
      "CARGOMESH_MCP_CANONICAL_ORIGIN",
    );
    if (transportOrigin.origin !== resourceUrl.origin) {
      throw new Error("Canonical MCP origin and resource do not match.");
    }
  }

  const clientId = env.CARGOMESH_MCP_SERVICE_CLIENT_ID;
  const clientSecret = env.CARGOMESH_MCP_SERVICE_CLIENT_SECRET;
  const signingSecret = env.CARGOMESH_MCP_JWT_SIGNING_SECRET;
  if (!clientId || clientId.length > 256 || /[:\s]/.test(clientId)) throw new Error("Invalid MCP service client id.");
  if (!clientSecret || Buffer.byteLength(clientSecret) < 32) throw new Error("MCP service client secret must be at least 32 bytes.");
  if (!signingSecret || Buffer.byteLength(signingSecret) < 32) throw new Error("MCP JWT signing secret must be at least 32 bytes.");
  if (clientSecret === signingSecret) throw new Error("MCP client and signing secrets must be different.");

  const tokenTtlSeconds = Number(env.CARGOMESH_MCP_TOKEN_TTL_SECONDS ?? "900");
  if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds < 60 || tokenTtlSeconds > 3600) {
    throw new Error("MCP token TTL must be an integer from 60 through 3600 seconds.");
  }
  return {
    issuer: issuerUrl.origin,
    canonicalResource: resourceUrl.toString(),
    clientId,
    clientSecret,
    signingSecret,
    tokenTtlSeconds,
  };
}
