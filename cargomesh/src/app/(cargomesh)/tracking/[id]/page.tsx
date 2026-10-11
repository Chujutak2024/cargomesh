import { AlertTriangle, CheckCircle2, CircleDot, MapPinned } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TrackingVisual } from "@/features/shipper-portal/tracking-visual";
import { routeRecordToPresentation } from "@/features/shipper-portal/tracking-model";
import { executionProgress, formatDateTime } from "@/features/shipper-portal/shipper-model";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceWorkflow, readWorkspaceRequest } from "@/server/services/v2-workspace/workspace-server";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function TrackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [allExecutions, events, incidents, locale] = await Promise.all([
    listWorkspaceWorkflow("executions"), listWorkspaceWorkflow("execution-events", { parentId: id }),
    listWorkspaceWorkflow("incidents", { parentId: id }), getRequestLocale(),
  ]);
  const execution = allExecutions.find((item): item is Extract<typeof item, { kind: "executions" }> => item.kind === "executions" && item.id === id);
  if (!execution) notFound();
  const request = execution.requestId ? await readWorkspaceRequest(execution.requestId) : null;
  const routes = execution.requestId ? await listWorkspaceWorkflow("routes", { requestId: execution.requestId }) : [];
  const route = routes.findLast((item) => item.kind === "routes") ?? null;
  const presentation = route && route.kind === "routes" ? routeRecordToPresentation(route) : routeRecordToPresentation(null);
  const progress = executionProgress(execution.status, events);
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  const sortedEvents = [...events].sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>{t("Ejecución V2", "V2 execution")}</span><h1>{request?.referenceCode ?? id.slice(0, 8)}</h1><p>{request ? `${request.origin.label} → ${request.destination.label}` : t("Solicitud asociada no disponible en esta lectura.", "Associated request unavailable in this read.")}</p></div><span className={styles.status} data-tone={execution.status === "COMPLETED" ? "positive" : execution.status === "CANCELLED" ? "danger" : "pending"}>{execution.status}</span></header>
    <section className={styles.panel}><div className={styles.summary}><div className={styles.summaryItem}><small>{t("Progreso por eventos", "Event-based progress")}</small><strong>{progress}%</strong><div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${progress}%` }}/></div></div><div className={styles.summaryItem}><small>{t("Última posición", "Last position")}</small><strong>{execution.data.lastKnownPosition?.label ?? t("Desconocida", "Unknown")}</strong></div><div className={styles.summaryItem}><small>{t("Inicio real", "Actual start")}</small><strong>{formatDateTime(execution.data.actualStartedAt, tag)}</strong></div><div className={styles.summaryItem}><small>{t("Fin real", "Actual completion")}</small><strong>{formatDateTime(execution.data.actualCompletedAt, tag)}</strong></div></div></section>
    <div className={styles.detailGrid}><TrackingVisual presentation={presentation} origin={request?.origin.label ?? t("Origen", "Origin")} destination={request?.destination.label ?? t("Destino", "Destination")} progress={progress} inactive={execution.status === "CANCELLED" || execution.status === "COMPLETED"}/>
      <aside className={styles.page}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Cronología física", "Physical timeline")}</h2><p>{t("Sólo eventos persistidos", "Persisted events only")}</p></div><MapPinned size={18}/></header>{sortedEvents.length ? <div className={styles.timeline}>{sortedEvents.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineDot}><CheckCircle2 size={13}/></span><div><strong>{event.kind === "execution-events" ? event.data.action : event.status}</strong><span>{formatDateTime(event.updatedAt, tag)}</span></div></div>)}</div> : <div className={styles.empty}><CircleDot size={20}/><strong>{t("Sin eventos reportados", "No reported events")}</strong></div>}</section>
        <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Incidencias", "Incidents")}</h2><p>{t("No se confunden con cancelación o rechazo", "Not conflated with cancellation or rejection")}</p></div><AlertTriangle size={18}/></header>{incidents.length ? <div className={styles.section}>{incidents.map((incident) => incident.kind === "incidents" ? <article className={styles.notice} data-tone={incident.data.severity === "CRITICAL" ? "danger" : "warning"} key={incident.id}><AlertTriangle size={16}/><div><strong>{incident.data.kind} · {incident.data.status}</strong><div>{incident.data.description}</div></div></article> : null)}</div> : <div className={styles.empty}><strong>{t("Sin incidencias reportadas", "No reported incidents")}</strong></div>}</section></aside>
    </div>
  </div>;
}
