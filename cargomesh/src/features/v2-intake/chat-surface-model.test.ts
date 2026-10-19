import assert from "node:assert/strict";
import test from "node:test";
import { clampFloatingPoint, keyboardFloatingPoint } from "./chat-surface-model";

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
