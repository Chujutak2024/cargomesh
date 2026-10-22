import { ArrowRight, Building2, CalendarCheck2, CircleDotDashed, ClipboardList, MapPinned, PackagePlus } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import type { ReactNode } from "react";
import { operationsReader } from "@/server/services/v2-workspace/operations-server";
import { operationsCount, operationsReadIssues } from "@/server/services/v2-workspace/operations-collection";
import { OperationRequestLink, OperationsReadNotice } from "@/features/shipper-portal/operations-navigation";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { formatDateTime, formatMass, requestStatusLabel, requestStatusTone } from "@/features/shipper-portal/shipper-model";
import { ConversationEntry } from "@/features/v2-intake/conversation-entry";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const reader = await operationsReader();
  const [requests, bookings, executions, facilities, locale] = await Promise.all([
    reader.requests(), reader.workflow("bookings"), reader.workflow("executions"), reader.facilities(), getRequestLocale(),
  ]);
  const t = (es: string, en: string) => translate(locale, es, en);
  const localeName = localeTag(locale);
  const active = { ...requests, data: requests.data.filter((request) => !["BOOKED", "FAILED", "CANCELLED"].includes(request.status)) };
  const recent = [...requests.data].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);

  return <div className={styles.page}>
    <header className={styles.hero}><div className={styles.heroCopy}>
      <h1>{t("Tus cargas", "Your shipments")}</h1>
      <p>{t("De la solicitud al seguimiento.", "From request to tracking.")}</p>
      </div>
      <div className={styles.heroActions}>
        <Link className={styles.primary} href="/freight-request/new"><PackagePlus size={17}/>{t("Nueva solicitud", "New request")}</Link></div></header>

    <OperationsReadNotice issues={operationsReadIssues({ requests, bookings, executions, facilities })}/>

    <section className={styles.metrics} aria-label={t("Resumen operativo", "Operations summary")}>
      <Metric icon={<ClipboardList size={19}/>} value={operationsCount(requests)} label={t("Solicitudes", "Requests")} />
      <Metric icon={<CircleDotDashed size={19}/>} value={operationsCount(active)} label={t("En proceso", "In progress")} />
      <Metric icon={<CalendarCheck2 size={19}/>} value={operationsCount(bookings)} label={t("Reservas", "Bookings")} />
      <Metric icon={<MapPinned size={19}/>} value={operationsCount(executions)} label={t("Ejecuciones", "Executions")} />
    </section>

    <div className={`${styles.layout} ${styles.dashboardLayout}`}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{requests.complete ? t("Actividad reciente", "Recent activity") : t("Actividad en los registros cargados", "Activity in loaded records")}</h2></div><Link href="/requests">{t("Ver todo", "View all")} <ArrowRight size={13}/></Link></header>
        <div className={styles.activityLabels} aria-hidden="true"><span>{t("Solicitud", "Request")}</span><span>{t("Recorrido y carga", "Route and cargo")}</span><span>{t("Estado", "Status")}</span></div>
        {recent.length ? <div className={styles.list}>{recent.map((request) => <OperationRequestLink className={`${styles.row} ${styles.activityRow}`} requestId={request.id} key={request.id}>
          <span className={styles.stack}><strong>{request.referenceCode}</strong><small>{formatDateTime(request.updatedAt, localeName)}</small></span>
          <span className={styles.stack}><strong>{request.origin.city} → {request.destination.city}</strong><span>{request.origin.label} → {request.destination.label}</span></span>
          <span className={styles.stack}><strong>{formatMass(request.cargoSpecification.totalWeightKg, localeName)} · {request.cargoSpecification.totalVolumeM3.toLocaleString(localeName)} m³</strong><small>{request.cargoSpecification.description}</small></span>
          <span className={styles.status} data-tone={requestStatusTone(request.status)}>{requestStatusLabel(request.status, locale)}</span>
        </OperationRequestLink>)}</div> : requests.error ? <div className={styles.empty} role="status"><strong>{t("No se pudo consultar la actividad", "Activity could not be loaded")}</strong></div> : <div className={styles.empty}><span className={styles.emptyIcon}><PackagePlus size={22}/></span><strong>{t("Aún no hay solicitudes", "No requests yet")}</strong><p>{t("Crea el primer DRAFT. Nada se envía mientras avanzas entre pasos.", "Create the first DRAFT. Nothing is sent while moving between steps.")}</p><Link className={styles.primary} href="/freight-request/new">{t("Crear solicitud", "Create request")}</Link></div>}
      </section>
      <aside className={styles.dashboardRail}>
        <ConversationEntry />
        <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Accesos rápidos", "Quick access")}</h2></div></header>
        <div className={styles.quickGrid}><Link className={styles.quickCard} href="/facilities"><Building2 size={18} aria-hidden="true"/><strong>{t("Sedes", "Facilities")}</strong><span>{operationsCount(facilities)} {facilities.error ? t("sin verificar", "unverified") : t("registradas", "registered")}</span><ArrowRight size={15} aria-hidden="true"/></Link>
          <Link className={styles.quickCard} href="/bookings"><CalendarCheck2 size={18} aria-hidden="true"/><strong>{t("Reservas", "Bookings")}</strong><span>{t("Consentimiento y estado carrier", "Consent and carrier status")}</span><ArrowRight size={15} aria-hidden="true"/></Link>
          <Link className={styles.quickCard} href="/tracking"><MapPinned size={18} aria-hidden="true"/><strong>{t("Seguimiento", "Tracking")}</strong><span>{t("Eventos e incidencias reportados", "Reported events and incidents")}</span><ArrowRight size={15} aria-hidden="true"/></Link>
          <Link className={styles.quickCard} href="/history"><ClipboardList size={18} aria-hidden="true"/><strong>{t("Historial", "History")}</strong><span>{t("Solicitud ≠ evento de envío", "Request ≠ shipment event")}</span><ArrowRight size={15} aria-hidden="true"/></Link></div>
        </section>
      </aside>
    </div>
  </div>;
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <article className={styles.metric}><span className={styles.metricIcon}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></article>;
}
