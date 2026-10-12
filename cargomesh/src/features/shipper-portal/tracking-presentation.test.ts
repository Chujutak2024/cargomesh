import assert from "node:assert/strict";
import test from "node:test";
import { buildTrackingJourney } from "./tracking-journey";
import { filterTrackingItems, matchesTrackingFilter, stageStateName, trackingStatus } from "./tracking-presentation";
import { trackingQaItem, trackingQaScenarios } from "./tracking-qa-fixtures";
import { loadTrackingItems } from "./tracking-read-model";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
const t = (_es: string, en: string) => en;

test("QA records conform to the current workflow schema", () => {
  for (const scenario of trackingQaScenarios) {
    const item = trackingQaItem(scenario);
    for (const record of [item.execution, item.booking, ...item.events, ...item.incidents].filter(Boolean)) {
      assert.equal(WorkflowRecordV2Schema.safeParse(record).success, true);
    }
  }
});
test("departure alone activates one physical milestone, never transit too", () => {
  const item = trackingQaItem("transit");
  item.events = item.events.filter((event) => event.data.action === "executions.start");
  item.execution.data.lastKnownPosition = null;
  const journey = buildTrackingJourney(item.execution, item.booking, item.events, []);
  assert.deepEqual(journey.stages.filter((stage) => stage.state === "current").map((stage) => stage.key), ["departure"]);
  assert.equal(journey.lastReportedStage, "departure");
});
test("open incidents count separately from resolved incidents and require attention", () => {
  const item = trackingQaItem("incidents");
  const journey = buildTrackingJourney(item.execution, item.booking, item.events, item.incidents);
  assert.equal(journey.openIncidents, 1);
  assert.equal(journey.criticalOpen, true);
  assert.equal(matchesTrackingFilter(item, "attention"), true);
  assert.equal(trackingStatus(item.execution, item.booking, item.events, item.incidents, t).label, "Needs attention");
});
test("resolved critical incidents do not keep transit blocked", () => {
  const item = trackingQaItem("resolved");
  const journey = buildTrackingJourney(item.execution, item.booking, item.events, item.incidents);
  assert.equal(journey.criticalOpen, false);
  assert.equal(journey.openIncidents, 0);
  assert.equal(matchesTrackingFilter(item, "attention"), false);
  assert.equal(journey.stages.find((stage) => stage.key === "transit")?.state, "current");
});
test("warning incidents require attention without asserting an operational block", () => {
  const item = trackingQaItem("incidents");
  item.incidents[0].data.severity = "WARNING";
  const journey = buildTrackingJourney(item.execution, item.booking, item.events, item.incidents);
  assert.equal(journey.criticalOpen, false);
  assert.equal(matchesTrackingFilter(item, "attention"), true);
});
test("delivery does not fabricate arrival, reception or pickup evidence", () => {
  const item = trackingQaItem("delivered");
  const journey = buildTrackingJourney(item.execution, item.booking, item.events, []);
  assert.equal(matchesTrackingFilter(item, "completed"), true);
  assert.equal(matchesTrackingFilter(item, "active"), false);
  assert.equal(journey.lastReportedStage, "delivery");
  for (const key of ["arrival", "reception", "pickup"]) assert.equal(journey.stages.find((stage) => stage.key === key)?.state, "unknown");
});
test("cancelled and rejected are attention outcomes, not completed journeys", () => {
  for (const scenario of ["cancelled", "rejected"] as const) {
    const item = trackingQaItem(scenario);
    assert.equal(matchesTrackingFilter(item, "attention"), true);
    assert.equal(matchesTrackingFilter(item, "active"), false);
    assert.equal(matchesTrackingFilter(item, "completed"), false);
    assert.equal(trackingStatus(item.execution, item.booking, item.events, [], t).tone, "blocked");
  }
});
test("unknown remains unverified; no event or position is generated", () => {
  const item = trackingQaItem("unknown");
  const journey = buildTrackingJourney(item.execution, null, [], []);
  assert.equal(journey.latestEvent, null);
  assert.equal(journey.latestPositionAt, null);
  assert.equal(journey.lastReportedStage, null);
  assert.equal(trackingStatus(item.execution, null, [], [], t).tone, "unknown");
  assert.equal(matchesTrackingFilter(item, "active"), false);
  assert.equal(stageStateName("unknown", t), "Unverified");
});
test("search ignores accents/case and matches route, reference and location", () => {
  const item = trackingQaItem("transit");
  item.corridor = "Líma → Arequipa";
  for (const query of ["LIMA", "AREQUIPA", "ui-qa-transit", "checkpoint"]) assert.equal(filterTrackingItems([item], query, "all", "recent").length, 1);
  assert.deepEqual(filterTrackingItems([item], "missing", "all", "recent"), []);
  assert.deepEqual(filterTrackingItems([], "", "all", "recent"), []);
});
test("sort uses latest report or incident update and does not mutate the input", () => {
  const first = trackingQaItem("initial"), second = trackingQaItem("delivered");
  const data = [first, second];
  assert.equal(filterTrackingItems(data, "", "all", "recent")[0].reference, second.reference);
  assert.equal(filterTrackingItems(data, "", "all", "oldest")[0].reference, first.reference);
  assert.equal(data[0], first);
});
test("list reads child evidence per execution and rejects foreign-request records", async () => {
  const item = trackingQaItem("incidents");
  const calls: string[] = [];
  const results = await loadTrackingItems([item.execution], [item.booking!], [], async (kind, options) => {
    calls.push(`${kind}:${options.parentId}`);
    return kind === "incidents" ? item.incidents : [item.events[0], { ...item.events[1], requestId: null }];
  });
  assert.deepEqual(calls.sort(), [`execution-events:${item.execution.id}`, `incidents:${item.execution.id}`]);
  assert.equal(results[0].incidents.length, 2);
  assert.equal(results[0].events.length, 1);
});
test("auth, network and contract read failures cannot become empty evidence", async () => {
  const item = trackingQaItem("initial");
  for (const error of ["401 UNAUTHORIZED", "403 FORBIDDEN", "NETWORK", "CONTRACT"]) {
    await assert.rejects(loadTrackingItems([item.execution], [], [], async () => { throw new Error(error); }), new RegExp(error));
  }
});
test("child reads have bounded concurrency", async () => {
  const items = Array.from({ length: 11 }, () => trackingQaItem("initial").execution);
  let pending = 0, max = 0;
  await loadTrackingItems(items, [], [], async () => {
    pending++; max = Math.max(max, pending);
    await new Promise<void>((resolve) => setImmediate(resolve));
    pending--; return [];
  });
  assert.equal(max, 10);
});
