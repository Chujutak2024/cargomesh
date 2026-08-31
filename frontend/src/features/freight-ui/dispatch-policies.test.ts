import assert from "node:assert/strict";
import test from "node:test";

import {
  B02_OFFER_SELECTION_ENABLED,
  DISPATCH_FIXTURE_SCENARIOS,
  isRetryableOrchestrationError,
  resolveExplicitDispatchScenario,
  shouldPollOrchestration,
} from "./dispatch-policies";
import { getDispatchFixture } from "./ui-fixtures";

test("enables fixtures only through one of the seven explicit scenario values", () => {
  for (const scenario of DISPATCH_FIXTURE_SCENARIOS) {
    assert.equal(resolveExplicitDispatchScenario(scenario), scenario);
  }
  assert.equal(resolveExplicitDispatchScenario(undefined), null);
  assert.equal(resolveExplicitDispatchScenario(""), null);
  assert.equal(resolveExplicitDispatchScenario("invalid"), null);
});

test("polls only while the orchestration ViewModel is loading", () => {
  assert.equal(shouldPollOrchestration(getDispatchFixture("loading", "FR-1042")), true);
  assert.equal(shouldPollOrchestration(getDispatchFixture("evaluating", "FR-1042")), true);
  assert.equal(shouldPollOrchestration(getDispatchFixture("error", "FR-1042")), false);
  assert.equal(shouldPollOrchestration(getDispatchFixture("no-match", "FR-1042")), false);
  assert.equal(shouldPollOrchestration(getDispatchFixture("three", "FR-1042")), false);
});

test("offers retry only for a retryable error", () => {
  const retryable = getDispatchFixture("error", "FR-1042");
  assert.equal(isRetryableOrchestrationError(retryable), true);
  if (retryable.status !== "error") assert.fail("Expected the error fixture.");
  assert.equal(isRetryableOrchestrationError({
    ...retryable,
    error: { ...retryable.error, retryable: false },
  }), false);
  assert.equal(isRetryableOrchestrationError(getDispatchFixture("loading", "FR-1042")), false);
});

test("keeps 0, 1 and N offers independent from candidate attempts", () => {
  const noMatch = getDispatchFixture("no-match", "FR-1042");
  const one = getDispatchFixture("one", "FR-1042");
  const three = getDispatchFixture("three", "FR-1042");
  const four = getDispatchFixture("four", "FR-1042");

  assert.equal(noMatch.offers.length, 0);
  assert.equal(noMatch.attempts.length, 3);
  assert.equal(one.offers.length, 1);
  assert.equal(three.offers.length, 3);
  assert.equal(four.offers.length, 4);
  assert.equal(four.attempts.length, 4);
});

test("keeps offer selection disabled until B-03", () => {
  assert.equal(B02_OFFER_SELECTION_ENABLED, false);
});
