import type { FreightRequestStatus } from "@/features/freight-ui/view-models";
import styles from "./status-badge.module.css";

const labels: Record<FreightRequestStatus, string> = {
  PENDING: "Pendiente",
  AWAITING_SELECTION: "Elegir opción",
  BOOKED: "Reservado",
  IN_TRANSIT: "En tránsito",
  DELIVERED: "Entregado",
};

export function StatusBadge({ status }: { status: FreightRequestStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}

