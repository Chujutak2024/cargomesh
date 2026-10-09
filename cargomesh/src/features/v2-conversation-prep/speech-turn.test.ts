import assert from "node:assert/strict";
import test from "node:test";
import { createSpeechTurnDetector } from "./speech-turn";

test("a pause sends the latest transcript once, and browser end cannot duplicate it", () => {
  const sent: string[] = [];
  const scheduled = new Map<number, () => void>();
  let next = 0;
  const clock = {
    schedule(callback: () => void) { const id = ++next; scheduled.set(id, callback); return id as unknown as ReturnType<typeof setTimeout>; },
    clear(timer: ReturnType<typeof setTimeout>) { scheduled.delete(timer as unknown as number); },
  };
  const detector = createSpeechTurnDetector((text) => sent.push(text), 1400, clock);
  detector.update("I need 12");
  detector.update("I need 12 boxes");
  assert.equal(scheduled.size, 1);
  scheduled.values().next().value?.();
  detector.finish();
  assert.deepEqual(sent, ["I need 12 boxes"]);
});

test("manual stop prevents auto-send; silence without speech sends nothing", () => {
  const sent: string[] = [];
  const pending: Array<() => void> = [];
  const clock = {
    schedule(callback: () => void) { pending.push(callback); return 1 as unknown as ReturnType<typeof setTimeout>; },
    clear() { pending.length = 0; },
  };
  const detector = createSpeechTurnDetector((text) => sent.push(text), 1400, clock);
  detector.finish();
  detector.update("editable transcript");
  const lateCallback = pending[0];
  detector.cancel();
  lateCallback?.();
  detector.finish();
  assert.deepEqual(sent, []);
});

test("the default browser clock can schedule and cancel a voice turn", async () => {
  const sent: string[] = [];
  const detector = createSpeechTurnDetector((text) => sent.push(text), 1);
  detector.update("English voice transcript");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(sent, ["English voice transcript"]);
});
