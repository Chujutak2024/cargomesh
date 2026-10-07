import assert from "node:assert/strict";
import test from "node:test";
import type { McpPrincipal } from "../../server/mcp/auth/principal";
import { createPreparatoryMcpChannel, type ConversationApplicationPort } from "./mcp-channel";

const id = "123e4567-e89b-42d3-a456-426614174000";
const principal: McpPrincipal = { kind: "user", authMethod: "supabase_oauth",
  scopes: ["mcp:tools"], userId: id, userEmail: "test@example.invalid", memberId: id,
  organizationId: id, role: "REQUESTER", status: "ACTIVE", oauthClientId: "test-client" };

test("MCP port calls the shared application service directly with request actor", async () => {
  let calls = 0;
  const application: ConversationApplicationPort<{ shipment: string }, { id: string }, { status: string; source: string }> = {
    async createDraft(input) {
      calls++;
      assert.equal(input.actor.organizationId, id);
      assert.equal(input.idempotencyKey, id);
      return { id };
    },
    async readDraft(input) {
      calls++;
      assert.equal(input.actor.memberId, id);
      assert.equal(input.requestId, id);
      return { id };
    },
    async evaluateRoad(input) {
      calls++;
      assert.equal(input.expectedDraftVersion, 2);
      assert.equal(input.actor.userId, id);
      return { status: "unknown", source: "HAC-12" };
    },
  };
  const channel = createPreparatoryMcpChannel(principal, application);
  assert.deepEqual(await channel.createDraft({ shipment: "ROAD" }, id), { id });
  assert.deepEqual(await channel.readDraft(id), { id });
  assert.deepEqual(await channel.evaluateRoad(id, 2), { status: "unknown", source: "HAC-12" });
  assert.equal(calls, 3);
});

test("MCP port rejects service principal and inactive membership before domain call", async () => {
  let called = false;
  const application: ConversationApplicationPort<unknown, unknown, unknown> = {
    async createDraft() { called = true; return null; },
    async readDraft() { called = true; return null; },
    async evaluateRoad() { called = true; return null; },
  };
  const service: McpPrincipal = { kind: "service", clientId: "test-client", scopes: ["mcp:service"],
    tokenId: id, issuedAt: 1, expiresAt: 2 };
  assert.throws(() => createPreparatoryMcpChannel(service, application).readDraft(id), /FORBIDDEN/);
  assert.throws(() => createPreparatoryMcpChannel({ ...principal, status: "REVOKED" }, application).readDraft(id), /FORBIDDEN/);
  assert.equal(called, false);
});
