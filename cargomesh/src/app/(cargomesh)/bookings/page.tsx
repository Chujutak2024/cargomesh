import { CalendarCheck2, CircleAlert, PackageCheck } from "lucide-react";
import Link from "next/link";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import { formatDateTime } from "@/features/shipper-portal/shipper-model";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function BookingsPage() {
  const [records, requests, locale] = await Promise.all([listWorkspaceWorkflow("bookings"), listWorkspaceRequests(), getRequestLocale()]);
  const bookings = records.filter((item) => item.kind === "bookings");
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>{t("Compromisos comerciales V2", "V2 commercial commitments")}</span><h1>{t("Reservas", "Bookings")}</h1><p>{t("Una autorización del shipper puede seguir pendiente, confirmada, rechazada o cancelada por el carrier. Esos estados nunca se confunden.", "A shipper authorization may still be pending, confirmed, rejected, or cancelled by the carrier. These states are never conflated.")}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Bookings persistidos", "Persisted bookings")}</h2><p>{bookings.length} {t("registros del tenant", "tenant records")}</p></div><CalendarCheck2 size={18}/></header>
      {bookings.length ? <div className={styles.facilityGrid}>{bookings.map((booking) => { const request = booking.requestId ? requestById.get(booking.requestId) : undefined; const status = booking.data.carrierConfirmationStatus; return <article className={styles.facility} key={booking.id}><div className={styles.facilityHead}><div><h2>{request?.referenceCode ?? booking.id.slice(0, 8)}</h2><p>{booking.data.carrierReference ?? t("Referencia carrier pendiente", "Carrier reference pending")}</p></div><span className={styles.status} data-tone={status === "CONFIRMED" ? "positive" : status === "REJECTED" || status === "CANCELLED" ? "danger" : "pending"}>{status}</span></div>
          <p><PackageCheck size={14}/> {t("Autorizada", "Authorized")}: {formatDateTime(booking.data.authorizedAt, tag)}</p><div className={styles.metaLine}><span>v{booking.version}</span><span>{booking.data.capacityEvidence.length} {t("evidencias de capacidad", "capacity evidence records")}</span></div>
          {status === "REJECTED" ? <p className={styles.notice} data-tone="danger"><CircleAlert size={15}/>{t("El carrier rechazó la reserva. Selecciona otra oferta vigente desde la solicitud.", "The carrier rejected the booking. Select another valid offer from the request.")}</p> : null}
          {request ? <Link className={styles.secondary} href={`/requests/${request.id}`}>{t("Abrir solicitud", "Open request")}</Link> : null}</article>; })}</div>
      : <div className={styles.empty}><span className={styles.emptyIcon}><CalendarCheck2 size={22}/></span><strong>{t("No hay reservas", "No bookings")}</strong><p>{t("Una reserva sólo aparece después de una decisión y consentimiento explícito del shipper.", "A booking only appears after a decision and explicit shipper consent.")}</p></div>}</section>
  </div>;
}
