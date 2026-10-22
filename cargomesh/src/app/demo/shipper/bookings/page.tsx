import { ArrowRight, CalendarCheck2 } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { getRequestLocale } from "@/server/i18n/server";
import { translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/demo/workspace-demo-server";
import { BookingCard } from "@/features/shipper-portal/booking-card";
import bookingStyles from "@/features/shipper-portal/booking-card.module.css";
import { resolveBookingOffer } from "@/features/shipper-portal/commercial-view";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function BookingsPage() {
  const [records, requests, offerRecords, decisionRecords, locale] = await Promise.all([listWorkspaceWorkflow("bookings"), listWorkspaceRequests(), listWorkspaceWorkflow("offers"), listWorkspaceWorkflow("decisions"), getRequestLocale()]);
  const bookings = records.filter((item) => item.kind === "bookings");
  const offers = offerRecords.filter((item) => item.kind === "offers");
  const decisions = decisionRecords.filter((item) => item.kind === "decisions");
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><h1>{t("Reservas", "Bookings")}</h1><p>{t("Consulta las autorizaciones, las respuestas del transportista y sus condiciones.", "Review authorizations, carrier responses and their conditions.")}</p></div></header>
    <section className={`${styles.panel} ${bookingStyles.panel}`}><header className={styles.panelHeader}><div><h2>{t("Estado de cada reserva", "Status of each booking")}</h2></div></header>
      {bookings.length ? <div className={bookingStyles.grid}>{bookings.map((booking) => { const request = booking.requestId ? requestById.get(booking.requestId) : undefined;
        const offer = resolveBookingOffer(booking, decisions, offers);
        return <BookingCard key={booking.id} booking={booking} offer={offer} locale={locale}
          reference={request?.referenceCode ?? t("Solicitud vinculada", "Linked request")}
          carrier={offer?.data.carrierReference ?? booking.data.carrierReference ?? t("Carrier no identificado", "Carrier unidentified")}
          action={request ? <Link className={bookingStyles.action} href={`/requests/${request.id}`}>{t("Revisar solicitud y alternativas", "Review request and options")}<ArrowRight size={17} aria-hidden="true"/></Link> : null}/>; })}</div>
      : <div className={styles.empty}><span className={styles.emptyIcon}><CalendarCheck2 size={22}/></span><strong>{t("No hay reservas", "No bookings")}</strong><p>{t("Una reserva sólo aparece después de una decisión y consentimiento explícito del shipper.", "A booking only appears after a decision and explicit shipper consent.")}</p></div>}</section>
  </div>;
}
