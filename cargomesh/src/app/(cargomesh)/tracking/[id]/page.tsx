import { ArrowLeft, CalendarClock, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TrackingVisual } from "@/features/shipper-portal/tracking-visual";
import { routeRecordToPresentation } from "@/features/shipper-portal/tracking-model";
import { canShowConceptual3D, routeForExecution, type Booking, type Execution, type ExecutionEvent, type Incident, type Route } from "@/features/shipper-portal/tracking-journey";
import { TrackingEventsPanel, TrackingIncidentsPanel, TrackingJourneyPanel } from "@/features/shipper-portal/tracking-experience";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { formatDateTime } from "@/features/shipper-portal/shipper-model";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceWorkflow, readWorkspaceRequest } from "@/server/services/v2-workspace/workspace-server";
import s from "@/features/shipper-portal/tracking-experience.module.css";

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
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  return <div className={s.page}>
    <header className={s.hero}><div className={s.heroCopy}><span className={s.eyebrow}>{t("Seguimiento de transporte", "Transport tracking")}</span><h1>{request?.referenceCode ?? id.slice(0, 8)}</h1><p>{request ? `${request.origin.label} → ${request.destination.label}` : t("Solicitud asociada no disponible en esta lectura.", "Associated request unavailable in this read.")}</p></div><Link className={s.heroAction} href="/tracking"><ArrowLeft size={16} aria-hidden="true"/>{t("Todos los transportes", "All transports")}</Link></header>
    <section className={s.panel} aria-label={t("Datos de seguimiento", "Tracking facts")}><div className={s.facts}>
      <div className={s.fact}><small>{t("Estado de ejecución", "Execution state")}</small><strong>{execution.status}</strong></div>
      <div className={s.fact}><small>{t("Reserva carrier", "Carrier booking")}</small><strong>{booking?.data.carrierConfirmationStatus ?? t("Desconocida", "Unknown")}</strong></div>
      <div className={s.fact}><small>{t("Inicio reportado", "Reported start")}</small><strong>{formatDateTime(execution.data.actualStartedAt, tag)}</strong></div>
      <div className={s.fact}><small>{t("Entrega reportada", "Reported delivery")}</small><strong>{formatDateTime(execution.data.actualCompletedAt, tag)}</strong></div>
    </div></section>
    <div className={s.detailGrid}><div className={s.mainColumn}>
      <TrackingJourneyPanel execution={execution} booking={booking} events={events} incidents={incidents} t={t} tag={tag}/>
      <TrackingVisual presentation={presentation} origin={request?.origin.label ?? t("Origen", "Origin")} destination={request?.destination.label ?? t("Destino", "Destination")} canView3D={canView3D}/>
      <TrackingEventsPanel events={events} t={t} tag={tag} locale={locale}/>
    </div><aside className={s.sideColumn}>
      <TrackingIncidentsPanel incidents={incidents} t={t} tag={tag}/>
      <section className={s.panel} aria-label={t("Procedencia", "Provenance")}><div className={s.facts}>
        <div className={s.fact}><small><MapPin size={12} aria-hidden="true"/> {t("Geometría", "Geometry")}</small><strong>{linkedRoute ? `${linkedRoute.data.confidence} · ${linkedRoute.data.geographicSource.kind}` : t("Sin ruta enlazada a este booking", "No route linked to this booking")}</strong></div>
        <div className={s.fact}><small><CalendarClock size={12} aria-hidden="true"/> {t("Última lectura", "Last read")}</small><strong>{formatDateTime(execution.updatedAt, tag)}</strong></div>
        <div className={s.fact}><small><Truck size={12} aria-hidden="true"/> {t("Posición", "Position")}</small><strong>{t("Sólo reportes persistidos; sin GPS simulado", "Persisted reports only; no simulated GPS")}</strong></div>
      </div></section>
    </aside></div>
  </div>;
}
