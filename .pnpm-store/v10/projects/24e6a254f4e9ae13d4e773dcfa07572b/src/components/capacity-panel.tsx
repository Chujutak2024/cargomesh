import { Warehouse } from "lucide-react";
import type { LogisticsCapacity } from "@/features/freight-ui/view-models";
import styles from "./capacity-panel.module.css";

export function CapacityPanel({ centers }: { centers: LogisticsCapacity[] }) {
  return (
    <div className={styles.list}>
      {centers.map((center) => (
        <article key={center.id}>
          <div className={styles.heading}>
            <span><Warehouse size={14} aria-hidden="true" /> {center.name}</span>
            <strong>{center.usedPercent}%</strong>
          </div>
          <div className={styles.track} aria-label={`Ocupación de ${center.name}: ${center.usedPercent}%`}>
            <span style={{ width: `${center.usedPercent}%` }} />
          </div>
          <p>{center.availableDocks} andenes disponibles</p>
        </article>
      ))}
    </div>
  );
}
