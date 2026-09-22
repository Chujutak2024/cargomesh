import assert from "node:assert/strict";
import test from "node:test";
import { createMcpHttpHandler } from "./http";
import type { SubmitFreightRequest } from "./tools/submit-freight-request";
import { testMcpUserPrincipal } from "./auth/test-principal";

const REQUEST = "f2000000-0000-0000-0000-000000000001";
const submitted = { freightRequestId: REQUEST, requestCode: "FR-2001", status: "PENDING" as const, draftVersion: 2, replayed: false };

function call(submit: SubmitFreightRequest, args: unknown, authError?: Error) {
  const handler = createMcpHttpHandler({
    authenticate: async () => { if (authError) throw authError; return testMcpUserPrincipal(); },
    read: async () => { throw new Error("unexpected read"); },
    submit, configuration: () => ({
      mode: "local", environment: "test", localEnabled: true, remoteEnabled: false,
      canonicalOrigin: undefined, allowedOrigins: undefined, profile: "V1_REGRESSION",
    }),
  });
  return handler(new Request("http://localhost:3000/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "submit_freight_request", arguments: args } }),
  }));
}

test("submit forwards a versioned request and returns correlated PENDING", async () => {
  const calls: unknown[] = [];
  const response = await call(async (input) => { calls.push(input); return submitted; },
    { freightRequestId: REQUEST, draftVersion: 1 });
  const body = await response.json();
  assert.deepEqual(calls, [{ freightRequestId: REQUEST, draftVersion: 1 }]);
  assert.deepEqual(body.result.structuredContent, { ok: true, data: submitted });
  assert.deepEqual(JSON.parse(body.result.content[0].text), body.result.structuredContent);
});

test("submit rejects invalid input, unauthenticated access, and unsafe errors", async () => {
  for (const args of [{}, { freightRequestId: "bad", draftVersion: 1 },
    { freightRequestId: REQUEST, draftVersion: 0 },
    { freightRequestId: REQUEST, draftVersion: 1, organizationId: REQUEST }]) {
    const response = await call(async () => { assert.fail("must not submit"); }, args);
    assert.equal((await response.json()).result.isError, true);
  }
  assert.equal((await call(async () => { assert.fail("must not submit"); },
    { freightRequestId: REQUEST, draftVersion: 1 }, new Error("UNAUTHENTICATED: secret"))).status, 401);
  const failure = await call(async () => { throw new Error("SQL password secret"); },
    { freightRequestId: REQUEST, draftVersion: 1 });
  const result = await failure.json();
  assert.equal(result.result.structuredContent.error.code, "SUBMISSION_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(result), /SQL password secret/);
  const mismatch = await call(async () => ({ ...submitted, freightRequestId: "f2000000-0000-0000-0000-000000000002" }),
    { freightRequestId: REQUEST, draftVersion: 1 });
  assert.equal((await mismatch.json()).result.structuredContent.error.code, "SUBMISSION_UNAVAILABLE");
});
