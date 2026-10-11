import assert from "node:assert/strict";
import test from "node:test";
import { routeRecordToPresentation } from "./tracking-model";

test("missing route never produces geometry", () => {
  const presentation = routeRecordToPresentation(null);
  assert.deepEqual(presentation.paths, []);
  assert.equal(presentation.provenanceStatus, "UNKNOWN");
});

