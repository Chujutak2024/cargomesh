import { CircleDot, Clock3 } from "lucide-react";
import Link from "next/link";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import { executionActionLabel, formatDateTime } from "@/features/shipper-portal/shipper-model";
import { RequestList } from "@/features/shipper-portal/request-list";
import { OutcomePanel } from "@/features/shipper-portal/outcome-panel";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const [requests, events, offers, bookings, incidents, locale] = await Promise.all([
    listWorkspaceRequests(), listWorkspaceWorkflow("execution-events"), listWorkspaceWorkflow("offers"),
    listWorkspaceWorkflow("bookings"), listWorkspaceWorkflow("incidents"), getRequestLocale(),
  ]);
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  const eventHistory = [...events].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><h1>{t("Historial", "History")}</h1></div></header>
    <RequestList requests={requests}/>
    <OutcomePanel requests={requests} offers={offers.filter((item) => item.kind === "offers")} bookings={bookings.filter((item) => item.kind === "bookings")} incidents={incidents.filter((item) => item.kind === "incidents")} t={t} localeTag={tag}/>
    <div className={styles.layout}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Cronología física del transporte", "Physical shipment timeline")}</h2></div></header>{eventHistory.length ? <div className={styles.timeline}>{eventHistory.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineDot}><CircleDot size={13}/></span><div><strong>{event.kind === "execution-events" ? executionActionLabel(event.data.action, locale) : event.status}</strong><span>{formatDateTime(event.kind === "execution-events" ? event.data.at : event.updatedAt, tag)} · {event.status}</span>{event.requestId && requestsById.has(event.requestId) ? <Link href={`/requests/${event.requestId}`}>{requestsById.get(event.requestId)?.referenceCode}</Link> : null}</div></div>)}</div> : <Empty label={t("Aún no hay eventos físicos reportados", "No physical events reported yet")} />}</section></div>
  </div>;
}
function Empty({ label }: { label: string }) { return <div className={styles.empty}><span className={styles.emptyIcon}><Clock3 size={21}/></span><strong>{label}</strong></div>; }
