import assert from "node:assert/strict";
import test from "node:test";
import { ConfirmedWorkflowServiceV2 } from "./confirmed-workflow-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";
const id = "c2340000-0000-4000-8000-000000000001";
const actor = { memberId: id, organizationId: id };
const context = { carrierId: id, requestId: null, parentId: null, id };
const value = { schemaVersion: "2.0", expectedVersion: 1, note: "confirm offer withdrawal",
  evidence: { reference: "fixture:confirm", provider: "Synthetic QA", observedAt: "2026-10-08T00:00:00Z",
    validUntil: "2030-01-01T00:00:00Z", provenanceStatus: "SIMULATED" } };
const proposal = { id, action: "offers.withdraw", context, proposedValue: value, payloadHash: "a".repeat(64),
  expiresAt: "2026-10-08T01:00:00Z", confirmationRequired: true };
test("prepared commercial proposal must retain exactly the reviewed payload and context", async () => {
  const service = new ConfirmedWorkflowServiceV2({ prepare: async () => proposal,
    confirm: async () => { throw new Error("preparation must not invoke a business mutation"); } });
  const input = { action: "offers.withdraw", context, value, idempotencyKey: id };
  assert.equal((await service.prepare(actor, input)).data.payloadHash, proposal.payloadHash);
  const changed = new ConfirmedWorkflowServiceV2({ prepare: async () => ({ ...proposal, proposedValue: { ...value, note: "different" } }),
    confirm: async () => { throw new Error("unexpected"); } });
  await assert.rejects(changed.prepare(actor, input), e => e instanceof V2DraftError && e.code === "FORBIDDEN_WORKFLOW");
});
test("confirmation rejects a false consent before calling its repository", async () => {
  let called = false;
  const service = new ConfirmedWorkflowServiceV2({ prepare: async () => proposal,
    confirm: async () => { called = true; throw new Error("unexpected"); } });
  await assert.rejects(service.confirm(actor, { confirmationId: id, confirmed: false }));
  assert.equal(called, false);
});
