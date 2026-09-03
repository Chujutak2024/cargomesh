import { ArrowLeft, Clock3, MapPin, Radio } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationsMap, type OperationsMapModel } from "@/components/operations-map";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { localeTag, translate } from "@/features/i18n/config";
import { getRequestLocale } from "@/features/i18n/server";
import { getTrackingDetail } from "@/features/operations/operations-server";
import styles from "../../operational-page.module.css";
import detailStyles from "./tracking-detail.module.css";

export const dynamic = "force-dynamic";
export default async function TrackingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, member, locale] = await Promise.all([params, requireOperationalRouteAccess(), getRequestLocale()]);
  let detail;
  try { detail = await getTrackingDetail(member, id); } catch { notFound(); }
  const { booking, request } = detail;
  const fmt = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" });
  const mapModel: OperationsMapModel = {
    bookingId: booking.bookingId,
    mode: "live",
    requestCode: request.code,
    origin: { city: request.origin_city, countryCode: request.origin_country },
    destination: { city: request.destination_city, countryCode: request.destination_country },
    checkpoints: booking.events.flatMap((event) => event.location ? [{
      id: event.providerEventId,
      city: event.location.city,
      countryCode: event.location.countryCode,
      label: event.eventType,
      occurredAt: event.occurredAt,
    }] : []),
  };
  return <div className={styles.page}>
    <Link className={styles.secondary} href="/tracking"><ArrowLeft size={16}/>{translate(locale, "Volver a seguimiento", "Back to tracking")}</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}><Radio size={15}/> {translate(locale, "Eventos del carrier", "Carrier events")}</span><h1>{request.code}</h1><p>{request.origin_city}, {request.origin_country} → {request.destination_city}, {request.destination_country}</p></div><span className={styles.status}>{booking.providerBookingStatus}</span></header>
    <section className={`${styles.panel} ${detailStyles.mapPanel}`}>
      <header className={styles.panelHeader}>
        <div><span className={styles.eyebrow}>{translate(locale, "Corredor del despacho", "Shipment corridor")}</span><h2>{translate(locale, "Mapa de seguimiento", "Tracking map")}</h2></div>
        <span className={detailStyles.mapState}>{mapModel.checkpoints.length ? translate(locale, "Eventos del carrier", "Carrier events") : translate(locale, "Ruta programada", "Scheduled route")}</span>
      </header>
      <OperationsMap model={mapModel}/>
    </section>
    <div className={detailStyles.grid}>
      <section className={styles.panel}><header className={styles.panelHeader}><h2>{translate(locale, "Línea de tiempo", "Timeline")}</h2><span className={styles.status}>{booking.events.length}</span></header>
        {booking.events.length ? <ol className={detailStyles.timeline}>{booking.events.map((event) => <li key={event.providerEventId}>
          <span className={detailStyles.dot}/><div><strong>{event.eventType}</strong><span>{event.providerBookingStatus}</span>{event.location ? <p><MapPin size={14}/>{event.location.city}, {event.location.countryCode}</p> : null}{event.description ? <p>{event.description}</p> : null}<small><Clock3 size={13}/>{fmt.format(new Date(event.occurredAt))}</small></div>
        </li>)}</ol> : <div className={styles.empty}><Clock3 size={27}/><strong>{translate(locale, "El carrier aún no reportó eventos", "The carrier has not reported events yet")}</strong><p>{translate(locale, "No se mostrará una ubicación o ETA hasta recibirla mediante el contrato vigente.", "No location or ETA will be shown until received through the current contract.")}</p></div>}
      </section>
      <aside className={detailStyles.notice}><MapPin size={20}/><h2>{translate(locale, "Ubicación autorizada", "Authorized location")}</h2><p>{translate(locale, "El mapa usa el origen y destino solicitados junto con las ciudades incluidas en booking_events. Los tramos sin eventos son referencias programadas y no representan GPS en vivo.", "The map uses the requested origin and destination together with cities included in booking_events. Segments without events are scheduled references and do not represent live GPS.")}</p></aside>
    </div>
  </div>;
}
