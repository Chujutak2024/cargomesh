import { test } from "node:test";
import assert from "node:assert/strict";
import { initialDemoRequests, USER_REQUEST_ID } from "./local-request-demo";
import { journeySnapshot, journeyTime } from "./journey-model";
test("seven requests have distinct progress and near-arrival/mid-route scenarios", () => {
  const ids = [USER_REQUEST_ID, ...initialDemoRequests().map(entry => entry.id)];
  const positions = ids.map(id => journeySnapshot(id));
  assert.equal(new Set(positions.map(position => position.progress)).size, 7);
  assert.ok(positions.some(position => position.progress > .9));
  assert.ok(positions.some(position => position.progress > .4 && position.progress < .6));
  assert.ok(positions.some(position => position.progress < .2));
});
test("visual movement is bounded and cancellation holds position", () => {
  assert.ok(journeySnapshot(USER_REQUEST_ID, 10).progress > journeySnapshot(USER_REQUEST_ID).progress);
  assert.equal(journeySnapshot(USER_REQUEST_ID, 900, true).progress, journeySnapshot(USER_REQUEST_ID).progress);
  assert.equal(journeySnapshot(USER_REQUEST_ID, 1e9).progress, .995);
  assert.equal(journeyTime(24 * 60 + 18), "00:18");
});
test("calculating visual state does not mutate request records", () => {
  const entries = initialDemoRequests(), before = JSON.stringify(entries);
  entries.forEach(entry => journeySnapshot(entry.id, 10));
  assert.equal(JSON.stringify(entries), before);
});
