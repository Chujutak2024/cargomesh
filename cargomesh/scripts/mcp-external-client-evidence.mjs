import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.CARGOMESH_MCP_EVIDENCE_URL ?? "http://127.0.0.1:3000/mcp";
const tokenEndpoint = process.env.CARGOMESH_MCP_EVIDENCE_TOKEN_URL ?? "http://127.0.0.1:3000/oauth/token";
const clientId = process.env.CARGOMESH_MCP_SERVICE_CLIENT_ID;
const clientSecret = process.env.CARGOMESH_MCP_SERVICE_CLIENT_SECRET;
const resource = process.env.CARGOMESH_MCP_CANONICAL_RESOURCE;
if (!clientId || !clientSecret || !resource) throw new Error("Missing service evidence configuration.");

const tokenStarted = performance.now();
const tokenResponse = await fetch(tokenEndpoint, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ grant_type: "client_credentials", scope: "mcp:service", resource }),
});
if (!tokenResponse.ok) throw new Error(`Token endpoint failed with ${tokenResponse.status}.`);
const token = await tokenResponse.json();
if (typeof token.access_token !== "string") throw new Error("Token response has no access token.");
const tokenLatencyMs = Math.round((performance.now() - tokenStarted) * 100) / 100;

let negotiatedProtocol = null;
const observedFetch = async (input, init) => {
  const response = await fetch(input, init);
  try {
    const requestBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (requestBody?.method === "initialize") {
      const body = await response.clone().json();
      negotiatedProtocol = body?.result?.protocolVersion ?? null;
    }
  } catch { /* Evidence collection must not affect protocol execution. */ }
  return response;
};

const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } },
  fetch: observedFetch,
});
const client = new Client({ name: "cargomesh-controlled-external-client", version: "1.0.0" });
const mcpStarted = performance.now();
try {
  await client.connect(transport);
  const listed = await client.listTools();
  const capabilityResult = await client.callTool({ name: "get_cargomesh_capabilities", arguments: {} });
  const invalidBearerResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer invalid",
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }),
  });
  const mcpLatencyMs = Math.round((performance.now() - mcpStarted) * 100) / 100;
  console.log(JSON.stringify({
    evidence: "LOCAL_CONTROLLED_MCP_CLIENT",
    endpoint,
    authType: "client_credentials/mcp:service",
    protocolVersion: negotiatedProtocol,
    server: client.getServerVersion(),
    toolNames: listed.tools.map((tool) => tool.name),
    capabilityStatus: capabilityResult.structuredContent?.data?.status ?? null,
    invalidBearerStatus: invalidBearerResponse.status,
    tokenLatencyMs,
    initializeAndListLatencyMs: mcpLatencyMs,
    tokenExpiresIn: token.expires_in,
  }));
} finally {
  await client.close();
}
