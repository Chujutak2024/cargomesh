import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { useReducedMotionPreference, useScenePlayback } from "./use-motion-preference";

test("SSR motion markup stays identical without window and with either client preference", () => {
  function Probe() {
    const reduced = useReducedMotionPreference();
    return React.createElement("div", { "data-reduced": String(reduced) });
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    const html = renderToString(React.createElement(Probe));
    assert.match(html, /data-reduced="true"/);
    for (const matches of [false, true]) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches }) } });
      assert.equal(renderToString(React.createElement(Probe)), html);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("scene server snapshot starts paused until preference or explicit choice is resolved", () => {
  function Probe() {
    const { playing } = useScenePlayback();
    return React.createElement("button", { "aria-pressed": playing });
  }
  assert.match(renderToString(React.createElement(Probe)), /aria-pressed="false"/);
});
