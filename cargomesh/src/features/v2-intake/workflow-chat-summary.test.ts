import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkflowChatRecord } from "./workflow-chat-client";
import { summarizeWorkflow } from "./workflow-chat-summary";

test("empty commercial records never imply a quote, booking, or live tracking", () => {
  assert.match(summarizeWorkflow("offers", []), /not a quote/i);
  assert.match(summarizeWorkflow("bookings", []), /carrier must confirm/i);
  assert.match(summarizeWorkflow("executions", []), /cannot infer a live location/i);
});

test("shipper authorization remains distinct from carrier confirmation", () => {
  const booking = { kind: "bookings", id: "12345678-0000-4000-8000-000000000000", data: {
    authorizationStatus: "AUTHORIZED", carrierConfirmationStatus: "PENDING",
  } } as WorkflowChatRecord;
  const summary = summarizeWorkflow("bookings", [booking]);
  assert.match(summary, /shipper authorized, carrier pending/i);
  assert.doesNotMatch(summary, /confirmed booking/i);
});

test("withdrawn and expired offers are not presented as current", () => {
  const offer = { kind: "offers", data: { status: "RECEIVED", validity: { endsAt: "2020-01-01T00:00:00Z" } } } as WorkflowChatRecord;
  assert.match(summarizeWorkflow("offers", [offer]), /no current carrier-authored offer/i);
});

test("current offer summary includes issuer price, components, terms and version without booking claim", () => {
  const offer = { kind: "offers", data: { status: "RECEIVED", carrierReference: "CARRIER-17",
    validity: { endsAt: "2099-01-01T00:00:00Z" }, price: { amount: 425, currency: "USD" },
    breakdown: [{ kind: "TRANSPORT", treatment: "QUOTED", amount: { amount: 425 } }],
    commercialTerms: [{ description: "Dock appointment required" }], estimatedDeliveryAt: null, offerVersion: 2,
  } } as WorkflowChatRecord;
  const summary = summarizeWorkflow("offers", [offer]);
  assert.match(summary, /CARRIER-17: 425\.00 USD/);
  assert.match(summary, /transport 425\.00/);
  assert.match(summary, /Dock appointment required/);
  assert.match(summary, /offer version 2/);
  assert.match(summary, /cannot authorize a booking/);
});
