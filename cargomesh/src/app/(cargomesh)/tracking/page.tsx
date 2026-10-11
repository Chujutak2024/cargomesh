import { MapPinned, Navigation, Truck } from "lucide-react";
import Link from "next/link";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import { executionProgress, formatDateTime } from "@/features/shipper-portal/shipper-model";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const [records, eventRecords, requests, locale] = await Promise.all([
    listWorkspaceWorkflow("executions"), listWorkspaceWorkflow("execution-events"), listWorkspaceRequests(), getRequestLocale(),
  ]);
  const executions = records.filter((item): item is Extract<typeof item, { kind: "executions" }> => item.kind === "executions"), requestById = new Map(requests.map((request) => [request.id, request]));
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>{t("Operación reportada", "Reported operation")}</span><h1>{t("Seguimiento", "Tracking")}</h1><p>{t("El progreso proviene de eventos persistidos. Sin evento de posición o geometría, la ubicación se muestra como desconocida y no se simula GPS.", "Progress comes from persisted events. Without a position event or geometry, location is shown as unknown and GPS is not simulated.")}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Ejecuciones", "Executions")}</h2><p>{executions.length} {t("operaciones visibles", "visible operations")}</p></div><Truck size={19}/></header>
      {executions.length ? <div className={styles.facilityGrid}>{executions.map((execution) => { const request = execution.requestId ? requestById.get(execution.requestId) : undefined; const events = eventRecords.filter((event) => event.requestId === execution.requestId); const progress = executionProgress(execution.status, events); return <article className={styles.facility} key={execution.id}><div className={styles.facilityHead}><div><h2>{request?.referenceCode ?? execution.id.slice(0, 8)}</h2><p>{request ? `${request.origin.city} → ${request.destination.city}` : t("Solicitud no enlazada en esta lectura", "Request not linked in this read")}</p></div><span className={styles.status} data-tone={execution.status === "COMPLETED" ? "positive" : execution.status === "CANCELLED" ? "danger" : "pending"}>{execution.status}</span></div>
          <div className={styles.progressTrack} aria-label={`${progress}%`}><div className={styles.progressFill} style={{ width: `${progress}%` }}/></div><div className={styles.metaLine}><span><Navigation size={13}/> {execution.data.lastKnownPosition?.label ?? t("Ubicación desconocida", "Location unknown")}</span><span>{formatDateTime(execution.updatedAt, tag)}</span></div>
          <Link className={styles.primary} href={`/tracking/${execution.id}`}>{t("Ver cronología", "View timeline")}</Link></article>; })}</div>
      : <div className={styles.empty}><span className={styles.emptyIcon}><MapPinned size={22}/></span><strong>{t("No hay ejecuciones", "No executions")}</strong><p>{t("El seguimiento comienza cuando existe una reserva confirmada y una ejecución persistida.", "Tracking starts when a confirmed booking and persisted execution exist.")}</p></div>}</section>
  </div>;
}
