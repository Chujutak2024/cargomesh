import { PackageOpen } from "lucide-react";
import Link from "next/link";
import type { FreightRequestListItem } from "@/features/freight-ui/view-models";
import { buildFreightRequestIntakeHref } from "@/features/dashboard/dashboard-view-model";
import { StatusBadge } from "./status-badge";
import styles from "./request-table.module.css";

export function RequestTable({ requests }: { requests: FreightRequestListItem[] }) {
  if (requests.length === 0) {
    return (
      <div className={styles.empty}>
        <PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" />
        <strong>No hay cargas todavía</strong>
        <p>Crea una carga para iniciar el descubrimiento de transportistas.</p>
        <Link href="/freight-request/new">Crear carga</Link>
      </div>
    );
  }

  return (
    <div className={styles.scrollRegion} tabIndex={0} aria-label="Cargas recientes">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Carga</th>
            <th>Ruta</th>
            <th>Carga</th>
            <th>Programación</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td data-label="Solicitud"><Link className={styles.requestLink} href={buildFreightRequestIntakeHref(request.requestCode)}>{request.requestCode}</Link><span>{request.cargoSummary}</span></td>
              <td data-label="Ruta"><strong>{request.origin} → {request.destination}</strong><span>{request.corridorNote ?? request.cargoDetail}</span></td>
              <td data-label="Carga"><strong>{request.cargoSummary}</strong><span>{request.cargoDetail}</span></td>
              <td data-label="Programación"><strong>Recojo · {request.pickupDate}</strong><span>Actualizada · {request.updatedAt}</span></td>
              <td data-label="Estado"><StatusBadge status={request.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
