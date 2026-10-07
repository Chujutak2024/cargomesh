import assert from "node:assert/strict";
import test from "node:test";
import { currentMcpSupabaseAccessToken, runWithMcpRequestIdentity } from "./request-context";

test("Supabase bearer identity remains isolated between concurrent MCP requests", async () => {
  const values = await Promise.all(["token-a", "token-b"].map((token) =>
    runWithMcpRequestIdentity({ supabaseAccessToken: token }, async () => {
      await new Promise((resolve) => setTimeout(resolve, token === "token-a" ? 5 : 1));
      return currentMcpSupabaseAccessToken();
    })));
  assert.deepEqual(values, ["token-a", "token-b"]);
  assert.equal(currentMcpSupabaseAccessToken(), undefined);
});
