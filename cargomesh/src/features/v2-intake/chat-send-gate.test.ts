import assert from "node:assert/strict";
import test from "node:test";
import { chatSendGate } from "./chat-send-gate";

test("C-02: a typed message during speech is rejected visibly and remains available to resend", () => {
  const text = "Is it booked?";
  assert.deepEqual(chatSendGate(text, false, true), {
    kind: "wait", notice: "Your message is still here. Stop audio, then send it again.",
  });
  assert.deepEqual(chatSendGate(text, false, false), { kind: "send", value: text });
});
