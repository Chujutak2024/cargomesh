import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetFreightOptions, type ReadFreightOptions } from "./tools/get-freight-options";
import { registerCreateFreightRequest, createPersistedFreightRequest, type CreateFreightRequest } from "./tools/create-freight-request";
import { registerFindFreightOptions, startPersistedFreightOptions, type FindFreightOptions } from "./tools/find-freight-options";
import { registerSubmitFreightRequest, submitPersistedFreightRequest, type SubmitFreightRequest } from "./tools/submit-freight-request";

// Request-scoped: never share a user's transport/auth state with another caller.
export function createCargoMeshMcpServer(read: ReadFreightOptions, create: CreateFreightRequest = createPersistedFreightRequest, find: FindFreightOptions = startPersistedFreightOptions, submit: SubmitFreightRequest = submitPersistedFreightRequest) {
  const server = new McpServer({ name: "cargomesh", version: "0.1.0" });
  registerGetFreightOptions(server, read);
  registerCreateFreightRequest(server, create);
  registerSubmitFreightRequest(server, submit);
  registerFindFreightOptions(server, find);
  return server;
}
