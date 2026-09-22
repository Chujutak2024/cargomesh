import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetFreightOptions, type ReadFreightOptions } from "./tools/get-freight-options";
import { registerCreateFreightRequest, createPersistedFreightRequest, type CreateFreightRequest } from "./tools/create-freight-request";
import { registerFindFreightOptions, startPersistedFreightOptions, type FindFreightOptions } from "./tools/find-freight-options";
import { registerSubmitFreightRequest, submitPersistedFreightRequest, type SubmitFreightRequest } from "./tools/submit-freight-request";
import { requireMcpUser, type McpPrincipal } from "./auth/principal";
import { implementedCapabilities, type McpCapabilityProfile } from "./capabilities";
import { registerGetCargoMeshCapabilities } from "./tools/get-cargomesh-capabilities";

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
export function createCargoMeshMcpServer(
  principal: McpPrincipal,
  read: ReadFreightOptions,
  create: CreateFreightRequest = createPersistedFreightRequest,
  find: FindFreightOptions = startPersistedFreightOptions,
  submit: SubmitFreightRequest = submitPersistedFreightRequest,
  profile: McpCapabilityProfile = "V2",
) {
  const server = new McpServer({ name: "cargomesh", version: "0.1.0" });
  const names = new Set(implementedCapabilities(profile).map((capability) => capability.toolName));
  if (names.has("get_cargomesh_capabilities")) registerGetCargoMeshCapabilities(server, profile);
  if (names.has("get_freight_options")) registerGetFreightOptions(server, userOnly(principal, read));
  if (names.has("create_freight_request")) registerCreateFreightRequest(server, userOnly(principal, create));
  if (names.has("submit_freight_request")) registerSubmitFreightRequest(server, userOnly(principal, submit));
  if (names.has("find_freight_options")) registerFindFreightOptions(server, userOnly(principal, find));
  return server;
}
