import { CircleDot, Clock3 } from "lucide-react";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import { formatDateTime } from "@/features/shipper-portal/shipper-model";
import { RequestList } from "@/features/shipper-portal/request-list";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const [requests, events, locale] = await Promise.all([
    listWorkspaceRequests(), listWorkspaceWorkflow("execution-events"), getRequestLocale(),
  ]);
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  const eventHistory = [...events].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>{t("Trazabilidad", "Traceability")}</span><h1>{t("Historial", "History")}</h1><p>{t("El historial de solicitudes muestra cambios de negocio; la cronología de transporte muestra eventos físicos reportados. No se mezclan.", "Request history shows business changes; the shipment timeline shows reported physical events. They are not mixed.")}</p></div></header>
    <div className={styles.layout}><RequestList requests={requests}/>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Eventos de envío", "Shipment events")}</h2><p>{t("Emitidos por la ejecución/carrier", "Emitted by execution/carrier")}</p></div><Clock3 size={18}/></header>{eventHistory.length ? <div className={styles.timeline}>{eventHistory.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineDot}><CircleDot size={13}/></span><div><strong>{event.kind === "execution-events" ? event.data.action : event.status}</strong><span>{formatDateTime(event.updatedAt, tag)} · {event.status}</span></div></div>)}</div> : <Empty label={t("Aún no hay eventos físicos reportados", "No physical events reported yet")} />}</section></div>
  </div>;
}
function Empty({ label }: { label: string }) { return <div className={styles.empty}><span className={styles.emptyIcon}><Clock3 size={21}/></span><strong>{label}</strong></div>; }
