import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createMcpHttpHandler } from "./http";
import { creationInput } from "./creation-test-fixture";
import { CreateFreightRequestInputSchema } from "@/shared/schemas/freight-creation";
import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";
import type { CreateFreightRequest } from "./tools/create-freight-request";

test("Alexa+ example is exactly valid create_freight_request tool arguments", () => {
  const file = new URL("../../../../docs/architecture-v2/alexa-sample-request-payload.json", import.meta.url);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(CreateFreightRequestInputSchema.parse(raw), raw);
});

function harness(create: CreateFreightRequest, authError?: Error) {
  const handle = createMcpHttpHandler({
    authenticate: async () => { if (authError) throw authError; },
    configuration: () => ({ enabled: true, environment: "test" }),
    read: async () => { throw new Error("unexpected read"); }, create,
  });
  return (input: unknown) => handle(new Request("http://localhost:3000/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_freight_request", arguments: input } }),
  }));
}
test("MCP forwards validated explicit fields to the service and strips private output", async () => {
  let calls = 0;
  const call = harness(async (input) => {
    calls++; assert.deepEqual(input, creationInput());
    return { freightRequestId: crypto.randomUUID(), requestCode: "FR-5500", status: "DRAFT", draftVersion: 1, replayed: false, secret: "hidden" };
  });
  const body = await (await call(creationInput())).json();
  assert.equal(body.result.structuredContent.ok, true);
  assert.equal(body.result.structuredContent.data.status, "DRAFT");
  assert.equal(JSON.stringify(body).includes("hidden"), false); assert.equal(calls, 1);
});
test("missing fields, unsupported modes and caller identity never reach creation", async () => {
  const call = harness(async () => { assert.fail("must not call creation"); });
  for (const input of [{}, { fields: {} }, { ...creationInput(), organizationId: crypto.randomUUID() },
    { ...creationInput(), fields: { ...creationInput().fields, cargoEntryMethod: "TOTAL_WEIGHT" } },
    { ...creationInput(), fields: { ...creationInput().fields, status: "BOOKED" } }]) {
    const body = await (await call(input)).json(); assert.equal(body.result.isError, true);
  }
});
test("anonymous requests cannot create", async () => {
  const call = harness(async () => { assert.fail("must not create"); }, new Error("UNAUTHENTICATED: private"));
  assert.equal((await call(creationInput())).status, 401);
});
test("creation errors are actionable but never expose database/provider diagnostics", async () => {
  for (const code of ["FORBIDDEN", "IDEMPOTENCY_CONFLICT", "INVALID_DRAFT", "DRAFT_CREATION_UNAVAILABLE"]) {
    const call = harness(async () => { throw new RecommendationDraftError(code, "secret database details", 500); });
    const body = await (await call(creationInput())).json();
    assert.equal(body.result.isError, true); assert.equal(body.result.structuredContent.error.code, code);
    assert.equal(JSON.stringify(body).includes("secret database"), false);
  }
});
