import assert from "node:assert/strict";
import test from "node:test";
import { workflowChatIntent } from "./workflow-chat-intent";

test("C-01: flexed booking questions read persisted bookings", () => {
  for (const question of ["is it booked?", "show reservations", "is it reserved?", "show booking status", "muestra mis reservas"]) {
    assert.equal(workflowChatIntent(question), "bookings", question);
  }
});

test("other read-only workflow questions remain distinct", () => {
  assert.equal(workflowChatIntent("show current offers"), "offers");
  assert.equal(workflowChatIntent("track my shipment"), "executions");
  assert.equal(workflowChatIntent("two pallets from Lima"), null);
});
