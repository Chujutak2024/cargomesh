import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpSession } from "./auth/context";
import { publicMcpError } from "./errors";
import { createCargoMeshMcpServer } from "./server";
import { readPersistedFreightOptions, type ReadFreightOptions } from "./tools/get-freight-options";
import type { CreateFreightRequest } from "./tools/create-freight-request";

type Dependencies = {
  authenticate: () => Promise<void>;
  read: ReadFreightOptions;
  create?: CreateFreightRequest;
  configuration: () => { enabled: boolean; environment: string | undefined };
};

function responseError(status: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, {
    status, headers: { "Cache-Control": "no-store" },
  });
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

export function createMcpHttpHandler(dependencies: Dependencies = {
  authenticate: authenticateMcpSession,
  read: readPersistedFreightOptions,
  configuration: () => ({
    enabled: process.env.CARGOMESH_MCP_LOCAL_ENABLED === "true",
    environment: process.env.NODE_ENV,
  }),
}) {
  return async function handleMcpRequest(request: Request): Promise<Response> {
    const config = dependencies.configuration();
    if (!config.enabled || !["development", "test"].includes(config.environment ?? "")) {
      return responseError(404, "MCP local preview is disabled.");
    }
    if (!isLocalRequest(request)) return responseError(403, "MCP requires a local, same-origin request.");

    // Authenticate every request, including initialize and tools/list. A bearer
    // header is not a replacement for the current CargoMesh cookie session.
    try {
      await dependencies.authenticate();
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
    const server = createCargoMeshMcpServer(dependencies.read, dependencies.create);
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
