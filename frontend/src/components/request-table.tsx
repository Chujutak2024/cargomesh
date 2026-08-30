import { PackageOpen } from "lucide-react";
import type { FreightRequestListItem } from "@/features/freight-ui/view-models";
import { StatusBadge } from "./status-badge";
import styles from "./request-table.module.css";

export function RequestTable({ requests }: { requests: FreightRequestListItem[] }) {
  if (requests.length === 0) {
    return (
      <div className={styles.empty}>
        <PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" />
        <strong>No hay solicitudes todavía</strong>
        <p>Crea una carga para iniciar el descubrimiento de transportistas.</p>
      </div>
    );
  }

  return (
    <div className={styles.scrollRegion} tabIndex={0} aria-label="Solicitudes de transporte">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Solicitud</th>
            <th>Ruta</th>
            <th>Carga</th>
            <th>Recojo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td data-label="Solicitud"><strong className={styles.requestId}>{request.id}</strong></td>
              <td data-label="Ruta">
                <strong>{request.origin} → {request.destination}</strong>
                {request.corridorNote ? <span>{request.corridorNote}</span> : null}
              </td>
              <td data-label="Carga"><strong>{request.cargoSummary}</strong><span>{request.cargoDetail}</span></td>
              <td data-label="Recojo">{request.pickupDate}</td>
              <td data-label="Estado"><StatusBadge status={request.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

