import assert from "node:assert/strict";
import test from "node:test";
import { applyVoiceTranscript, recentVoiceContext, spokenUserDetails } from "./voice-transcript";

test("Nova partial transcripts appear before the final block without duplicate turns", () => {
  const first = applyVoiceTranscript([], { role: "user", contentId: "u1", text: "I need ", final: false });
  const second = applyVoiceTranscript(first, { role: "user", contentId: "u1", text: "a truck", final: false });
  const final = applyVoiceTranscript(second, { role: "user", contentId: "u1", text: "I need a truck", final: true });
  assert.deepEqual(final, [{ speaker: "user", text: "I need a truck", contentId: "u1", provisional: false }]);
  const next = applyVoiceTranscript(final, { role: "assistant", contentId: "a1", text: "Sure", final: false });
  assert.equal(next.length, 2);
  assert.equal(next[1]?.provisional, true);
});

test("spoken handoff keeps earlier details and later corrections, without claiming draft state", () => {
  const turns = [
    { speaker: "assistant" as const, text: "Hello" },
    { speaker: "user" as const, text: "from Lima to Piura", contentId: "nova:one:u1", provisional: false },
    { speaker: "user" as const, text: "sorry, Lima to Santiago Chile", contentId: "nova:one:u2", provisional: false },
    { speaker: "user" as const, text: "2000 kilograms; fragile", contentId: "nova:two:u1", provisional: false },
    { speaker: "user" as const, text: "partial", contentId: "nova:two:u2", provisional: true },
  ];
  assert.equal(spokenUserDetails(turns), "Lima to Santiago Chile; 2000 kilograms; fragile");
  assert.deepEqual(recentVoiceContext(turns), [
    "Customer: from Lima to Piura", "Customer: sorry, Lima to Santiago Chile", "Customer: 2000 kilograms; fragile",
  ]);
});

test("an in-turn correction does not prefill the rejected city", () => {
  assert.equal(spokenUserDetails([{ speaker: "user", contentId: "nova:one:u1", provisional: false,
    text: "from Lima to Piura no sorry sorry I need to go from Lima Peru to Santiago Chile" }]),
  "I need to go from Lima Peru to Santiago Chile");
});
