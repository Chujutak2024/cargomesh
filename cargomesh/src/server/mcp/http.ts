import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest } from "./auth/context";
import type { McpPrincipal } from "./auth/principal";
import { publicMcpError } from "./errors";
import { createCargoMeshMcpServer } from "./server";
import { readPersistedFreightOptions, type ReadFreightOptions } from "./tools/get-freight-options";
import type { CreateFreightRequest } from "./tools/create-freight-request";
import type { FindFreightOptions } from "./tools/find-freight-options";
import type { SubmitFreightRequest } from "./tools/submit-freight-request";

type Dependencies = {
  authenticate: (request: Request) => Promise<McpPrincipal>;
  read: ReadFreightOptions;
  create?: CreateFreightRequest;
  find?: FindFreightOptions;
  submit?: SubmitFreightRequest;
  configuration: () => McpHttpConfiguration;
};

type McpHttpConfiguration = {
  mode: string;
  environment: string | undefined;
  localEnabled: boolean;
  remoteEnabled: boolean;
  canonicalOrigin: string | undefined;
  allowedOrigins: string | undefined;
};

type McpRequestPolicy =
  | { enabled: false; status: 404 | 503; message: string }
  | { enabled: true; mode: "local" }
  | { enabled: true; mode: "remote"; canonicalOrigin: string; allowedOrigins: ReadonlySet<string> };

function responseError(status: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

function isOrigin(value: string, requireHttps: boolean): string | null {
  try {
    const parsed = new URL(value);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (requireHttps ? parsed.protocol !== "https:" : !["http:", "https:"].includes(parsed.protocol)) ||
      (!requireHttps && parsed.protocol === "http:" && !isLoopback) ||
      parsed.username || parsed.password ||
      (parsed.pathname !== "/" && parsed.pathname !== "") || parsed.search || parsed.hash
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveRequestPolicy(config: McpHttpConfiguration): McpRequestPolicy {
  if (config.mode === "local") {
    if (!config.localEnabled || !["development", "test"].includes(config.environment ?? "")) {
      return { enabled: false, status: 404, message: "MCP local preview is disabled." };
    }
    return { enabled: true, mode: "local" };
  }
  if (config.mode !== "remote") {
    return { enabled: false, status: 503, message: "MCP transport mode is invalid." };
  }
  if (!config.remoteEnabled) {
    return { enabled: false, status: 404, message: "MCP remote endpoint is disabled." };
  }

  const canonicalOrigin = config.canonicalOrigin
    ? isOrigin(config.canonicalOrigin, true)
    : null;
  const candidates = config.allowedOrigins?.split(",").map((value) => value.trim()) ?? [];
  const allowedOrigins = candidates.map((value) => isOrigin(value, true));
  if (
    !canonicalOrigin || candidates.length === 0 ||
    allowedOrigins.some((origin) => origin === null) ||
    !allowedOrigins.includes(canonicalOrigin)
  ) {
    return { enabled: false, status: 503, message: "MCP remote configuration is invalid." };
  }
  return {
    enabled: true,
    mode: "remote",
    canonicalOrigin,
    allowedOrigins: new Set(allowedOrigins.filter((origin): origin is string => origin !== null)),
  };
}

function hasMatchingAuthority(request: Request, expectedOrigin: string): boolean {
  const url = new URL(request.url);
  if (url.origin !== expectedOrigin) return false;
  const host = request.headers.get("host");
  return host === null || host === url.host;
}

function isLocalRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
  const host = request.headers.get("host");
  // Next may normalize Request.url to localhost even when bound to 127.0.0.1.
  // Both authorities must remain loopback and refer to the same port.
  let requestOrigin = url.origin;
  if (host !== null) {
    let hostUrl: URL;
    try { hostUrl = new URL(`${url.protocol}//${host}`); } catch { return false; }
    if (hostUrl.host !== host || !["localhost", "127.0.0.1", "[::1]"].includes(hostUrl.hostname) || hostUrl.port !== url.port) return false;
    requestOrigin = hostUrl.origin;
  }
  const origin = request.headers.get("origin");
  return (origin === null || origin === requestOrigin) && request.headers.get("sec-fetch-site") !== "cross-site";
}

function isRemoteRequest(
  request: Request,
  policy: Extract<McpRequestPolicy, { enabled: true; mode: "remote" }>,
): boolean {
  if (!hasMatchingAuthority(request, policy.canonicalOrigin)) return false;
  const origin = request.headers.get("origin");
  if (origin === "null") return false;
  if (origin !== null && !policy.allowedOrigins.has(origin)) return false;
  // Browser cross-site requests remain blocked; service MCP clients omit these headers.
  // Server-to-server MCP clients normally omit Fetch Metadata and Origin.
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

export function createMcpHttpHandler(dependencies: Dependencies = {
  authenticate: authenticateMcpRequest,
  read: readPersistedFreightOptions,
  configuration: () => ({
    mode: process.env.CARGOMESH_MCP_MODE ?? "local",
    environment: process.env.NODE_ENV,
    localEnabled: process.env.CARGOMESH_MCP_LOCAL_ENABLED === "true",
    remoteEnabled: process.env.CARGOMESH_MCP_REMOTE_ENABLED === "true",
    canonicalOrigin: process.env.CARGOMESH_MCP_CANONICAL_ORIGIN,
    allowedOrigins: process.env.CARGOMESH_MCP_ALLOWED_ORIGINS,
  }),
}) {
  return async function handleMcpRequest(request: Request): Promise<Response> {
    const policy = resolveRequestPolicy(dependencies.configuration());
    if (!policy.enabled) return responseError(policy.status, policy.message);
    if (policy.mode === "local" && !isLocalRequest(request)) {
      return responseError(403, "MCP requires a local, same-origin request.");
    }
    if (policy.mode === "remote" && !isRemoteRequest(request, policy)) {
      return responseError(403, "MCP request origin is not allowed.");
    }

    let principal: McpPrincipal;
    try {
      principal = await dependencies.authenticate(request);
    } catch (error) {
      const safe = publicMcpError(error);
      const status = safe.code === "UNAUTHENTICATED" ? 401 : safe.code === "FORBIDDEN" ? 403 : 500;
      return responseError(status, status === 500 ? "Unable to authenticate MCP request." : safe.message);
    }
    if (request.method !== "POST") {
      const response = responseError(405, "This stateless endpoint supports POST only; no SSE subscription or session deletion.");
      response.headers.set("Allow", "POST");
      return response;
    }

    // Reject oversized payloads without buffering an unlimited stream.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 64 * 1024) {
            await reader.cancel();
            return responseError(413, "MCP request body is too large.");
          }
          chunks.push(chunk.value);
        }
      } catch {
        return responseError(400, "Unable to read MCP request.");
      } finally {
        reader.releaseLock();
      }
    }
    // Let the SDK validate JSON and JSON-RPC rather than reimplementing them.
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const boundedRequest = new Request(request.url, {
      method: "POST", headers: request.headers, body, signal: request.signal,
    });
    const server = createCargoMeshMcpServer(principal, dependencies.read, dependencies.create, dependencies.find, dependencies.submit);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(boundedRequest);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch {
      return responseError(500, "MCP request failed.");
    } finally {
      // JSON mode resolves after the tool response. No stream/session survives.
      await server.close();
    }
  };
}
