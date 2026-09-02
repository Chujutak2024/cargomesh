import {
  CircleCheckBig,
  Clock3,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { RequestTable } from "@/components/request-table";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { getOrganizationDashboard } from "@/features/dashboard/dashboard-server";
import type { DashboardViewModel } from "@/features/dashboard/dashboard-view-model";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function DashboardError() {
  return (
    <section className={styles.errorPanel} role="alert">
      <h1>No pudimos cargar el dashboard</h1>
      <p>La consulta autenticada falló. Reintenta para recuperar los datos reales de tu organización.</p>
      <Link href="/dashboard">Reintentar</Link>
    </section>
  );
}

export default async function DashboardPage() {
  const member = await requireOperationalRouteAccess();
  let dashboard: DashboardViewModel;
  try {
    dashboard = await getOrganizationDashboard(member);
  } catch {
    return <DashboardError />;
  }

  const metrics = [
    {
      label: "Cargas activas",
      value: dashboard.summary.activeRequests,
      detail: "Solicitudes abiertas",
      icon: PackageCheck,
      tone: "turquoise",
    },
    {
      label: "Esperando selección",
      value: dashboard.summary.awaitingSelection,
      detail: "Requieren una decisión",
      icon: Clock3,
      tone: "cream",
    },
    {
      label: "En tránsito",
      value: dashboard.summary.inTransit,
      detail: "Bookings en movimiento",
      icon: Truck,
      tone: "green",
    },
    {
      label: "Completadas",
      value: dashboard.summary.completed,
      detail: "Bookings finalizados",
      icon: CircleCheckBig,
      tone: "positive",
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Datos de la organización activa</span>
          <h1>Control de solicitudes</h1>
          <p>Consulta el estado persistido de tus cargas sin métricas, flota o capacidad simuladas.</p>
        </div>
        <Link className={styles.primaryAction} href="/freight-request/new">
          <Plus size={17} aria-hidden="true" />
          <span>Nueva carga<small>Abrir intake</small></span>
        </Link>
      </section>

      <section className={styles.metrics} aria-label="Indicadores derivados de solicitudes reales">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={styles.metricCard} key={label}>
            <div className={styles.metricTop}>
              <span className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
            </div>
            <strong>{value}</strong>
            <div><span>{label}</span><small>{detail}</small></div>
          </article>
        ))}
      </section>

      <section className={styles.dataGridSingle}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>Actividad persistida</span><h2>Solicitudes de la organización</h2></div>
            <span className={styles.counter}>{dashboard.requests.length}</span>
          </header>
          <RequestTable requests={dashboard.requests} />
        </article>
      </section>
    </div>
  );
}
