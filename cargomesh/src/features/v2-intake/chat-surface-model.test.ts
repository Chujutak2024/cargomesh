import assert from "node:assert/strict";
import test from "node:test";
import { ASSISTANT_INTRO_TIMING, assistantWelcomeMotion, assistantEyeOffset, clampFloatingPoint, keyboardFloatingPoint } from "./chat-surface-model";

test("the welcome rises in order: mascot, heading, then the first greeting", () => {
  const stages = (["mascot", "title", "greeting"] as const).map(stage => assistantWelcomeMotion(stage, false));
  for (const stage of stages) {
    assert.notEqual(stage.initial, false);
    if (stage.initial !== false) { assert.equal(stage.initial.opacity, 0); assert.ok(stage.initial.y >= 24); }
    assert.deepEqual(stage.animate, { opacity: 1, y: 0 });
    assert.ok(stage.transition.duration > .5);
  }
  assert.ok(stages[0].transition.delay < stages[1].transition.delay);
  assert.ok(stages[1].transition.delay < stages[2].transition.delay);
});

test("reduced motion shows every welcome block immediately without a hidden or displaced state", () => {
  for (const stage of ["mascot", "title", "greeting"] as const) {
    const motion = assistantWelcomeMotion(stage, true);
    assert.equal(motion.initial, false);
    assert.deepEqual(motion.animate, { opacity: 1, y: 0 });
    assert.equal(motion.transition.duration, 0);
    assert.equal(motion.transition.delay, 0);
  }
});

test("the introduction leaves time for the one-shot hop and a still greeting, but has a finite deadline", () => {
  assert.ok(ASSISTANT_INTRO_TIMING.minimumMs >= 1800);
  assert.ok(ASSISTANT_INTRO_TIMING.deadlineMs > ASSISTANT_INTRO_TIMING.minimumMs);
  assert.ok(ASSISTANT_INTRO_TIMING.deadlineMs <= 3500);
});

test("the assistant looks toward the pointer without letting its eyes escape the face", () => {
  assert.deepEqual(assistantEyeOffset({ x: 100, y: 100 }, { x: 100, y: 100 }), { x: 0, y: 0 });
  const right = assistantEyeOffset({ x: 10000, y: 10000 }, { x: 0, y: 0 });
  assert.ok(right.x > 0 && right.x <= 3.5 && right.y > 0 && right.y <= 2.5);
  const left = assistantEyeOffset({ x: -10000, y: -10000 }, { x: 0, y: 0 });
  assert.ok(left.x < 0 && left.x >= -3.5 && left.y < 0 && left.y >= -2.5);
  assert.deepEqual(assistantEyeOffset({ x: NaN, y: Infinity }, { x: 0, y: 0 }), { x: 0, y: 0 });
});

test("dragging past any viewport edge keeps the assistant reachable", () => {
  const bounds = { width: 280, height: 56, viewportWidth: 1440, viewportHeight: 900 };
  assert.deepEqual(clampFloatingPoint({ x: -100, y: -50 }, bounds), { x: 12, y: 12 });
  assert.deepEqual(clampFloatingPoint({ x: 1600, y: 1000 }, bounds), { x: 1148, y: 832 });
});

test("expanding or resizing to mobile clamps the moved composer into the new viewport", () => {
  assert.deepEqual(clampFloatingPoint({ x: 1100, y: 800 }, { width: 326, height: 56, viewportWidth: 390, viewportHeight: 400 }), { x: 52, y: 332 });
});

test("keyboard dragging supports precise movement, larger steps and boundary recovery", () => {
  const bounds = { width: 280, height: 56, viewportWidth: 390, viewportHeight: 844 };
  assert.deepEqual(keyboardFloatingPoint({ x: 20, y: 40 }, "ArrowRight", bounds), { x: 36, y: 40 });
  assert.deepEqual(keyboardFloatingPoint({ x: 20, y: 40 }, "ArrowRight", bounds, true), { x: 68, y: 40 });
  assert.deepEqual(keyboardFloatingPoint({ x: 20, y: 40 }, "ArrowLeft", bounds, true), { x: 12, y: 40 });
  assert.equal(keyboardFloatingPoint({ x: 20, y: 40 }, "Enter", bounds), null);
});
