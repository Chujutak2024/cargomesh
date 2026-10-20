import assert from "node:assert/strict";
import test from "node:test";
import { buildTrackingJourney, canShowConceptual3D, routeForExecution, type Booking, type Execution, type ExecutionEvent, type Incident, type Route } from "./tracking-journey";
import type { WorkflowRecordV2 } from "./shipper-model";

const requestId = "10000000-0000-4000-8000-000000000001";
const bookingId = "10000000-0000-4000-8000-000000000002";
const execution = { id: "10000000-0000-4000-8000-000000000003", requestId, organizationId:requestId,carrierId:bookingId,status: "CREATED",
  data: { bookingId, actualStartedAt: null, actualCompletedAt: null, lastKnownPosition: null } } as Execution;
const booking = { id: bookingId, requestId, organizationId:requestId,carrierId:bookingId,data: { decisionId: "10000000-0000-4000-8000-000000000004",
  carrierConfirmationStatus: "CONFIRMED", confirmedAt: "2026-10-11T10:00:00Z", authorizedAt: "2026-10-11T09:00:00Z" } } as Booking;
const event = (action: ExecutionEvent["data"]["action"], at: string) => ({ requestId, data: { action, at } }) as ExecutionEvent;
const stage = (journey: ReturnType<typeof buildTrackingJourney>, key: string) => journey.stages.find((item) => item.key === key)!.state;

test("initial execution distinguishes confirmed booking from unreported physical milestones", () => {
  const journey = buildTrackingJourney(execution, booking, [], []);
  assert.equal(stage(journey, "booking"), "completed");
  assert.equal(stage(journey, "pickup"), "unknown");
  assert.equal(stage(journey, "departure"), "future");
  assert.equal(stage(journey, "delivery"), "future");
  assert.equal(journey.lastReportedStage, "booking");
  assert.equal(journey.latestPositionAt, null);
});

test("start and position events advance only reported stages, never infer checkpoint or arrival", () => {
  const events = [event("executions.start", "2026-10-11T11:00:00Z"), event("executions.position", "2026-10-11T12:00:00Z")];
  const journey = buildTrackingJourney(execution, booking, events, []);
  assert.equal(stage(journey, "departure"), "completed");
  assert.equal(stage(journey, "transit"), "current");
  assert.equal(stage(journey, "checkpoint"), "unknown");
  assert.equal(stage(journey, "arrival"), "unknown");
  assert.equal(journey.positionReports, 1);
  assert.equal(journey.lastReportedStage, "transit");
});

test("delivery uses persisted completion while reception remains unknown", () => {
  const journey = buildTrackingJourney({ ...execution, status: "COMPLETED" }, booking, [], []);
  assert.equal(stage(journey, "delivery"), "completed");
  assert.equal(stage(journey, "departure"), "unknown");
  assert.equal(stage(journey, "transit"), "unknown");
  assert.equal(stage(journey, "reception"), "unknown");
  assert.equal(journey.lastReportedStage, "delivery");
});

test("open critical incident blocks transit review without inventing a delay or GPS", () => {
  const incident = { data: { status: "OPEN", severity: "CRITICAL" } } as Incident;
  const journey = buildTrackingJourney(execution, booking, [event("executions.start", "2026-10-11T11:00:00Z")], [incident]);
  assert.equal(stage(journey, "transit"), "blocked");
  assert.equal(journey.criticalOpen, true);
  assert.equal(journey.lastKnownPosition, null);
});

test("cancelled execution blocks future milestones", () => {
  const journey = buildTrackingJourney({ ...execution, status: "CANCELLED" }, booking, [], []);
  assert.equal(stage(journey, "departure"), "blocked");
  assert.equal(stage(journey, "delivery"), "blocked");
});

test("rejected booking is blocked and cannot be interpreted as an active shipment", () => {
  const rejected = { ...booking, data: { ...booking.data, carrierConfirmationStatus: "REJECTED" as const } };
  const journey = buildTrackingJourney(execution, rejected, [], []);
  assert.equal(journey.bookingBlocked, true);
  assert.equal(stage(journey, "booking"), "blocked");
  assert.equal(stage(journey, "departure"), "blocked");
});

test("route selection fails closed unless booking, decision, plan and route belong to the same request", () => {
  const decisionId = booking.data.decisionId;
  const planId = "10000000-0000-4000-8000-000000000005";
  const routeId = "10000000-0000-4000-8000-000000000006";
  const decision = { id: decisionId, requestId,organizationId:requestId, data: { selectedPlanId: planId } } as Extract<WorkflowRecordV2, { kind: "decisions" }>;
  const plan = { id: planId, requestId,organizationId:requestId, data: { routeId } } as Extract<WorkflowRecordV2, { kind: "plans" }>;
  const route = { id: routeId, requestId,organizationId:requestId, data: { confidence: "VERIFIED", legs: [{ mode: "ROAD" }] } } as Route;
  assert.equal(routeForExecution(execution, [booking], [decision], [plan], [route])?.id, routeId);
  assert.equal(routeForExecution(execution, [booking], [decision], [plan], [{ ...route, requestId: null }]), null);
  assert.equal(routeForExecution(execution, [booking], [decision], [plan], [{ ...route, organizationId:bookingId }]), null);
  assert.equal(routeForExecution(execution, [{...booking,carrierId:requestId}], [decision], [plan], [route]), null);
  assert.equal(routeForExecution(execution, [{ ...booking, data: { ...booking.data, carrierConfirmationStatus: "REJECTED" } }], [decision], [plan], [route]), null);
  assert.equal(canShowConceptual3D(route, true), true);
  assert.equal(canShowConceptual3D({ ...route, data: { ...route.data, legs: [{ ...route.data.legs[0], mode: "SEA" }] } }, true), false);
  assert.equal(canShowConceptual3D(route, false), false);
});
