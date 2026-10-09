import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCargoMeshMcpServer } from "../server";
import { testMcpUserPrincipal } from "../auth/test-principal";
import { persistedV2WorkflowToolServices } from "./v2-workflow-services";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
const id = "c2340000-0000-4000-8000-000000000001";
async function connected(services = persistedV2WorkflowToolServices) {
  const server = createCargoMeshMcpServer(testMcpUserPrincipal(), "V2", undefined, services);
  const client = new Client({ name: "HAC41-unit", version: "1.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
test("MCP declares full workflow schemas and prevents false confirmation from reaching persistence", async () => {
  let calls = 0;
  const { client, close } = await connected({ ...persistedV2WorkflowToolServices,
    confirm: async () => { calls++; throw new Error("unexpected database access"); } });
  try {
    const { tools } = await client.listTools();
    for (const name of ["prepare_v2_commercial_action", "confirm_v2_commercial_action", "read_v2_workflow",
      "find_v2_route_alternatives", "confirm_v2_location"]) {
      const tool = tools.find(tool => tool.name === name);
      assert.ok(tool?.outputSchema); assert.equal(tool.inputSchema.additionalProperties, false);
    }
    const result = await client.callTool({ name: "confirm_v2_commercial_action", arguments: { confirmationId: id, confirmed: false } });
    assert.equal(result.isError, true); assert.equal(calls, 0);
  } finally { await close(); }
});
test("MCP exposes stable conflict codes without internal SQL or credentials", async () => {
  const { client, close } = await connected({ ...persistedV2WorkflowToolServices,
    confirm: async () => { throw new V2DraftError("STALE_DRAFT", "secret database connection string", 409); } });
  try {
    const result = await client.callTool({ name: "confirm_v2_commercial_action", arguments: { confirmationId: id, confirmed: true } });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /STALE_DRAFT/); assert.doesNotMatch(JSON.stringify(result), /secret database/);
  } finally { await close(); }
});
