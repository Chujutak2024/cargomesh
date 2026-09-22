import assert from "node:assert/strict";
import test from "node:test";
import { OrchestrationError, type StartOrchestrationRunResult } from "@/features/orchestration/contracts";
import { createMcpHttpHandler } from "./http";
import type { FindFreightOptions } from "./tools/find-freight-options";
import { testMcpUserPrincipal } from "./auth/test-principal";

const REQUEST = "f2000000-0000-0000-0000-000000000001";
const RUN = "90000000-0000-0000-0000-000000000001";
const KEY = "mcp-find-options-1";
const result: StartOrchestrationRunResult = {
  runId: RUN, freightRequestId: REQUEST, status: "RUNNING", deduplicated: false,
  candidates: [{ carrierId: "b0000000-0000-0000-0000-000000000001", carrierCode: "ANDES",
    displayName: "Andes", providerUrl: "/providers/andes",
    matchingServiceId: "d0000000-0000-0000-0000-000000000001" }],
};

function harness(find: FindFreightOptions, authError?: Error) {
  const handler = createMcpHttpHandler({
    authenticate: async () => { if (authError) throw authError; return testMcpUserPrincipal(); },
    read: async () => { throw new Error("unexpected read"); },
    create: async () => { throw new Error("unexpected create"); },
    find,
    configuration: () => ({
      mode: "local", environment: "test", localEnabled: true, remoteEnabled: false,
      canonicalOrigin: undefined, allowedOrigins: undefined,
    }),
  });
  return async (arguments_: unknown) => {
    const response = await handler(new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "find_freight_options", arguments: arguments_ } }),
    }));
    return { status: response.status, body: await response.json() };
  };
}

test("find forwards accepted request and key, returns the persisted run identity and replay state", async () => {
  const calls: unknown[] = [];
  const call = harness(async (input) => { calls.push(input); return result; });
  const response = await call({ freightRequestId: REQUEST, idempotencyKey: ` ${KEY} ` });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ freightRequestId: REQUEST, idempotencyKey: KEY }]);
  assert.deepEqual(response.body.result.structuredContent, { ok: true, data: result });
  const replay = await harness(async () => ({ ...result, status: "OPTIONS_READY", deduplicated: true }))
    ({ freightRequestId: REQUEST, idempotencyKey: KEY });
  assert.equal(replay.body.result.structuredContent.data.status, "OPTIONS_READY");
  assert.equal(replay.body.result.structuredContent.data.deduplicated, true);
});

test("invalid tool arguments and anonymous access never start a run", async () => {
  const call = harness(async () => { assert.fail("must not start"); });
  for (const args of [{}, { freightRequestId: "bad", idempotencyKey: KEY },
    { freightRequestId: REQUEST, idempotencyKey: "" },
    { freightRequestId: REQUEST, idempotencyKey: KEY, organizationId: REQUEST }]) {
    assert.equal((await call(args)).body.result.isError, true);
  }
  assert.equal((await harness(async () => { assert.fail("must not start"); },
    new Error("UNAUTHENTICATED: private"))({ freightRequestId: REQUEST, idempotencyKey: KEY })).status, 401);
});

test("find maps domain failures safely and rejects uncorrelated service results", async () => {
  for (const [error, expected] of [
    [new OrchestrationError("NOT_FOUND", "private SQL row", 404), "NOT_FOUND"],
    [new OrchestrationError("FORBIDDEN", "private tenant", 403), "FORBIDDEN"],
    [new OrchestrationError("FREIGHT_REQUEST_NOT_READY", "private status", 409), "FREIGHT_REQUEST_NOT_READY"],
    [new Error("SUPABASE_SERVICE_ROLE_KEY=secret"), "ORCHESTRATION_START_FAILED"],
  ] as const) {
    const response = await harness(async () => { throw error; })({ freightRequestId: REQUEST, idempotencyKey: KEY });
    assert.equal(response.body.result.isError, true);
    assert.equal(response.body.result.structuredContent.error.code, expected);
    assert.doesNotMatch(JSON.stringify(response.body), /private|SQL row|SUPABASE_SERVICE_ROLE_KEY|secret/);
  }
  const mismatch = await harness(async () => ({ ...result, freightRequestId: RUN }))
    ({ freightRequestId: REQUEST, idempotencyKey: KEY });
  assert.equal(mismatch.body.result.structuredContent.error.code, "ORCHESTRATION_START_FAILED");
});
