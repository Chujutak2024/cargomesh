import assert from "node:assert/strict";
import test from "node:test";
import { extractMcpAuditInput, extractMcpAuditOutput } from "./audit";

test("records only actual MCP tool calls with safe input fields", () => {
  const call = { method: "tools/call", id: 7, params: {
    name: "create_freight_request", arguments: {
      idempotencyKey: "TEST_IDEMPOTENCY_SECRET",
      password: "TEST_PASSWORD",
      authorization: "Bearer TEST_AUTH_TOKEN",
      access_token: "TEST_ACCESS_TOKEN",
      refresh_token: "TEST_REFRESH_TOKEN",
      api_key: "TEST_API_KEY",
      cookie: "TEST_COOKIE",
      service_role: "TEST_SERVICE_ROLE",
      email: "user@example.com",
    },
  }};
  const audit = extractMcpAuditInput(call);
  assert.deepEqual(audit, { toolName: "create_freight_request", requestId: "7", inputPayload: null });
  assert.doesNotMatch(JSON.stringify(audit), /TEST_(?:IDEMPOTENCY_SECRET|PASSWORD|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY|COOKIE|SERVICE_ROLE)/);
  assert.equal(extractMcpAuditInput({ method: "tools/list", params: {} }), null);
  assert.equal(extractMcpAuditInput({ method: "tools/call", params: { name: "bad;name" } }), null);
  assert.deepEqual(extractMcpAuditInput({ method: "tools/call", id: "abc", params: {
    name: "get_freight_options", arguments: { runId: "90000000-0000-0000-0000-000000000001", token: "secret" },
  } })?.inputPayload, { runId: "90000000-0000-0000-0000-000000000001" });
});

test("summarizes the real response without persisting arbitrary output", () => {
  const output = extractMcpAuditOutput({ result: { structuredContent: {
    ok: true, data: { status: "RUNNING", runId: "run", contactEmail: "secret@example.com" },
  } } });
  assert.deepEqual(output, { status: "success", outputPayload: { ok: true, status: "RUNNING", runId: "run" } });
  assert.deepEqual(extractMcpAuditOutput({ result: { isError: true, structuredContent: {
    ok: false, error: { code: "FORBIDDEN", message: "private diagnostic" },
  } } }), { status: "error", outputPayload: { ok: false, errorCode: "FORBIDDEN" } });
});
