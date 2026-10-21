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

test("readiness uses its real backend read and mixed cargo questions retain capture", () => {
  assert.equal(workflowChatIntent("¿Qué me falta?"), "readiness");
  assert.equal(workflowChatIntent("what is missing?"), "readiness");
  assert.equal(workflowChatIntent("compare prices for 10 pallets from Lima to Arequipa"), null);
});
