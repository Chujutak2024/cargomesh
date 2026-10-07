import { Clock3, Gauge, MapPin, Navigation, Truck } from "lucide-react";
import type { TrackingMapModel } from "@/features/freight-ui/view-models";
import styles from "./live-tracking-map.module.css";

export function LiveTrackingMap({ model }: { model: TrackingMapModel }) {
  const vehicleCount = model.vehicles.length;
  const unitsInRoute = `${vehicleCount} ${vehicleCount === 1 ? "unidad" : "unidades"} en ruta`;
  const hubLabels = model.hubs.map((hub) => hub.label);
  const hubContext = hubLabels.length > 1
    ? `entre ${hubLabels.slice(0, -1).join(", ")} y ${hubLabels[hubLabels.length - 1]}`
    : hubLabels.length === 1
      ? `en ${hubLabels[0]}`
      : "";
  const mapDescription = `Mapa operativo con ${unitsInRoute}${hubContext ? ` ${hubContext}` : ""}`;

  return (
    <div className={styles.map} role="img" aria-label={mapDescription}>
      <div className={styles.mapMeta}>
        <span><span className={styles.liveDot} aria-hidden="true" /> Actualización en vivo</span>
        <span>{unitsInRoute}</span>
      </div>

      <svg className={styles.canvas} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.coast} d="M1 10 C18 14 13 36 28 43 C39 49 33 69 49 75 C64 82 76 77 99 92" />
        <path className={styles.road} d="M-5 82 C20 66 19 33 46 24 C64 18 78 8 105 12" />
        <path className={styles.road} d="M8 4 C27 26 44 36 58 57 C72 78 88 75 102 70" />
        <path className={styles.roadMinor} d="M7 58 C25 47 47 49 62 38 C77 28 87 31 102 40" />
        <path className={styles.roadMinor} d="M26 100 C32 76 56 70 61 48 C67 24 58 12 66 -2" />
        <path className={styles.routeHalo} d="M22 27 C31 32 34 41 43 45 C50 49 50 56 55 61 C61 66 65 69 68 68 C73 68 76 72 81 76" />
        <path className={styles.route} d="M22 27 C31 32 34 41 43 45 C50 49 50 56 55 61 C61 66 65 69 68 68 C73 68 76 72 81 76" />
      </svg>

      {model.hubs.map((hub) => (
        <div className={styles.hub} key={hub.id} style={{ left: `${hub.x}%`, top: `${hub.y}%` }}>
          <span className={styles.hubPin}><MapPin size={13} /></span>
          <strong>{hub.label}</strong>
        </div>
      ))}

      {model.vehicles.map((vehicle) => (
        <div className={`${styles.vehicleMarker} ${vehicle.selected ? styles.vehicleSelected : ""}`} key={vehicle.id} style={{ left: `${vehicle.x}%`, top: `${vehicle.y}%` }}>
          <Truck size={15} aria-hidden="true" />
          <span>{vehicle.code}</span>
        </div>
      ))}

      <article className={styles.detailCard}>
        <div className={styles.detailTop}>
          <span className={styles.detailIcon}><Truck size={17} /></span>
          <span><small>Unidad seleccionada</small><strong>{model.selectedVehicle.code}</strong></span>
          <span className={styles.status}>En ruta</span>
        </div>
        <p><Navigation size={13} aria-hidden="true" /> {model.selectedVehicle.route}</p>
        <dl>
          <div><dt><Gauge size={13} /> Velocidad</dt><dd>{model.selectedVehicle.speed}</dd></div>
          <div><dt><Clock3 size={13} /> Llegada estimada</dt><dd>{model.selectedVehicle.eta}</dd></div>
        </dl>
        <span className={styles.driver}>Conductor · {model.selectedVehicle.driver}</span>
      </article>
    </div>
  );
}
