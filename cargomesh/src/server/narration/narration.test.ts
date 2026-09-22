import assert from "node:assert/strict";
import test from "node:test";
import { deterministicNarration } from "./deterministic";
import { narrateFreightResult } from "./bedrock";

const input = {
  locale: "es-PE" as const,
  result: "Existe una alternativa preliminar.",
  explanation: "La explicación ya fue calculada por el servicio de aplicación.",
  source: { kind: "TRANSPORT_PLAN" as const, status: "PRELIMINARY" as const, reference: "plan-1<&" },
  constraints: ["Permiso pendiente"],
  pendingFields: ["Capacidad por fecha"],
};

test("deterministic narration preserves facts, pending states and emits safe SSML", () => {
  const result = deterministicNarration(input);
  assert.equal(result.provider, "DETERMINISTIC");
  assert.match(result.text, /PRELIMINARY/);
  assert.match(result.text, /Permiso pendiente/);
  assert.match(result.text, /Capacidad por fecha/);
  assert.match(result.ssml, /plan-1&lt;&amp;/);
  assert.doesNotMatch(result.ssml, /<script/i);
});

test("disabled Bedrock uses deterministic fallback without invoking AWS", async () => {
  let calls = 0;
  const result = await narrateFreightResult(input, {
    configuration: () => ({ enabled: false, modelId: undefined, region: undefined }),
    invoke: async () => { calls++; throw new Error("must not run"); },
    now: () => 1,
  });
  assert.equal(calls, 0);
  assert.equal(result.provider, "DETERMINISTIC");
  assert.equal(result.evidenceStatus, "LOCAL");
});

test("enabled adapter records Bedrock response metadata without changing supplied facts", async () => {
  let clock = 100;
  const result = await narrateFreightResult(input, {
    configuration: () => ({ enabled: true, modelId: "test-model", region: "us-east-1" }),
    invoke: async (_region, _model, received) => {
      assert.deepEqual(received, input);
      clock = 145;
      return {
        output: { message: { role: "assistant", content: [{ text: "Narración de hechos <confirmados>." }] } },
        usage: { inputTokens: 40, outputTokens: 12, totalTokens: 52 },
        metrics: { latencyMs: 44 },
        stopReason: "end_turn",
        $metadata: { requestId: "request-1" },
      };
    },
    now: () => clock,
  });
  assert.equal(result.provider, "BEDROCK");
  assert.equal(result.evidenceStatus, "LIVE");
  assert.equal(result.telemetry.latencyMs, 45);
  assert.equal(result.telemetry.inputTokens, 40);
  assert.equal(result.telemetry.requestId, "request-1");
  assert.match(result.ssml, /&lt;confirmados&gt;/);
  assert.equal(result.telemetry.estimatedCostUsd, null);
});

test("missing configuration or invocation failure is explicitly blocked and falls back", async () => {
  const missing = await narrateFreightResult(input, {
    configuration: () => ({ enabled: true, modelId: undefined, region: "us-east-1" }),
    invoke: async () => { throw new Error("unused"); }, now: () => 1,
  });
  assert.equal(missing.evidenceStatus, "BLOCKED");
  assert.equal(missing.fallbackReason, "BEDROCK_CONFIGURATION_MISSING");
  const failed = await narrateFreightResult(input, {
    configuration: () => ({ enabled: true, modelId: "model", region: "us-east-1" }),
    invoke: async () => { throw new Error("denied"); }, now: () => 1,
  });
  assert.equal(failed.provider, "DETERMINISTIC");
  assert.equal(failed.evidenceStatus, "BLOCKED");
  assert.equal(failed.fallbackReason, "BEDROCK_INVOCATION_FAILED");
});
