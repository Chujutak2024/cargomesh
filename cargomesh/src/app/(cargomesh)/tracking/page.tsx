import { ArrowRight, MapPinned, Truck } from "lucide-react";
import Link from "next/link";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import { TrackingOverviewCard } from "@/features/shipper-portal/tracking-experience";
import type { Booking, Execution } from "@/features/shipper-portal/tracking-journey";
import s from "@/features/shipper-portal/tracking-experience.module.css";

export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const [records, bookingRecords, requests, locale] = await Promise.all([
    listWorkspaceWorkflow("executions"), listWorkspaceWorkflow("bookings"), listWorkspaceRequests(), getRequestLocale(),
  ]);
  const executions = records.filter((item): item is Execution => item.kind === "executions");
  const bookings = bookingRecords.filter((item): item is Booking => item.kind === "bookings");
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  return <div className={s.page}>
    <header className={s.hero}><div className={s.heroCopy}><span className={s.eyebrow}>{t("Visibilidad del transporte", "Transport visibility")}</span><h1>{t("Sigue cada entrega con claridad", "Know where every shipment stands")}</h1><p>{t("Reserva, hitos físicos e incidencias en una sola vista. Las posiciones son reportes discretos; una ruta planificada nunca se presenta como GPS en vivo.", "Booking, physical milestones and incidents in one place. Positions are discrete reports; a planned route is never presented as live GPS.")}</p></div><Link className={s.heroAction} href="/history">{t("Ver historial", "View history")}<ArrowRight size={16} aria-hidden="true"/></Link></header>
    <section className={s.panel} aria-labelledby="tracking-list-title"><div className={s.panelHeading}><div><span className={s.eyebrow}>{t("Operaciones visibles", "Visible operations")}</span><h2 id="tracking-list-title">{t("Transportes", "Transport executions")} · {executions.length}</h2><p>{t("Sólo operaciones autorizadas de tu organización. Abre un transporte para ver sus eventos e incidencias completos.", "Only authorized operations for your organization. Open a transport for its full events and incidents.")}</p></div><Truck size={21} aria-hidden="true"/></div>
      {executions.length ? <div className={s.overviewGrid}>{executions.map((execution) => { const request = execution.requestId ? requestById.get(execution.requestId) : undefined; const booking = bookings.find((item) => item.id === execution.data.bookingId && item.requestId === execution.requestId) ?? null;
        return <TrackingOverviewCard key={execution.id} execution={execution} booking={booking} events={[]} incidents={[]}
          reference={request?.referenceCode ?? execution.id.slice(0, 8)} corridor={request ? `${request.origin.city} → ${request.destination.city}` : t("Solicitud no disponible en esta lectura", "Request unavailable in this read")} t={t} tag={tag}/>; })}</div>
        : <div className={s.empty}><MapPinned size={24} aria-hidden="true"/><strong>{t("Aún no hay transportes en seguimiento", "No tracked transports yet")}</strong><p>{t("El seguimiento comienza con una reserva confirmada y una ejecución persistida. Una solicitud o un mapa previsto no crean un viaje real.", "Tracking begins with a confirmed booking and a persisted execution. A request or planned map does not create a real trip.")}</p></div>}</section>
  </div>;
}
