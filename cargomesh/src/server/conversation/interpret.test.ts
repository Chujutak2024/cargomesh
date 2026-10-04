import assert from "node:assert/strict";
import test from "node:test";
import { conversationBedrockConfig, interpretConversationTurn } from "./interpret";

const input = { schemaVersion: "2.0" as const, text: "from Lima to Arequipa", currentField: "originFacilityId" as const };

test("disabled Bedrock uses deterministic extraction without an AWS call", async () => {
  const config = conversationBedrockConfig({});
  const result = await interpretConversationTurn(input, { config, invoke: async () => { throw new Error("should not invoke"); } });
  assert.equal(result.mode, "DETERMINISTIC");
  assert.equal(result.interpretation.fields.length, 2);
});

test("configuration bounds tokens and timeout and never embeds credentials", () => {
  const config = conversationBedrockConfig({ CARGOMESH_BEDROCK_CONVERSATION_ENABLED: "true", CARGOMESH_BEDROCK_REGION: "us-east-1", CARGOMESH_BEDROCK_MODEL_ID: "test-model", CARGOMESH_BEDROCK_CONVERSATION_MAX_TOKENS: "99999", CARGOMESH_BEDROCK_CONVERSATION_TIMEOUT_MS: "99999" });
  assert.equal(config.maxTokens, 300);
  assert.equal(config.timeoutMs, 6000);
  assert.equal("credentials" in config, false);
});

test("valid Bedrock proposal is Zod-validated and records bounded cost evidence", async () => {
  const config = conversationBedrockConfig({ CARGOMESH_BEDROCK_CONVERSATION_ENABLED: "true", CARGOMESH_BEDROCK_REGION: "us-east-1", CARGOMESH_BEDROCK_MODEL_ID: "test-model", CARGOMESH_BEDROCK_INPUT_USD_PER_MILLION_TOKENS: "1", CARGOMESH_BEDROCK_OUTPUT_USD_PER_MILLION_TOKENS: "2" });
  const result = await interpretConversationTurn(input, {
    config, now: () => 100,
    invoke: async () => ({
      output: { message: { role: "assistant", content: [{ text: JSON.stringify({ intent: "PROVIDE", fields: [{ field: "originFacilityId", value: "Lima" }], acknowledgment: "Got it." }) }] } },
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 }, stopReason: "end_turn", metrics: { latencyMs: 100 }, $metadata: {},
    }),
  });
  assert.equal(result.mode, "BEDROCK");
  assert.equal(result.telemetry?.estimatedCostUsd, 0.00014);
});

test("Nova fenced JSON with a field map is normalized then strictly validated", async () => {
  const config = conversationBedrockConfig({ CARGOMESH_BEDROCK_CONVERSATION_ENABLED: "true", CARGOMESH_BEDROCK_REGION: "us-east-1", CARGOMESH_BEDROCK_MODEL_ID: "test-model" });
  const result = await interpretConversationTurn(input, {
    config,
    invoke: async () => ({
      output: { message: { role: "assistant", content: [{ text: '```json\n{"intent":"PROVIDE","fields":{"originFacilityId":"Lima","destinationFacilityId":"Arequipa","unitQuantity":12},"acknowledgment":"Got it."}\n```' }] } },
      usage: { inputTokens: 222, outputTokens: 63, totalTokens: 285 }, stopReason: "end_turn", metrics: { latencyMs: 365 }, $metadata: {},
    }),
  });
  assert.equal(result.mode, "BEDROCK");
  assert.deepEqual(result.interpretation.fields, [
    { field: "originFacilityId", value: "Lima" },
    { field: "destinationFacilityId", value: "Arequipa" },
    { field: "unitQuantity", value: "12" },
  ]);
});

test("forced Nova tool proposal is data only and passes the versioned validator", async () => {
  const config = conversationBedrockConfig({ CARGOMESH_BEDROCK_CONVERSATION_ENABLED: "true", CARGOMESH_BEDROCK_REGION: "us-east-1", CARGOMESH_BEDROCK_MODEL_ID: "test-model" });
  const result = await interpretConversationTurn(input, {
    config,
    invoke: async () => ({
      output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "test", name: "propose_conversation_turn", input: { intent: "PROVIDE", fields: [{ field: "originFacilityId", value: "Lima" }] } } }] } },
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 }, stopReason: "tool_use", metrics: { latencyMs: 100 }, $metadata: {},
    }),
  });
  assert.equal(result.mode, "BEDROCK");
  assert.deepEqual(result.interpretation.fields, [{ field: "originFacilityId", value: "Lima" }]);
});

test("invalid model output and AWS failures fall back without logging user text", async () => {
  const config = conversationBedrockConfig({ CARGOMESH_BEDROCK_CONVERSATION_ENABLED: "true", CARGOMESH_BEDROCK_REGION: "us-east-1", CARGOMESH_BEDROCK_MODEL_ID: "test-model" });
  const invalid = await interpretConversationTurn(input, { config, invoke: async () => ({ output: { message: { role: "assistant", content: [{ text: '{"intent":"BOOKING","fields":[{"field":"organizationId","value":"forged"}]}' }] } }, usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }, stopReason: "end_turn", metrics: { latencyMs: 10 }, $metadata: {} }) });
  const failed = await interpretConversationTurn(input, { config, invoke: async () => { throw new Error("denied"); } });
  assert.equal(invalid.mode, "DETERMINISTIC");
  assert.equal(failed.mode, "DETERMINISTIC");
});
