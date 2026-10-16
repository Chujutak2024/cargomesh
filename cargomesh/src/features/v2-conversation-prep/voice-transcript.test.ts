import assert from "node:assert/strict";
import test from "node:test";
import { applyVoiceTranscript } from "./voice-transcript";

test("Nova partial transcripts appear before the final block without duplicate turns", () => {
  const first = applyVoiceTranscript([], { role: "user", contentId: "u1", text: "I need ", final: false });
  const second = applyVoiceTranscript(first, { role: "user", contentId: "u1", text: "a truck", final: false });
  const final = applyVoiceTranscript(second, { role: "user", contentId: "u1", text: "I need a truck", final: true });
  assert.deepEqual(final, [{ speaker: "user", text: "I need a truck", contentId: "u1", provisional: false }]);
  const next = applyVoiceTranscript(final, { role: "assistant", contentId: "a1", text: "Sure", final: false });
  assert.equal(next.length, 2);
  assert.equal(next[1]?.provisional, true);
});
