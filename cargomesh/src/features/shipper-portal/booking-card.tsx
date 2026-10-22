import {displayReference} from '@/shared/lib/display-identity';
import type { ReactNode } from "react";
import { CalendarDays, CircleAlert, Clock3, PackageCheck, ShieldCheck } from "lucide-react";
import { localeTag, translate, type Locale } from "@/features/i18n/config";
import { bookingStatusPresentation, formatDateTime, type WorkflowRecordV2 } from "./shipper-model";
import styles from "./booking-card.module.css";

type Booking = Extract<WorkflowRecordV2, { kind: "bookings" }>;
type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;

/** Presentation only. An offer is supplied only after the page verifies its persisted linkage. */
export function BookingCard({ booking, offer, reference, carrier, locale, children, action }: {
  booking: Booking; offer: Offer | null; reference: string; carrier: string; locale: Locale;
  children?: ReactNode; action?: ReactNode;
}) {
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  const status = booking.data.carrierConfirmationStatus;
  const presentation = bookingStatusPresentation(status, locale);
  return <article className={styles.card} data-tone={presentation.tone}>
    <header className={styles.header}>
      <div className={styles.topline}>
        <span className={styles.status} data-tone={presentation.tone}>{presentation.label}</span>
        <span className={styles.version}>{t("Versión", "Version")} {booking.version}</span>
      </div>
      <h3>{carrier}</h3>
      <div className={styles.reference}><span>{t("Reserva", "Booking")}</span><code>{displayReference(reference,'BKG',booking.id)}</code></div>
    </header>
    <div className={styles.price}>
      <span><PackageCheck size={18} aria-hidden="true"/>{t("Oferta vinculada", "Linked offer")}</span>
      <strong>{offer ? `${offer.data.price.currency} ${offer.data.price.amount.toLocaleString(tag, { minimumFractionDigits: 2 })}` : t("Detalle no disponible", "Detail unavailable")}</strong>
    </div>
    <dl className={styles.facts}>
      <div><dt><ShieldCheck size={17} aria-hidden="true"/>{t("Autorizada", "Authorized")}</dt><dd>{formatDateTime(booking.data.authorizedAt, tag)}</dd></div>
      <div><dt><Clock3 size={17} aria-hidden="true"/>{t("Respuesta del transportista", "Carrier response")}</dt><dd>{formatDateTime(booking.data.confirmedAt, tag)}</dd></div>
      {offer && <div className={styles.validity}><dt><CalendarDays size={17} aria-hidden="true"/>{t("Vigencia original de la oferta", "Original offer validity")}</dt><dd>{formatDateTime(offer.data.validity.endsAt, tag)}</dd></div>}
    </dl>
    {status === "REJECTED" || status === "CANCELLED" ? <p className={styles.notice} data-tone="danger"><CircleAlert size={18} aria-hidden="true"/><span>{presentation.consequence} {t("El motivo específico sólo se muestra si el registro lo conserva.", "A specific reason is shown only if the record preserves it.")}</span></p> : null}
    {status === "PENDING" ? <p className={styles.notice} data-tone="pending">{presentation.consequence}</p> : null}
    <p className={styles.evidence}>{booking.data.capacityEvidence.length} {booking.data.capacityEvidence.length === 1 ? t("evidencia de capacidad", "capacity evidence record") : t("evidencias de capacidad", "capacity evidence records")}</p>
    {children && <div className={styles.resources}>{children}</div>}
    {action && <footer className={styles.footer}>{action}</footer>}
  </article>;
}
