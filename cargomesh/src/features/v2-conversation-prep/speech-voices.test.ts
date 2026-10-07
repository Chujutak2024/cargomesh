import assert from "node:assert/strict";
import test from "node:test";
import { chosenSpeechVoice, voicesForLanguage } from "./speech-voices";

const voices = [
  { voiceURI: "remote-us", name: "Remote Spanish", lang: "es-US", localService: false },
  { voiceURI: "local-mx", name: "Natural MX", lang: "es-MX", localService: true },
  { voiceURI: "local-en", name: "English", lang: "en-US", localService: true },
];

test("Spanish output never selects an English voice and prefers a local natural voice", () => {
  assert.deepEqual(voicesForLanguage(voices, "es-PE").map((voice) => voice.voiceURI), ["local-mx", "remote-us"]);
  assert.equal(chosenSpeechVoice(voices, "es-PE", "local-en")?.voiceURI, "local-mx");
});

test("an explicit supported voice choice wins over the default", () => {
  assert.equal(chosenSpeechVoice(voices, "es-PE", "remote-us")?.voiceURI, "remote-us");
  assert.equal(chosenSpeechVoice([], "en-US", "") , null);
});
