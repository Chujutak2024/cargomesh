import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { RequestDirectory } from "@/components/request-directory";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { getOrganizationDashboard } from "@/features/dashboard/dashboard-server";
import { getRequestLocale } from "@/features/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import styles from "../operational-page.module.css";

export const dynamic = "force-dynamic";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [member, locale, query] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale(), searchParams]);
  const dashboard = await getOrganizationDashboard(member, localeTag(locale));
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}><ClipboardList size={15} /> FreightRequest</span><h1>{translate(locale, "Mis cargas", "My shipments")}</h1><p>{translate(locale, "Solicitudes reales de la organización activa. Abre cada fila para continuar en su etapa persistida.", "Real requests for the active organization. Open a row to continue at its persisted stage.")}</p></div>
      <Link className={styles.primary} href="/freight-request/new"><Plus size={17} />{translate(locale, "Nueva carga", "New shipment")}</Link>
    </header>
    <RequestDirectory requests={dashboard.requests} initialQuery={Array.isArray(query.q) ? query.q[0] : query.q} />
  </div>;
}
