import { createHash, timingSafeEqual } from "node:crypto";
import { readMcpServiceAuthConfiguration, type McpServiceAuthConfiguration } from "./configuration";
import { issueMcpServiceToken } from "./service-token";

type Dependencies = {
  configuration: () => McpServiceAuthConfiguration;
  issueToken: typeof issueMcpServiceToken;
};

const defaults: Dependencies = {
  configuration: readMcpServiceAuthConfiguration,
  issueToken: issueMcpServiceToken,
};

function oauthResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

function oauthError(status: number, error: string, description: string): Response {
  return oauthResponse(status, { error, error_description: description });
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function basicCredentials(header: string | null): { clientId: string; clientSecret: string } | null {
  const match = header ? /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header) : null;
  if (!match || match[1].length % 4 === 1) return null;
  let decoded: string;
  try {
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.toString("base64").replace(/=+$/, "") !== match[1].replace(/=+$/, "")) return null;
    decoded = buffer.toString("utf8");
  } catch { return null; }
  const separator = decoded.indexOf(":");
  if (separator < 1) return null;
  return { clientId: decoded.slice(0, separator), clientSecret: decoded.slice(separator + 1) };
}

export function createMcpTokenHandler(dependencies: Dependencies = defaults) {
  return async function handleMcpTokenRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      const response = oauthError(405, "invalid_request", "The token endpoint supports POST only.");
      response.headers.set("Allow", "POST");
      return response;
    }
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/x-www-form-urlencoded") {
      return oauthError(400, "invalid_request", "Use application/x-www-form-urlencoded.");
    }
    let config: McpServiceAuthConfiguration;
    try { config = dependencies.configuration(); } catch {
      return oauthError(503, "server_error", "Service authentication is unavailable.");
    }
    const credentials = basicCredentials(request.headers.get("authorization"));
    if (
      !credentials || !constantTimeEqual(credentials.clientId, config.clientId) ||
      !constantTimeEqual(credentials.clientSecret, config.clientSecret)
    ) return oauthError(401, "invalid_client", "Client authentication failed.");

    let rawBody: string;
    try { rawBody = await request.text(); } catch {
      return oauthError(400, "invalid_request", "Unable to read token request.");
    }
    if (Buffer.byteLength(rawBody) > 8 * 1024) {
      return oauthError(400, "invalid_request", "Token request is too large.");
    }
    const form = new URLSearchParams(rawBody);
    const exactlyOne = (name: string) => form.getAll(name).length === 1 ? form.get(name) : null;
    const grantType = exactlyOne("grant_type");
    if (grantType !== "client_credentials") {
      return oauthError(400, "unsupported_grant_type", "Only client_credentials is supported.");
    }
    const scope = exactlyOne("scope");
    if (scope !== "mcp:service") {
      return oauthError(400, "invalid_scope", "Only mcp:service is supported.");
    }
    const resource = exactlyOne("resource");
    if (resource !== config.canonicalResource) {
      return oauthError(400, "invalid_target", "The canonical MCP resource is required.");
    }
    if (form.has("client_id") || form.has("client_secret")) {
      return oauthError(400, "invalid_request", "Use HTTP Basic client authentication.");
    }
    try {
      const { accessToken, expiresIn } = await dependencies.issueToken(config);
      return oauthResponse(200, {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        scope: "mcp:service",
      });
    } catch {
      return oauthError(503, "server_error", "Unable to issue an access token.");
    }
  };
}
