import assert from "node:assert/strict";
import test from "node:test";

import { createBookFreightBridgeCallId } from "./bridge-call-id";

test("creates a stable bridge call ID for the initial provider result", () => {
  assert.equal(
    createBookFreightBridgeCallId("auth-123", { idempotentReplay: false }),
    "cm:booking:v1:auth-123:initial",
  );
  assert.equal(
    createBookFreightBridgeCallId("auth-123", { idempotentReplay: false }),
    "cm:booking:v1:auth-123:initial",
  );
});

test("uses a distinct stable bridge call ID for a provider replay", () => {
  const initial = createBookFreightBridgeCallId("auth-123", { idempotentReplay: false });
  const replay = createBookFreightBridgeCallId("auth-123", { idempotentReplay: true });

  assert.equal(replay, "cm:booking:v1:auth-123:provider-replay");
  assert.notEqual(replay, initial);
});

test("rejects an empty authorization reference", () => {
  assert.throws(
    () => createBookFreightBridgeCallId("   ", { idempotentReplay: false }),
    /authorizationReference is required/,
  );
});
