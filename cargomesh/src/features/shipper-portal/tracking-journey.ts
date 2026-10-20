import type { WorkflowRecordV2 } from "./shipper-model";

export type Execution = Extract<WorkflowRecordV2, { kind: "executions" }>;
export type ExecutionEvent = Extract<WorkflowRecordV2, { kind: "execution-events" }>;
export type Incident = Extract<WorkflowRecordV2, { kind: "incidents" }>;
export type Booking = Extract<WorkflowRecordV2, { kind: "bookings" }>;
type Decision = Extract<WorkflowRecordV2, { kind: "decisions" }>;
type Plan = Extract<WorkflowRecordV2, { kind: "plans" }>;
export type Route = Extract<WorkflowRecordV2, { kind: "routes" }>;

export type JourneyStageKey = "booking" | "preparation" | "pickup" | "departure" | "transit" | "checkpoint" | "arrival" | "reception" | "delivery";
export type JourneyStageState = "completed" | "current" | "future" | "unknown" | "blocked";
export type JourneyStage = { key: JourneyStageKey; state: JourneyStageState; at: string | null; evidence: "booking" | "execution" | "event" | "none" };

const stageKeys: JourneyStageKey[] = ["booking", "preparation", "pickup", "departure", "transit", "checkpoint", "arrival", "reception", "delivery"];

/** Only persisted transitions advance the UI. Unmodeled physical milestones stay unknown. */
export function buildTrackingJourney(execution: Execution, booking: Booking | null, events: ExecutionEvent[], incidents: Incident[]) {
  const action = (name: ExecutionEvent["data"]["action"]) => events.filter((event) => event.data.action === name)
    .sort((a, b) => Date.parse(b.data.at) - Date.parse(a.data.at))[0] ?? null;
  const started = action("executions.start");
  const positioned = action("executions.position");
  const hasReportedPosition = Boolean(positioned || execution.data.lastKnownPosition);
  const hasReportedStart = Boolean(started || execution.data.actualStartedAt);
  const completed = action("executions.complete");
  const cancelled = execution.status === "CANCELLED" || Boolean(action("executions.cancel"));
  const done = execution.status === "COMPLETED" || Boolean(completed || execution.data.actualCompletedAt);
  const criticalOpen = incidents.some((incident) => incident.data.status === "OPEN" && incident.data.severity === "CRITICAL");
  const openIncidents = incidents.filter((incident) => incident.data.status === "OPEN").length;
  const latestEvent = [...events].sort((a, b) => Date.parse(b.data.at) - Date.parse(a.data.at))[0] ?? null;
  const lastUpdatedAt = [execution.updatedAt, ...events.map((event) => event.data.at), ...incidents.map((incident) => incident.updatedAt)]
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const bookingConfirmed = booking?.data.carrierConfirmationStatus === "CONFIRMED";
  const bookingBlocked = booking?.data.carrierConfirmationStatus === "REJECTED" || booking?.data.carrierConfirmationStatus === "CANCELLED";

  const stages: JourneyStage[] = stageKeys.map((key) => {
    if (["preparation", "pickup", "checkpoint", "arrival", "reception"].includes(key))
      return { key, state: "unknown", at: null, evidence: "none" };
    if (key === "booking") return { key, state: bookingConfirmed ? "completed" : bookingBlocked ? "blocked" : booking ? "current" : "unknown",
      at: booking?.data.confirmedAt ?? booking?.data.authorizedAt ?? null, evidence: booking ? "booking" : "none" };
    if (key === "departure") return { key, state: hasReportedStart ? (done || hasReportedPosition ? "completed" : cancelled ? "blocked" : "current") : cancelled || bookingBlocked ? "blocked" : done || hasReportedPosition ? "unknown" : "future",
      at: started?.data.at ?? execution.data.actualStartedAt, evidence: started ? "event" : hasReportedStart ? "execution" : "none" };
    if (key === "transit") return { key, state: cancelled || criticalOpen || bookingBlocked ? "blocked" : done ? hasReportedPosition ? "completed" : "unknown" : hasReportedPosition ? "current" : "future",
      at: positioned?.data.at ?? null, evidence: positioned ? "event" : hasReportedPosition ? "execution" : "none" };
    return { key, state: done ? "completed" : cancelled || bookingBlocked ? "blocked" : "future",
      at: completed?.data.at ?? execution.data.actualCompletedAt, evidence: completed ? "event" : done ? "execution" : "none" };
  });
  const lastReportedStage: JourneyStageKey | null = done ? "delivery" : hasReportedPosition ? "transit" : hasReportedStart ? "departure" : bookingConfirmed ? "booking" : null;
  return { stages, lastReportedStage, criticalOpen, openIncidents, latestEvent, lastUpdatedAt, bookingBlocked, cancelled, completed: done, latestPositionAt: positioned?.data.at ?? null,
    positionReports: events.filter((event) => event.data.action === "executions.position").length,
    lastKnownPosition: execution.data.lastKnownPosition };
}

/** The 3D/map route must belong to this execution's booking→decision→plan, never merely to the same request. */
export function routeForExecution(execution: Execution, bookings: Booking[], decisions: Decision[], plans: Plan[], routes: Route[]): Route | null {
  const matchesRequest = (record: WorkflowRecordV2) => record.requestId === execution.requestId && execution.requestId !== null
    && typeof execution.organizationId === "string" && record.organizationId === execution.organizationId;
  const booking = bookings.find((record) => record.id === execution.data.bookingId && record.carrierId === execution.carrierId && matchesRequest(record));
  if (!booking || booking.data.carrierConfirmationStatus !== "CONFIRMED") return null;
  const decision = decisions.find((record) => record.id === booking.data.decisionId && matchesRequest(record));
  if (!decision) return null;
  const plan = plans.find((record) => record.id === decision.data.selectedPlanId && matchesRequest(record));
  if (!plan) return null;
  return routes.find((record) => record.id === plan.data.routeId && matchesRequest(record)) ?? null;
}

export function canShowConceptual3D(route: Route | null, hasGeometry: boolean) {
  return Boolean(route && hasGeometry && route.data.confidence !== "UNKNOWN" && route.data.legs.length > 0
    && route.data.legs.every((leg) => leg.mode === "ROAD"));
}
