import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetFreightOptions, type ReadFreightOptions } from "./tools/get-freight-options";
import { registerCreateFreightRequest, createPersistedFreightRequest, type CreateFreightRequest } from "./tools/create-freight-request";

// Request-scoped: never share a user's transport/auth state with another caller.
export function createCargoMeshMcpServer(read: ReadFreightOptions, create: CreateFreightRequest = createPersistedFreightRequest) {
  const server = new McpServer({ name: "cargomesh", version: "0.1.0" });
  registerGetFreightOptions(server, read);
  registerCreateFreightRequest(server, create);
  return server;
}
