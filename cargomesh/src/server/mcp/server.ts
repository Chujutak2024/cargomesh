import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetFreightOptions, type ReadFreightOptions } from "./tools/get-freight-options";
import { registerCreateFreightRequest, createPersistedFreightRequest, type CreateFreightRequest } from "./tools/create-freight-request";
import { registerFindFreightOptions, startPersistedFreightOptions, type FindFreightOptions } from "./tools/find-freight-options";
import { registerSubmitFreightRequest, submitPersistedFreightRequest, type SubmitFreightRequest } from "./tools/submit-freight-request";
import { requireMcpUser, type McpPrincipal } from "./auth/principal";

function userOnly<TArguments extends unknown[], TResult>(
  principal: McpPrincipal,
  operation: (...arguments_: TArguments) => Promise<TResult>,
): (...arguments_: TArguments) => Promise<TResult> {
  return async (...arguments_) => {
    requireMcpUser(principal);
    return operation(...arguments_);
  };
}

// Request-scoped: never share a user's transport/auth state with another caller.
export function createCargoMeshMcpServer(principal: McpPrincipal, read: ReadFreightOptions, create: CreateFreightRequest = createPersistedFreightRequest, find: FindFreightOptions = startPersistedFreightOptions, submit: SubmitFreightRequest = submitPersistedFreightRequest) {
  const server = new McpServer({ name: "cargomesh", version: "0.1.0" });
  registerGetFreightOptions(server, userOnly(principal, read));
  registerCreateFreightRequest(server, userOnly(principal, create));
  registerSubmitFreightRequest(server, userOnly(principal, submit));
  registerFindFreightOptions(server, userOnly(principal, find));
  return server;
}
