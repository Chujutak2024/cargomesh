import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyEvidenceState,
  classifyProviderOrigin,
  readCleanupState,
} from "./judge-evidence-presentation";

test("evidence distinguishes pending, commercial outcomes and technical errors", () => {
  assert.equal(classifyEvidenceState({ status: "RUNNING" }), "pending");
  assert.equal(classifyEvidenceState({ status: "SUCCEEDED", toolName: "check_service_coverage", outputPayload: { ok: true, data: { supported: true } } }), "commercial-success");
  assert.equal(classifyEvidenceState({ status: "SUCCEEDED", outputPayload: { ok: true, data: { available: false } } }), "commercial-rejection");
  assert.equal(classifyEvidenceState({ status: "FAILED", outputPayload: { ok: false } }), "technical-error");
  assert.equal(classifyEvidenceState({ status: "SUCCEEDED", eventType: "RUN_COMPLETED" }), "recorded");
});

test("provider routes are classified without presenting same-origin demos as external", () => {
  const cargoMeshOrigin = "https://cargomesh.vercel.app";
  assert.equal(classifyProviderOrigin("/providers/andes", cargoMeshOrigin), "cargomesh-origin");
  assert.equal(classifyProviderOrigin("https://cargomesh.vercel.app/providers/inca", cargoMeshOrigin), "cargomesh-origin");
  assert.equal(classifyProviderOrigin("https://provider.example/tools", cargoMeshOrigin), "registered-external");
  assert.equal(classifyProviderOrigin("https://user:pass@provider.example/tools", cargoMeshOrigin), "unknown");
});

test("cleanup is shown only when the persisted payload reports it", () => {
  assert.equal(readCleanupState({ outputPayload: { cleanupToolNames: [] } }), "verified");
  assert.equal(readCleanupState({ outputPayload: { data: { activeToolNames: ["quote_freight"] } } }), "remaining-tools");
  assert.equal(readCleanupState({ outputPayload: { ok: true } }), "not-reported");
});
