import { Clock3, PackageCheck, Route, ShieldCheck } from "lucide-react";
import { RequestTable } from "@/components/request-table";
import {
  dashboardSummaryFixture,
  freightRequestsFixture,
} from "@/features/freight-ui/ui-fixtures";
import styles from "./page.module.css";

const metrics = [
  { label: "Solicitudes activas", value: dashboardSummaryFixture.activeRequests, icon: Route },
  { label: "Esperando selección", value: dashboardSummaryFixture.awaitingSelection, icon: Clock3 },
  { label: "Envíos en curso", value: dashboardSummaryFixture.activeShipments, icon: PackageCheck },
  { label: "Cumplimiento SLA", value: `${dashboardSummaryFixture.slaCompliance}%`, icon: ShieldCheck },
];

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Viernes, 29 de agosto</span>
          <h1>Buenos días, Carlos.</h1>
          <p>Supervisa tus solicitudes, decisiones y operaciones internacionales desde un solo lugar.</p>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Resumen operativo">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article className={styles.metricCard} key={label}>
            <div className={styles.metricIcon}><Icon size={18} strokeWidth={1.8} /></div>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.eyebrow}>Actividad reciente</span>
            <h2>Solicitudes de transporte</h2>
          </div>
        </div>
        <RequestTable requests={freightRequestsFixture} />
      </section>
    </div>
  );
}

