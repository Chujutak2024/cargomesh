import { MapPinned } from "lucide-react";
import Link from "next/link";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { localeTag, translate } from "@/features/i18n/config";
import { getRequestLocale } from "@/features/i18n/server";
import { getTrackingList } from "@/features/operations/operations-server";
import styles from "../operational-page.module.css";

export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const [member, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  const items = await getTrackingList(member);
  const fmt = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" });
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}><MapPinned size={15} /> booking_events</span><h1>{translate(locale, "Seguimiento", "Tracking")}</h1><p>{translate(locale, "Estado y eventos persistidos reportados por cada carrier. CargoMesh no agrega telemetría no recibida.", "Persisted status and events reported by each carrier. CargoMesh does not add unreported telemetry.")}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><h2>{translate(locale, "Bookings con seguimiento", "Trackable bookings")}</h2><span className={styles.status}>{items.length}</span></header>
      {items.length ? <div className={styles.list}>{items.map((item) => <Link className={styles.row} href={`/tracking/${item.bookingId}`} key={item.bookingId}>
        <span className={styles.stack}><strong>{item.requestCode}</strong><small>{item.origin} → {item.destination}</small></span>
        <span className={styles.stack}><strong>{item.providerStatus}</strong><small>{translate(locale, "Reportado por el carrier", "Reported by carrier")}</small></span>
        <span className={styles.stack}><strong>{item.eventCount} {translate(locale, "eventos", "events")}</strong><small>{fmt.format(new Date(item.updatedAt))}</small></span>
        <span className={styles.status}>{item.status}</span>
      </Link>)}</div> : <div className={styles.empty}><MapPinned size={28}/><strong>{translate(locale, "No hay bookings confirmados", "No confirmed bookings")}</strong><p>{translate(locale, "El seguimiento estará disponible cuando un carrier confirme una reserva.", "Tracking will be available after a carrier confirms a booking.")}</p></div>}
    </section>
  </div>;
}
