import test from "node:test";
import assert from "node:assert/strict";
import { landRoutePolicy } from "@/features/v2-workspace/road-locations";
import { changeLocalDraft, localMapPresentation } from "./local-draft-model";
import { initialDemoRequests, readDemoRequests, serializeDemoRequests, updateDemoRequest, USER_REQUEST_ID } from "./local-request-demo";

test("six distinct local examples use connected land routes without invented geometry or API identities", () => {
  const records = initialDemoRequests();
  assert.equal(records.length, 6); assert.equal(new Set(records.map(entry => entry.id)).size, 6);
  for (const entry of records) {
    assert.equal(entry.example, true);
    assert.equal(landRoutePolicy(entry.record.draft.originId, entry.record.draft.destinationId), "previewable");
    assert.deepEqual(localMapPresentation(entry.record.draft, null).paths, []);
    assert.equal("draftVersion" in entry.record.draft, false);
  }
});
test("an example edit survives serialization and cannot alter a sibling or the original draft storage", () => {
  const initial = initialDemoRequests(), immutable = JSON.stringify(initial);
  const next = updateDemoRequest(initial, initial[0].id, current => changeLocalDraft(current, { quantity: 19 }, "2026-10-08T16:00:00.000Z"));
  assert.equal(JSON.stringify(initial), immutable);
  assert.equal(next[0].record.draft.quantity, 19); assert.equal(next[0].record.draft.completedStep, 2);
  assert.equal(next[0].record.originalRaw, initial[0].record.originalRaw);
  assert.deepEqual(next.slice(1), initial.slice(1));
  assert.deepEqual(readDemoRequests(serializeDemoRequests(next)), next);
  assert.throws(() => updateDemoRequest(initial, USER_REQUEST_ID, initial[0].record));
  assert.throws(() => updateDemoRequest(initial, "not-an-example", initial[0].record));
});
test("unrecognized or malformed stored collections fail instead of being presented as the user's draft", () => {
  const records = initialDemoRequests();
  assert.throws(() => readDemoRequests("{}"));
  assert.throws(() => readDemoRequests(serializeDemoRequests(records.slice(1))));
  assert.throws(() => readDemoRequests(serializeDemoRequests([{ ...records[0], id: USER_REQUEST_ID }, ...records.slice(1)])));
});
