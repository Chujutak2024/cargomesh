import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { capabilityReport, type McpCapabilityProfile } from "../capabilities";

export function registerGetCargoMeshCapabilities(server: McpServer, profile: McpCapabilityProfile) {
  server.registerTool("get_cargomesh_capabilities", {
    title: "Get CargoMesh MCP capability status",
    description: "Read the active MCP profile and explicit implementation/source/legacy status. Does not read tenant or freight data.",
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const output = { ok: true as const, data: capabilityReport(profile) };
    return { structuredContent: output, content: [{ type: "text" as const, text: JSON.stringify(output) }] };
  });
}
