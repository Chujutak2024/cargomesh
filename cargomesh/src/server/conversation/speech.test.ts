import assert from "node:assert/strict";
import test from "node:test";
import { speechVoice } from "./speech";

test("speech chooses a documented Latin American Spanish voice for es-PE and English for en-US", () => {
  assert.deepEqual(speechVoice("es-PE"), { voiceId: "Mia", languageCode: "es-MX" });
  assert.deepEqual(speechVoice("en-US"), { voiceId: "Joanna", languageCode: "en-US" });
});
