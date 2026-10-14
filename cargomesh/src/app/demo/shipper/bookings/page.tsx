import { ArrowRight, CalendarCheck2, CircleAlert, Clock3, PackageCheck, ShieldCheck } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { getRequestLocale } from "@/server/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/demo/workspace-demo-server";
import { bookingStatusPresentation, formatDateTime } from "@/features/shipper-portal/shipper-model";
import { resolveBookingOffer } from "@/features/shipper-portal/commercial-view";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function BookingsPage() {
  const [records, requests, offerRecords, decisionRecords, locale] = await Promise.all([listWorkspaceWorkflow("bookings"), listWorkspaceRequests(), listWorkspaceWorkflow("offers"), listWorkspaceWorkflow("decisions"), getRequestLocale()]);
  const bookings = records.filter((item) => item.kind === "bookings");
  const offers = offerRecords.filter((item) => item.kind === "offers");
  const decisions = decisionRecords.filter((item) => item.kind === "decisions");
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}><h1>{t("Reservas", "Bookings")}</h1></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Estado de cada reserva", "Status of each booking")}</h2></div></header>
      {bookings.length ? <div className={styles.facilityGrid}>{bookings.map((booking) => { const request = booking.requestId ? requestById.get(booking.requestId) : undefined; const status = booking.data.carrierConfirmationStatus;
        const offer = resolveBookingOffer(booking, decisions, offers);
        const presentation = bookingStatusPresentation(status, locale);
        return <article className={styles.facility} key={booking.id}><div className={styles.facilityHead}><div><span className={styles.eyebrow}>{request?.referenceCode ?? t("Solicitud vinculada", "Linked request")}</span><h2>{offer?.data.carrierReference ?? booking.data.carrierReference ?? t("Carrier no identificado", "Carrier unidentified")}</h2></div><span className={styles.status} data-tone={presentation.tone}>{presentation.label}</span></div>
          <div className={styles.bookingFacts}><p><ShieldCheck size={14}/> {t("Autorizada", "Authorized")}: {formatDateTime(booking.data.authorizedAt, tag)}</p><p><Clock3 size={14}/> {t("Respuesta carrier", "Carrier response")}: {formatDateTime(booking.data.confirmedAt, tag)}</p><p><PackageCheck size={14}/> {t("Oferta", "Offer")}: {offer ? `${offer.data.price.currency} ${offer.data.price.amount.toLocaleString(tag, { minimumFractionDigits: 2 })}` : t("Detalle no disponible", "Detail unavailable")}</p></div>
          {offer ? <p>{t("Vigencia original de la oferta", "Original offer validity")}: {formatDateTime(offer.data.validity.endsAt, tag)}</p> : null}
          {status === "REJECTED" || status === "CANCELLED" ? <p className={styles.bookingWarning}><CircleAlert size={15}/>{presentation.consequence} {t("El motivo específico sólo se muestra si el registro lo conserva.", "A specific reason is shown only if the record preserves it.")}</p> : null}
          {status === "PENDING" ? <p className={styles.bookingPending}>{presentation.consequence}</p> : null}
          <div className={styles.metaLine}><span>v{booking.version}</span><span>{booking.data.capacityEvidence.length} {t("evidencias de capacidad", "capacity evidence records")}</span></div>
          {request ? <Link className={styles.secondary} href={`/requests/${request.id}`}>{t("Revisar solicitud y alternativas", "Review request and options")}<ArrowRight size={14}/></Link> : null}</article>; })}</div>
      : <div className={styles.empty}><span className={styles.emptyIcon}><CalendarCheck2 size={22}/></span><strong>{t("No hay reservas", "No bookings")}</strong><p>{t("Una reserva sólo aparece después de una decisión y consentimiento explícito del shipper.", "A booking only appears after a decision and explicit shipper consent.")}</p></div>}</section>
  </div>;
}
