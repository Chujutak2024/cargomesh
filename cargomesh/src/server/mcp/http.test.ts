import assert from "node:assert/strict";
import test from "node:test";
import { createMcpHttpHandler } from "./http";
import { testMcpUserPrincipal } from "./auth/test-principal";
const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
function handler(overrides: Record<string, unknown> = {}) {
  return createMcpHttpHandler({
    authenticate: async () => testMcpUserPrincipal(),
    configuration: () => ({ mode: "local", environment: "test", localEnabled: true, remoteEnabled: false, canonicalOrigin: undefined, allowedOrigins: undefined, ...overrides }),
  });
}
function rpc(method: string, id = 1, params: unknown = {}) {
  return new Request("http://localhost:3000/mcp", { method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
}
test("MCP V2 lists only implemented V2 tools", async () => {
  const response = await handler()(rpc("tools/list"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.result.tools.map((tool: { name: string }) => tool.name).sort(),
    implementedCapabilities("V2").map(tool => tool.toolName).sort());
});
test("legacy MCP profile fails closed", async () => {
  assert.equal((await handler({ profile: "V1_REGRESSION" })(rpc("tools/list"))).status, 503);
});
test("disabled local MCP cannot be enabled by caller", async () => {
  assert.equal((await handler({ localEnabled: false })(rpc("tools/list"))).status, 404);
});
test("MCP local rejects remote origin", async () => {
  const request = rpc("tools/list");
  request.headers.set("Origin", "https://foreign.test");
  assert.equal((await handler()(request)).status, 403);
});
test("MCP rejects non-POST and oversized requests", async () => {
  assert.equal((await handler()(new Request("http://localhost:3000/mcp"))).status, 405);
  assert.equal((await handler()(new Request("http://localhost:3000/mcp", { method: "POST", headers, body: "x".repeat(65537) }))).status, 413);
});
test("MCP rejects unauthenticated caller", async () => {
  const run = createMcpHttpHandler({ authenticate: async () => { throw new Error("UNAUTHENTICATED: no session"); },
    configuration: () => ({ mode: "local", environment: "test", localEnabled: true, remoteEnabled: false, canonicalOrigin: undefined, allowedOrigins: undefined }) });
  const response = await run(rpc("tools/list"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("WWW-Authenticate"), 'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"');
});
import { implementedCapabilities } from "./capabilities";
