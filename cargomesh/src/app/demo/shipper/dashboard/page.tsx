import { ArrowRight, Bot, CalendarCheck2, CircleDotDashed, ClipboardList, MapPinned, PackagePlus } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import type { ReactNode } from "react";
import { listWorkspaceFacilities, listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/demo/workspace-demo-server";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { formatDateTime, formatMass, requestStatusLabel, requestStatusTone } from "@/features/shipper-portal/shipper-model";
import { ConversationEntry } from "@/features/v2-intake/conversation-entry";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [requests, bookings, executions, facilities, locale] = await Promise.all([
    listWorkspaceRequests(), listWorkspaceWorkflow("bookings"), listWorkspaceWorkflow("executions"),
    listWorkspaceFacilities(), getRequestLocale(),
  ]);
  const t = (es: string, en: string) => translate(locale, es, en);
  const localeName = localeTag(locale);
  const active = requests.filter((request) => !["BOOKED", "FAILED", "CANCELLED"].includes(request.status)).length;
  const recent = [...requests].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);

  return <div className={styles.page}>
    <header className={styles.hero}><div className={styles.heroCopy}>
      <h1>{t("Tus cargas, de la solicitud al seguimiento", "Your shipments, from request to tracking")}</h1>
      </div>
      <div className={styles.heroActions}><Link className={styles.secondary} href="/freight-request/new?assistant=open"><Bot size={17}/>{t("Abrir asistente", "Open assistant")}</Link>
        <Link className={styles.primary} href="/freight-request/new"><PackagePlus size={17}/>{t("Nueva solicitud", "New request")}</Link></div></header>

    <ConversationEntry />

    <section className={styles.metrics} aria-label={t("Resumen operativo", "Operations summary")}>
      <Metric icon={<ClipboardList size={19}/>} value={requests.length} label={t("Solicitudes", "Requests")} />
      <Metric icon={<CircleDotDashed size={19}/>} value={active} label={t("En proceso", "In progress")} />
      <Metric icon={<CalendarCheck2 size={19}/>} value={bookings.length} label={t("Reservas", "Bookings")} />
      <Metric icon={<MapPinned size={19}/>} value={executions.length} label={t("Ejecuciones", "Executions")} />
    </section>

    <div className={styles.layout}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Actividad reciente", "Recent activity")}</h2></div><Link href="/requests">{t("Ver todo", "View all")} <ArrowRight size={13}/></Link></header>
        {recent.length ? <div className={styles.list}>{recent.map((request) => <Link className={styles.row} href={`/requests/${request.id}`} key={request.id}>
          <span className={styles.stack}><strong>{request.referenceCode}</strong><small>{formatDateTime(request.updatedAt, localeName)}</small></span>
          <span className={styles.stack}><strong>{request.origin.city} → {request.destination.city}</strong><span>{request.origin.label} → {request.destination.label}</span></span>
          <span className={styles.stack}><strong>{formatMass(request.cargoSpecification.totalWeightKg, localeName)} · {request.cargoSpecification.totalVolumeM3.toLocaleString(localeName)} m³</strong><small>{request.cargoSpecification.description}</small></span>
          <span className={styles.status} data-tone={requestStatusTone(request.status)}>{requestStatusLabel(request.status, locale)}</span>
        </Link>)}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><PackagePlus size={22}/></span><strong>{t("Aún no hay solicitudes", "No requests yet")}</strong><p>{t("Crea el primer DRAFT. Nada se envía mientras avanzas entre pasos.", "Create the first DRAFT. Nothing is sent while moving between steps.")}</p><Link className={styles.primary} href="/freight-request/new">{t("Crear solicitud", "Create request")}</Link></div>}
      </section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Accesos rápidos", "Quick access")}</h2></div></header>
        <div className={styles.quickGrid}><Link className={styles.quickCard} href="/facilities"><strong>{t("Sedes", "Facilities")}</strong><span>{facilities.length} {t("registradas", "registered")}</span></Link>
          <Link className={styles.quickCard} href="/bookings"><CalendarCheck2 size={20}/><strong>{t("Reservas", "Bookings")}</strong><span>{t("Consentimiento y estado carrier", "Consent and carrier status")}</span></Link>
          <Link className={styles.quickCard} href="/tracking"><MapPinned size={20}/><strong>{t("Seguimiento", "Tracking")}</strong><span>{t("Eventos e incidencias reportados", "Reported events and incidents")}</span></Link>
          <Link className={styles.quickCard} href="/history"><ClipboardList size={20}/><strong>{t("Historial", "History")}</strong><span>{t("Solicitud ≠ evento de envío", "Request ≠ shipment event")}</span></Link></div>
      </aside>
    </div>
  </div>;
}

function Metric({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return <article className={styles.metric}><span className={styles.metricIcon}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></article>;
}
