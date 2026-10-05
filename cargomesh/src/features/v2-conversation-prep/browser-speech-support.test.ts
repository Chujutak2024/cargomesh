import assert from "node:assert/strict";
import test from "node:test";
import { resolveBrowserSpeechSupport } from "./browser-speech-support";

test("a constructor alone does not falsely enable Brave speech recognition", () => {
  const support = resolveBrowserSpeechSupport({ hasRecognition: true, isBrave: true, localAvailability: "downloading" });
  assert.equal(support.mode, "unsupported");
  assert.match(support.message, /microphone may work in other services/);
});

test("Brave with an available local English engine and other supported browsers can dictate", () => {
  assert.equal(resolveBrowserSpeechSupport({ hasRecognition: true, isBrave: true, localAvailability: "available" }).mode, "local");
  assert.equal(resolveBrowserSpeechSupport({ hasRecognition: true, isBrave: false }).mode, "remote");
  assert.equal(resolveBrowserSpeechSupport({ hasRecognition: false, isBrave: false }).mode, "unsupported");
});
