import test from "node:test";
import assert from "node:assert/strict";
import { initialDemoRequests } from "./local-request-demo";
import { localRequestReference, localRequestState, localRequestStateLabel } from "./local-request-presentation";

test("presentation references retain the stable route and storage identity", () => {
  assert.equal(localRequestReference("CM-LOCAL-01"), "SOL-0001");
  assert.equal(localRequestReference("CM-DEMO-06"), "SOL-0006");
  assert.equal(localRequestReference("api-request-42"), "api-request-42");
  assert.equal(localRequestReference("CM-DEMO-08"), "CM-DEMO-08");
});

test("review labels distinguish unstarted, started and explicitly reviewed requests", () => {
  const draft = initialDemoRequests()[0].record.draft;
  assert.equal(localRequestState({ ...draft, completedStep: 0, savedForReview: false }), "draft");
  assert.equal(localRequestStateLabel({ ...draft, completedStep: 0, savedForReview: false }, "es"), "Pendiente de revisión");
  assert.equal(localRequestStateLabel({ ...draft, completedStep: 1, savedForReview: false }, "es"), "En revisión");
  assert.equal(localRequestState({ ...draft, completedStep: 5, savedForReview: false }), "review");
  assert.equal(localRequestStateLabel({ ...draft, completedStep: 5, savedForReview: true }, "es"), "Revisada");
  assert.equal(localRequestStateLabel({ ...draft, completedStep: 1, savedForReview: false }, "en"), "In review");
});
