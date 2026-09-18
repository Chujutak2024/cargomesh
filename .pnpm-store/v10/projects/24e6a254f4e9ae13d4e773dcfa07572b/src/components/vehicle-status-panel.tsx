import { Clock3, Truck, UserRound } from "lucide-react";
import type { VehicleListItem, VehicleStatus } from "@/features/freight-ui/view-models";
import styles from "./vehicle-status-panel.module.css";

const statusLabel: Record<VehicleStatus, string> = {
  ACTIVE: "En ruta",
  AVAILABLE: "Disponible",
  MAINTENANCE: "Mantenimiento",
};

export function VehicleStatusPanel({ vehicles }: { vehicles: VehicleListItem[] }) {
  return (
    <div className={styles.list}>
      {vehicles.map((vehicle) => (
        <article className={styles.vehicle} key={vehicle.id}>
          <div className={styles.vehicleTop}>
            <span className={styles.icon}><Truck size={18} aria-hidden="true" /></span>
            <span className={styles.identity}><small>Unidad terrestre</small><strong>{vehicle.code}</strong></span>
            <span className={`${styles.badge} ${styles[vehicle.status]}`}>{statusLabel[vehicle.status]}</span>
          </div>
          <p>{vehicle.route}</p>
          <div className={styles.meta}>
            <span><UserRound size={13} aria-hidden="true" /> {vehicle.driver}</span>
            <span><Clock3 size={13} aria-hidden="true" /> {vehicle.eta}</span>
          </div>
          {vehicle.loadPercent > 0 ? (
            <div className={styles.load}>
              <span><small>Carga asignada</small><strong>{vehicle.loadPercent}%</strong></span>
              <div><i style={{ width: `${vehicle.loadPercent}%` }} /></div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
