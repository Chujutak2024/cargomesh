import test from "node:test";
import assert from "node:assert/strict";
import { landRoutePolicy } from "@/features/v2-workspace/road-locations";
import { changeLocalDraft, localMapPresentation, importLocalDraft } from "./local-draft-model";
import { initialDemoRequests, readDemoRequests, resolveWorkspaceDraft, serializeDemoRequests, updateDemoRequest, USER_REQUEST_ID } from "./local-request-demo";

const now = "2026-10-11T15:00:00.000Z";
test("a fresh coordinator has the same seven requests and cargo totals on any supported browser origin", () => {
  for (const origin of ["http://127.0.0.1:8080", "http://127.0.0.1:3907", "http://localhost:3090", "https://portal.vercel.app"]) {
    const primary = resolveWorkspaceDraft(null, null, origin, now);
    const others = readDemoRequests(null, origin);
    assert.equal(1 + others.length, 7);
    assert.equal(primary.draft.originId, "callao");
    assert.equal(primary.draft.destinationId, "piura");
    assert.equal(primary.sourceOrigin, origin);
    assert.equal(primary.draft.quantity * primary.draft.unitWeightKg
      + others.reduce((total, entry) => total + entry.record.draft.quantity * entry.record.draft.unitWeightKg, 0), 74600);
    const mexico = others.find(entry => entry.id === "CM-DEMO-04")!;
    assert.equal(mexico.record.draft.completedStep, 4);
    assert.equal(mexico.record.draft.truckPreference?.type, "flatbed");
    assert.equal(mexico.record.draft.quantity * mexico.record.draft.unitWeightKg, 18000);
    assert.deepEqual(readDemoRequests(serializeDemoRequests(others), origin), others);
    assert.equal("draftVersion" in primary.draft, false);
  }
});

test("portable initialization preserves saved edits, photos, review progress and the immutable original", () => {
  const original = resolveWorkspaceDraft(null, null, "http://127.0.0.1:8080", now);
  const edited = changeLocalDraft(original, { cargoDescription: "Carga editada", quantity: 27,
    truckPreference: { type: "custom", model: "Camión personal", photoDataUrl: "data:image/png;base64,YWJj" } }, now);
  const saved = { ...edited, draft: { ...edited.draft, completedStep: 5, savedForReview: true } };
  assert.deepEqual(resolveWorkspaceDraft(JSON.stringify(saved), "invalid legacy data", "http://127.0.0.1:3907", now), saved);
  assert.equal(saved.originalRaw, original.originalRaw);
  const legacy = JSON.stringify(saved.draft);
  assert.deepEqual(resolveWorkspaceDraft(null, legacy, "http://localhost:3090", now),
    importLocalDraft(legacy, "http://localhost:3090", now));
});

test("damaged browser records cannot be replaced by fresh coordinator defaults", () => {
  for (const raw of ["", "{", "{}", "null"]) {
    assert.throws(() => resolveWorkspaceDraft(raw, null, "http://127.0.0.1:3907", now));
    assert.throws(() => resolveWorkspaceDraft(null, raw, "http://127.0.0.1:3907", now));
    assert.throws(() => readDemoRequests(raw, "http://127.0.0.1:3907"));
  }
});

test("portable provenance accepts HTTP origins without widening the transfer allowlist", () => {
  for (const origin of ["file:///tmp", "javascript:alert(1)", "https://portal.vercel.app/path", "https://user:password@portal.vercel.app", "https://portal.vercel.app/"]) {
    assert.throws(() => resolveWorkspaceDraft(null, null, origin, now));
  }
});

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
