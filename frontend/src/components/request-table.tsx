import { PackageOpen } from "lucide-react";
import Link from "next/link";
import type { FreightRequestListItem } from "@/features/freight-ui/view-models";
import { buildDashboardRouteHref, buildFreightRequestIntakeHref } from "@/features/dashboard/dashboard-view-model";
import type { Locale } from "@/features/i18n/config";
import { StatusBadge } from "./status-badge";
import styles from "./request-table.module.css";

export function RequestTable({
  requests,
  locale = "es",
  selectedRequestCode,
}: {
  requests: FreightRequestListItem[];
  locale?: Locale;
  selectedRequestCode?: string;
}) {
  const en = locale === "en";
  if (requests.length === 0) {
    return (
      <div className={styles.empty}>
        <PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" />
        <strong>{en ? "No shipments yet" : "No hay cargas todavía"}</strong>
        <p>{en ? "Create a shipment to start carrier discovery." : "Crea una carga para iniciar el descubrimiento de transportistas."}</p>
        <Link href="/freight-request/new">{en ? "Create shipment" : "Crear carga"}</Link>
      </div>
    );
  }

  return (
    <div className={styles.scrollRegion} tabIndex={0} aria-label={en ? "Recent shipments" : "Cargas recientes"}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{en ? "Request" : "Solicitud"}</th>
            <th>{en ? "Route" : "Ruta"}</th>
            <th>{en ? "Cargo" : "Carga"}</th>
            <th>{en ? "Schedule" : "Programación"}</th>
            <th>{en ? "Status" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const selected = request.requestCode === selectedRequestCode;
            return (
            <tr key={request.id} className={selected ? styles.selectedRow : undefined}>
              <td data-label={en ? "Request" : "Solicitud"}><Link className={styles.requestLink} href={request.actionHref ?? buildFreightRequestIntakeHref(request.requestCode)}>{request.requestCode}</Link><span>{request.cargoSummary}</span><Link className={styles.mapLink} href={buildDashboardRouteHref(request.requestCode)} aria-current={selected ? "location" : undefined}>{en ? "View route" : "Ver ruta"}</Link></td>
              <td data-label="Ruta"><strong>{request.origin} → {request.destination}</strong><span>{request.corridorNote ?? request.cargoDetail}</span></td>
              <td data-label="Carga"><strong>{request.cargoSummary}</strong><span>{request.cargoDetail}</span></td>
              <td data-label={en ? "Schedule" : "Programación"}><strong>{en ? "Pickup" : "Recojo"} · {request.pickupDate}</strong><span>{en ? "Updated" : "Actualizada"} · {request.updatedAt}</span></td>
              <td data-label={en ? "Status" : "Estado"}><StatusBadge status={request.status} locale={locale} /></td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
