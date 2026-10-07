import assert from "node:assert/strict";
import test from "node:test";
import { recognitionEndMessage, recognitionErrorMessage } from "./voice-status";

test("recognition errors explain permission, microphone, network and silence separately", () => {
  assert.match(recognitionErrorMessage("not-allowed"), /permission was denied/);
  assert.match(recognitionErrorMessage("audio-capture"), /No working microphone/);
  assert.match(recognitionErrorMessage("network"), /could not connect/);
  assert.match(recognitionErrorMessage("no-speech"), /did not hear speech/);
});

test("unexpected disconnect never claims that a transcript was captured", () => {
  assert.match(recognitionEndMessage(false), /without a transcript/);
  assert.match(recognitionEndMessage(true), /Review or edit the transcript/);
});
