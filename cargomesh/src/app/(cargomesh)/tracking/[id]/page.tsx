import { notFound } from "next/navigation";
import { z } from "zod";
import { routeRecordToPresentation } from "@/features/shipper-portal/tracking-model";
import { canShowConceptual3D, routeForExecution, type Booking, type Execution, type ExecutionEvent, type Incident, type Route } from "@/features/shipper-portal/tracking-journey";
import { TrackingDetail } from "@/features/shipper-portal/tracking-detail";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { getRequestLocale } from "@/server/i18n/server";
import { listWorkspaceWorkflow, readWorkspaceRequest } from "@/server/services/v2-workspace/workspace-server";

export const dynamic = "force-dynamic";
export default async function TrackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [allExecutions, eventRecords, incidentRecords, locale] = await Promise.all([
    listWorkspaceWorkflow("executions"), listWorkspaceWorkflow("execution-events", { parentId: id }),
    listWorkspaceWorkflow("incidents", { parentId: id }), getRequestLocale(),
  ]);
  const execution = allExecutions.find((item): item is Execution => item.kind === "executions" && item.id === id);
  if (!execution) notFound();
  const events = eventRecords.filter((item): item is ExecutionEvent => item.kind === "execution-events" && item.requestId === execution.requestId);
  const incidents = incidentRecords.filter((item): item is Incident => item.kind === "incidents" && item.requestId === execution.requestId);
  const [request, bookingRecords, decisionRecords, planRecords, routeRecords] = await Promise.all([
    execution.requestId ? readWorkspaceRequest(execution.requestId) : Promise.resolve(null),
    listWorkspaceWorkflow("bookings", { requestId: execution.requestId }),
    listWorkspaceWorkflow("decisions", { requestId: execution.requestId }),
    listWorkspaceWorkflow("plans", { requestId: execution.requestId }),
    listWorkspaceWorkflow("routes", { requestId: execution.requestId }),
  ]);
  const bookings = bookingRecords.filter((item): item is Booking => item.kind === "bookings");
  const decisions = decisionRecords.filter((item): item is Extract<WorkflowRecordV2, { kind: "decisions" }> => item.kind === "decisions");
  const plans = planRecords.filter((item): item is Extract<WorkflowRecordV2, { kind: "plans" }> => item.kind === "plans");
  const routes = routeRecords.filter((item): item is Route => item.kind === "routes");
  const booking = bookings.find((item) => item.id === execution.data.bookingId && item.requestId === execution.requestId) ?? null;
  const linkedRoute = routeForExecution(execution, bookings, decisions, plans, routes);
  const presentation = routeRecordToPresentation(linkedRoute);
  const canView3D = canShowConceptual3D(linkedRoute, presentation.paths.length > 0);
  return <TrackingDetail execution={execution} booking={booking} events={events} incidents={incidents}
    reference={request?.referenceCode ?? id.slice(0, 8)}
    origin={request?.origin.city ?? "—"} destination={request?.destination.city ?? "—"}
    originLabel={request?.origin.label ?? "—"} destinationLabel={request?.destination.label ?? "—"}
    requestId={execution.requestId} presentation={presentation} canView3D={canView3D}
    locale={locale}/>;
}
