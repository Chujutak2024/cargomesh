import {
  ArrowUpRight,
  CircleCheckBig,
  Clock3,
  PackageCheck,
  Plus,
  Truck,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { CapacityPanel } from "@/components/capacity-panel";
import { LiveTrackingMap } from "@/components/live-tracking-map";
import { RequestTable } from "@/components/request-table";
import { VehicleStatusPanel } from "@/components/vehicle-status-panel";
import {
  dashboardSummaryFixture,
  freightRequestsFixture,
  logisticsCapacityFixture,
  trackingMapFixture,
  vehiclesFixture,
} from "@/features/freight-ui/ui-fixtures";
import styles from "./page.module.css";

const availableVehicles = vehiclesFixture.filter((vehicle) => vehicle.status === "AVAILABLE").length;

const metrics = [
  {
    label: "Cargas activas",
    value: dashboardSummaryFixture.activeRequests,
    detail: "1 requiere selección",
    trend: "+12% esta semana",
    icon: PackageCheck,
    tone: "turquoise",
  },
  {
    label: "En tránsito",
    value: dashboardSummaryFixture.activeShipments,
    detail: "Sin incidencias críticas",
    trend: "Operación estable",
    icon: Truck,
    tone: "green",
  },
  {
    label: "Vehículos disponibles",
    value: availableVehicles,
    detail: "4 unidades monitoreadas",
    trend: "Listo para asignar",
    icon: Warehouse,
    tone: "cream",
  },
  {
    label: "Entregas a tiempo",
    value: `${dashboardSummaryFixture.slaCompliance}%`,
    detail: "Últimos 30 días",
    trend: "+2.4% vs. periodo anterior",
    icon: CircleCheckBig,
    tone: "positive",
  },
];

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Sábado, 29 de agosto</span>
          <h1>Control de operaciones</h1>
          <p>Supervisa cargas, flota y capacidad logística desde una sola vista.</p>
        </div>
        <Link className={styles.primaryAction} href="/freight-request/new">
          <Plus size={17} aria-hidden="true" />
          <span>Nueva carga<small>Crear solicitud</small></span>
        </Link>
      </section>

      <section className={styles.metrics} aria-label="Indicadores operativos">
        {metrics.map(({ label, value, detail, trend, icon: Icon, tone }) => (
          <article className={styles.metricCard} key={label}>
            <div className={styles.metricTop}>
              <span className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className={styles.trend}><ArrowUpRight size={12} aria-hidden="true" /> {trend}</span>
            </div>
            <strong>{value}</strong>
            <div><span>{label}</span><small>{detail}</small></div>
          </article>
        ))}
      </section>

      <section className={styles.operationsGrid}>
        <article className={`${styles.panel} ${styles.trackingPanel}`}>
          <header className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>Red operativa</span><h2>Seguimiento en vivo</h2></div>
            <span className={styles.update}><Clock3 size={13} aria-hidden="true" /> Actualizado hace 2 min</span>
          </header>
          <LiveTrackingMap model={trackingMapFixture} />
        </article>

        <article className={`${styles.panel} ${styles.vehiclePanel}`}>
          <header className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>Flota</span><h2>Estado de vehículos</h2></div>
            <span className={styles.counter}>{vehiclesFixture.length}</span>
          </header>
          <VehicleStatusPanel vehicles={vehiclesFixture} />
        </article>
      </section>

      <section className={styles.dataGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>Actividad reciente</span><h2>Cargas recientes</h2></div>
            <span className={styles.update}>Vista de demostración</span>
          </header>
          <RequestTable requests={freightRequestsFixture} />
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>Infraestructura</span><h2>Capacidad logística</h2></div>
          </header>
          <CapacityPanel centers={logisticsCapacityFixture} />
        </article>
      </section>
    </div>
  );
}
