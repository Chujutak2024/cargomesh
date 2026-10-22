import assert from "node:assert/strict";
import test from "node:test";
import { buildProposal } from "./build-proposals.mjs";
import { validateProposal, validateFiles } from "./validate-proposals.mjs";

test("all proposed files rebuild with matching hashes and use independent resources", () => {
  const result = validateFiles();
  assert.equal(result.result, "PASS");
  assert.equal(result.databasesTouched, 0);
  assert.equal(result.reports.length, 3);
});

test("D-03 oversized negative has the same-service positive fit control", () => {
  const result = validateProposal(buildProposal("D-03"));
  assert.equal(result.cases[0].status, "eligible");
  assert.equal(result.cases[1].status, "ineligible");
  assert.ok(result.cases[1].reasons.includes("UNIT_DIMENSIONS_EXCEEDED"));
});

test("D-04 blocked slot has a free-window positive control without a fake booking", () => {
  const result = validateProposal(buildProposal("D-04"));
  assert.equal(result.cases[0].status, "eligible");
  assert.equal(result.cases[1].status, "ineligible");
  assert.ok(result.cases[1].reasons.includes("CAPACITY_WINDOW_BLOCKED"));
});

test("activation flags, auto-confirm, unresolved references and fake progress are rejected with positive controls", () => {
  for (const mutate of [
    m => { m.activationAllowed = true; }, m => { m.approvals.carrierAdminApproved = true; },
    m => { m.operations.find(op => op.api === "quotePolicy").value.dispatch.autoConfirm = true; },
    m => { m.operations.find(op => op.scope.kind === "assets").value.serviceId.$ref = "C01.service"; },
    m => { m.cases[0].actualStartedAt = "2026-11-03T13:00:00Z"; },
    m => { m.cases[0].persistedOutcomes.push({ status: "COMPLETED" }); },
  ]) {
    const proposal = buildProposal("D-01");
    assert.equal(validateProposal(proposal).result, "PASS");
    mutate(proposal);
    assert.throws(() => validateProposal(proposal));
  }
});

test("a failing positive control blocks the negative; C01 overlap and expired evidence cannot pass", () => {
  for (const mutate of [
    m => { m.operations.find(op => op.scope.kind === "calendars").value.availableWindows = []; },
    m => { m.cases[0].operationWindow = m.scope.c01ForbiddenWindow; },
    m => { m.provenance.validUntil = "2026-11-03T13:00:00Z"; },
  ]) {
    const proposal = buildProposal("D-03");
    assert.equal(validateProposal(proposal).cases[0].status, "eligible");
    mutate(proposal);
    assert.throws(() => validateProposal(proposal));
  }
});
