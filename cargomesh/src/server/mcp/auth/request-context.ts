import { AsyncLocalStorage } from "node:async_hooks";

export type McpRequestIdentity = {
  supabaseAccessToken?: string;
};

const storage = new AsyncLocalStorage<McpRequestIdentity>();

export function runWithMcpRequestIdentity<T>(
  identity: McpRequestIdentity,
  operation: () => T,
): T {
  return storage.run(identity, operation);
}

export function currentMcpSupabaseAccessToken(): string | undefined {
  return storage.getStore()?.supabaseAccessToken;
}
