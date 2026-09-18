import type { FreightRequestStatus } from "@/features/freight-ui/view-models";
import type { Locale } from "@/features/i18n/config";
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
const labelsEn: Record<FreightRequestStatus, string> = {
  DRAFT: "Draft", PENDING: "Pending", ORCHESTRATING: "Evaluating",
  AWAITING_SELECTION: "Select option", BOOKING: "Booking", BOOKED: "Booked",
  IN_TRANSIT: "In transit", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled",
};

export function StatusBadge({ status, locale = "es" }: { status: FreightRequestStatus; locale?: Locale }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {(locale === "en" ? labelsEn : labels)[status]}
    </span>
  );
}
