import {
  CircleCheckBig,
  Clock3,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { RequestTable } from "@/components/request-table";
import { OperationsMap } from "@/components/operations-map";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { getOrganizationDashboard } from "@/features/dashboard/dashboard-server";
import type { DashboardViewModel } from "@/features/dashboard/dashboard-view-model";
import { getRequestLocale } from "@/features/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function DashboardError({ locale }: { locale: "es" | "en" }) {
  return (
    <section className={styles.errorPanel} role="alert">
      <h1>{translate(locale, "No pudimos cargar el dashboard", "We could not load the dashboard")}</h1>
      <p>{translate(locale, "La consulta autenticada falló. Reintenta para recuperar los datos reales de tu organización.", "The authenticated query failed. Retry to recover your organization's real data.")}</p>
      <Link href="/dashboard">{translate(locale, "Reintentar", "Retry")}</Link>
    </section>
  );
}

export default async function DashboardPage() {
  const [member, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  let dashboard: DashboardViewModel & { map: import("@/components/operations-map").OperationsMapModel | null };
  try {
    dashboard = await getOrganizationDashboard(member, localeTag(locale));
  } catch {
    return <DashboardError locale={locale} />;
  }

  const metrics = [
    {
      label: translate(locale, "Cargas activas", "Active shipments"),
      value: dashboard.summary.activeRequests,
      detail: translate(locale, "Solicitudes abiertas", "Open requests"),
      icon: PackageCheck,
      tone: "turquoise",
    },
    {
      label: translate(locale, "Esperando selección", "Awaiting selection"),
      value: dashboard.summary.awaitingSelection,
      detail: translate(locale, "Requieren una decisión", "Require a decision"),
      icon: Clock3,
      tone: "cream",
    },
    {
      label: translate(locale, "En tránsito", "In transit"),
      value: dashboard.summary.inTransit,
      detail: translate(locale, "Bookings en movimiento", "Bookings in transit"),
      icon: Truck,
      tone: "green",
    },
    {
      label: translate(locale, "Completadas", "Completed"),
      value: dashboard.summary.completed,
      detail: translate(locale, "Bookings finalizados", "Completed bookings"),
      icon: CircleCheckBig,
      tone: "positive",
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{translate(locale, "Datos de la organización activa", "Active organization data")}</span>
          <h1>{translate(locale, "Control de operaciones", "Operations control")}</h1>
          <p>{translate(locale, "Consulta solicitudes, booking y eventos persistidos sin métricas de flota o capacidad simuladas.", "Review persisted requests, bookings, and events without simulated fleet or capacity metrics.")}</p>
        </div>
        <Link className={styles.primaryAction} href="/freight-request/new">
          <Plus size={17} aria-hidden="true" />
          <span>{translate(locale, "Nueva carga", "New shipment")}<small>{translate(locale, "Abrir intake", "Open intake")}</small></span>
        </Link>
      </section>

      <section className={styles.metrics} aria-label={translate(locale, "Indicadores derivados de solicitudes reales", "Indicators derived from real requests")}>
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
          <header className={styles.panelHeader}><div><span className={styles.eyebrow}>{translate(locale, "Ruta persistida", "Persisted route")}</span><h2>{translate(locale, "Mapa operativo", "Operations map")}</h2></div></header>
          <OperationsMap model={dashboard.map} />
        </article>
      </section>

      <section className={styles.dataGridSingle}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>{translate(locale, "Actividad persistida", "Persisted activity")}</span><h2>{translate(locale, "Solicitudes de la organización", "Organization requests")}</h2></div>
            <span className={styles.counter}>{dashboard.requests.length}</span>
          </header>
          <RequestTable requests={dashboard.requests} locale={locale} />
        </article>
      </section>
    </div>
  );
}
