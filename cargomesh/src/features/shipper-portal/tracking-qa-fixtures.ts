/** Explicit local UI-QA data. Never imported by the operational tracking routes. */
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import type { Booking, Execution, ExecutionEvent, Incident } from "./tracking-journey";
import type { TrackingListItem } from "./tracking-presentation";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-10-11T15:00:00Z";
const metadata = { id: id(1), organizationId: id(2), carrierId: id(3), requestId: id(4), version: 1, status: "CREATED", createdAt: at, updatedAt: at };
const evidence = { reference: "UI-QA-only", provider: "Explicit synthetic UI scenario", observedAt: at, validUntil: null, provenanceStatus: "SIMULATED" as const };
const booking = WorkflowRecordV2Schema.parse({ ...metadata, id: id(5), kind: "bookings", data: {
  decisionId: id(6), carrierReference: "QA-BOOKING", confirmedAt: at, authorizedAt: at, authorizedBy: id(7),
  authorizationStatus: "AUTHORIZED", carrierConfirmationStatus: "CONFIRMED", capacityEvidence: [], authorizationEvidence: evidence,
} }) as Booking;
const execution = WorkflowRecordV2Schema.parse({ ...metadata, kind: "executions", data: {
  createdBy: id(7), bookingId: id(5), serviceId: id(8), plannedWindow: { startsAt: at, endsAt: "2026-10-12T15:00:00Z" },
  actualStartedAt: null, actualCompletedAt: null, lastKnownPosition: null,
} }) as Execution;
const event = (action: ExecutionEvent["data"]["action"], index: number, time: string) => WorkflowRecordV2Schema.parse({
  ...metadata, id: id(index), kind: "execution-events", status: "REPORTED", data: {
    schemaVersion: "2.0", expectedVersion: 1, action, at: time, actorId: id(7), evidence,
    note: `UI QA · ${action} · Synthetic report, not a persisted shipment.`,
  },
}) as ExecutionEvent;
const incident = (status: "OPEN" | "RESOLVED", severity: "CRITICAL" | "WARNING", index: number) => WorkflowRecordV2Schema.parse({
  ...metadata, id: id(index), updatedAt: "2026-10-11T17:30:00Z", kind: "incidents", data: {
    schemaVersion: "2.0", kind: "INSPECTION", severity, occurredAt: "2026-10-11T17:30:00Z", location: null,
    description: status === "OPEN" ? "UI QA: inspection reported; no revised arrival time was provided." : "UI QA: previous inspection resolved.",
    evidence: [evidence], routeConditionIds: [], reportedBy: id(7), status,
  },
}) as Incident;
export const trackingQaScenarios = ["initial", "transit", "incidents", "resolved", "delivered", "cancelled", "rejected", "unknown"] as const;
export type TrackingQaScenario = typeof trackingQaScenarios[number];
export function trackingQaItem(scenario: TrackingQaScenario): TrackingListItem {
  const item: TrackingListItem = { execution: structuredClone(execution), booking: structuredClone(booking), events: [], incidents: [], reference: `UI-QA-${scenario.toUpperCase()}`, corridor: "Lima → Arequipa" };
  item.execution.id = id(100 + trackingQaScenarios.indexOf(scenario));
  if (["transit", "incidents", "resolved", "delivered"].includes(scenario)) {
    item.execution.status = "IN_PROGRESS";
    item.execution.data.actualStartedAt = at;
    item.events = [event("executions.start", 10, at), event("executions.position", 11, "2026-10-11T17:00:00Z")];
    item.execution.data.lastKnownPosition = { label: "UI QA checkpoint", countryCode: "PE", region: null, city: "Ica", lat: -14.07, lng: -75.73 };
  }
  if (scenario === "incidents") item.incidents = [incident("OPEN", "CRITICAL", 12), incident("RESOLVED", "WARNING", 13)];
  if (scenario === "resolved") item.incidents = [incident("RESOLVED", "CRITICAL", 12)];
  if (scenario === "delivered") {
    item.execution.status = "COMPLETED";
    item.events.push(event("executions.complete", 14, "2026-10-12T12:00:00Z"));
    item.execution.data.actualCompletedAt = "2026-10-12T12:00:00Z";
  }
  if (scenario === "cancelled") {
    item.execution.status = "CANCELLED";
    item.events = [event("executions.cancel", 15, at)];
  }
  if (scenario === "rejected") item.booking!.data.carrierConfirmationStatus = "REJECTED";
  if (scenario === "unknown") { item.execution.status = "UNKNOWN"; item.booking = null; }
  return item;
}
