import { PackageOpen } from "lucide-react";
import type { FreightRequestListItem } from "@/features/freight-ui/view-models";
import { StatusBadge } from "./status-badge";
import styles from "./request-table.module.css";

export function RequestTable({ requests }: { requests: FreightRequestListItem[] }) {
  if (requests.length === 0) {
    return (
      <div className={styles.empty}>
        <PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" />
        <strong>No hay cargas todavía</strong>
        <p>Crea una carga para iniciar el descubrimiento de transportistas.</p>
        <button type="button" disabled title="Disponible en B-02">Crear carga</button>
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
            <th>Unidad y conductor</th>
            <th>Llegada estimada</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td data-label="Carga"><strong className={styles.requestId}>{request.id}</strong><span>{request.cargoSummary}</span></td>
              <td data-label="Ruta"><strong>{request.origin} → {request.destination}</strong><span>{request.corridorNote ?? request.cargoDetail}</span></td>
              <td data-label="Unidad y conductor"><strong>{request.vehicleCode}</strong><span>{request.driver}</span></td>
              <td data-label="Llegada estimada"><strong>{request.eta}</strong><span>Recojo · {request.pickupDate}</span></td>
              <td data-label="Estado"><StatusBadge status={request.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
