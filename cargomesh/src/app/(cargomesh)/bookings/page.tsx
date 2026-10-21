import { ArrowRight, CalendarCheck2 } from "lucide-react";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { operationsReader, readOperationsBookingResources } from "@/server/services/v2-workspace/operations-server";
import { BookingResources } from "@/features/shipper-portal/booking-resources";
import { carrierLabel } from "@/features/shipper-portal/commercial-catalog";
import { operationsReadIssues } from "@/server/services/v2-workspace/operations-collection";
import { OperationRequestLink, OperationsNavigation, OperationsReadNotice } from "@/features/shipper-portal/operations-navigation";
import { BookingCard } from "@/features/shipper-portal/booking-card";
import bookingStyles from "@/features/shipper-portal/booking-card.module.css";
import { resolveBookingOffer } from "@/features/shipper-portal/commercial-view";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function BookingsPage() {
  const reader = await operationsReader();
  const [records, requests, offerRecords, decisionRecords, locale] = await Promise.all([reader.workflow("bookings"), reader.requests(), reader.workflow("offers"), reader.workflow("decisions"), getRequestLocale()]);
  const bookings = records.data.filter((item) => item.kind === "bookings");
  const offers = offerRecords.data.filter((item) => item.kind === "offers");
  const decisions = decisionRecords.data.filter((item) => item.kind === "decisions");
  const [resources, catalog] = await Promise.all([readOperationsBookingResources(bookings, reader), reader.commercialCatalog({ offers })]);
  const requestById = new Map(requests.data.map((request) => [request.id, request]));
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><h1>{t("Reservas", "Bookings")}</h1></div></header>
    <OperationsNavigation/>
    <OperationsReadNotice issues={operationsReadIssues({ bookings: records, requests, offers: offerRecords, decisions: decisionRecords })}/>
    <section className={`${styles.panel} ${bookingStyles.panel}`}><header className={styles.panelHeader}><div><h2>{t("Estado de cada reserva", "Status of each booking")}</h2></div></header>
      {bookings.length ? <div className={bookingStyles.grid}>{bookings.map((booking) => { const request = booking.requestId ? requestById.get(booking.requestId) : undefined;
        const offer = offerRecords.complete && decisionRecords.complete ? resolveBookingOffer(booking, decisions, offers) : null;
        return <BookingCard key={booking.id} booking={booking} offer={offer} locale={locale}
          reference={request?.referenceCode ?? t("Solicitud vinculada", "Linked request")} carrier={carrierLabel(booking.carrierId,catalog,t)}
          action={booking.requestId ? <OperationRequestLink className={bookingStyles.action} requestId={booking.requestId}>{t("Revisar solicitud y alternativas", "Review request and options")}<ArrowRight size={17} aria-hidden="true"/></OperationRequestLink> : null}>
          <BookingResources booking={booking} rows={resources.data} offers={offers} decisions={decisions} complete={records.complete && resources.complete} t={t} localeTag={tag}/>
        </BookingCard>; })}</div>
      : records.error ? <div className={styles.empty} role="status"><strong>{t("No se pudieron consultar las reservas", "Bookings could not be loaded")}</strong></div>
      : <div className={styles.empty}><span className={styles.emptyIcon}><CalendarCheck2 size={22}/></span><strong>{t("No hay reservas", "No bookings")}</strong><p>{t("Una reserva sólo aparece después de una decisión y consentimiento explícito del shipper.", "A booking only appears after a decision and explicit shipper consent.")}</p></div>}</section>
  </div>;
}
