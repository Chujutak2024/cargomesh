import assert from "node:assert/strict";
import test from "node:test";
import { shouldRenewVoiceSession } from "./voice-session-renewal";

test("a timed-out active voice conversation renews without renewing idle or failed connections", () => {
  const now = 1_000_000;
  assert.equal(shouldRenewVoiceSession(now - 240_000, now - 15_000, now), true);
  assert.equal(shouldRenewVoiceSession(now - 240_000, now - 220_000, now), false);
  assert.equal(shouldRenewVoiceSession(now - 5_000, now - 2_000, now), false);
  assert.equal(shouldRenewVoiceSession(0, 0, now), false);
});
