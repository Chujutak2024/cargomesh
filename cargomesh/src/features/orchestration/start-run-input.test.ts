import assert from "node:assert/strict";
import test from "node:test";
import { OrchestrationError } from "./contracts";
import { parseStartOrchestrationRunInput } from "./start-run-input";

const REQUEST_ID = "f2000000-0000-0000-0000-000000000001";

test("accepts a UUID request and normalizes the idempotency key", () => {
  assert.deepEqual(
    parseStartOrchestrationRunInput({
      freightRequestId: REQUEST_ID,
      idempotencyKey: "  cm:int02a:start:fr-1042:1  ",
    }),
    { freightRequestId: REQUEST_ID, idempotencyKey: "cm:int02a:start:fr-1042:1" },
  );
});

test("rejects missing or malformed start-run input", () => {
  for (const input of [
    null,
    {},
    { freightRequestId: "FR-1042", idempotencyKey: "key" },
    { freightRequestId: REQUEST_ID, idempotencyKey: "   " },
    { freightRequestId: REQUEST_ID, idempotencyKey: "x".repeat(201) },
  ]) {
    assert.throws(
      () => parseStartOrchestrationRunInput(input),
      (error) => error instanceof OrchestrationError && error.code === "INVALID_ARGUMENT",
    );
  }
});
