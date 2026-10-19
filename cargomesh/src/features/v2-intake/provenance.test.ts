import assert from "node:assert/strict";
import test from "node:test";

import { formatProvenanceTimestamp, isProvenanceExpiredAtEvaluation } from "./provenance";

test("null or malformed observedAt remains UNKNOWN", () => {
  assert.equal(formatProvenanceTimestamp(null), "UNKNOWN");
  assert.equal(formatProvenanceTimestamp("not-a-date"), "UNKNOWN");
});

test("a valid observedAt remains visible as a timestamp", () => {
  assert.notEqual(formatProvenanceTimestamp("2026-09-28T02:00:00Z", "en-US"), "UNKNOWN");
});

test("expired capacity provenance is flagged without changing the service's eligibility", () => {
  assert.equal(isProvenanceExpiredAtEvaluation("2026-10-09T19:00:00Z", "2026-10-11T11:53:36Z"), true);
  assert.equal(isProvenanceExpiredAtEvaluation("2026-10-12T19:00:00Z", "2026-10-11T11:53:36Z"), false);
  assert.equal(isProvenanceExpiredAtEvaluation(null, "2026-10-11T11:53:36Z"), false);
  assert.equal(isProvenanceExpiredAtEvaluation("bad-date", "2026-10-11T11:53:36Z"), false);
});
