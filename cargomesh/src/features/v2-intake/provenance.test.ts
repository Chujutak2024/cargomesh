import assert from "node:assert/strict";
import test from "node:test";

import { formatProvenanceTimestamp } from "./provenance";

test("null or malformed observedAt remains UNKNOWN", () => {
  assert.equal(formatProvenanceTimestamp(null), "UNKNOWN");
  assert.equal(formatProvenanceTimestamp("not-a-date"), "UNKNOWN");
});

test("a valid observedAt remains visible as a timestamp", () => {
  assert.notEqual(formatProvenanceTimestamp("2026-09-28T02:00:00Z", "en-US"), "UNKNOWN");
});
