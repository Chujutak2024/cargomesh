import type { FreightRequestStatus } from "@/features/freight-ui/view-models";
import styles from "./status-badge.module.css";

const labels: Record<FreightRequestStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  ORCHESTRATING: "Evaluando",
  AWAITING_SELECTION: "Elegir opción",
  BOOKING: "Reservando",
  BOOKED: "Reservado",
  IN_TRANSIT: "En tránsito",
  COMPLETED: "Completado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

export function StatusBadge({ status }: { status: FreightRequestStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
