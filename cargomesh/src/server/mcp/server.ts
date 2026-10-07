import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpPrincipal } from "./auth/principal";
import type { McpCapabilityProfile } from "./capabilities";
import { registerGetCargoMeshCapabilities } from "./tools/get-cargomesh-capabilities";
import { registerV2RoadTools, type V2RoadToolServices } from "./tools/v2-road";
export function createCargoMeshMcpServer(principal: McpPrincipal, profile: McpCapabilityProfile = "V2",
  v2RoadServices?: V2RoadToolServices) {
  const server = new McpServer({ name: "cargomesh", version: "0.2.0" });
  registerGetCargoMeshCapabilities(server, profile);
  registerV2RoadTools(server, principal, v2RoadServices);
  return server;
}
