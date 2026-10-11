import { PackagePlus } from "lucide-react";
import Link from "next/link";
import { RequestList } from "@/features/shipper-portal/request-list";
import { getRequestLocale } from "@/server/i18n/server";
import { translate } from "@/features/i18n/config";
import { listWorkspaceRequests } from "@/server/services/v2-workspace/workspace-server";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [requests, locale, query] = await Promise.all([listWorkspaceRequests(), getRequestLocale(), searchParams]);
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}>
    <span className={styles.eyebrow}>{t("Solicitudes V2", "V2 requests")}</span><h1>{t("Mis cargas", "My shipments")}</h1>
    <p>{t("Borradores, solicitudes en orquestación y cargas reservadas de tu organización. Un estado desconocido nunca se convierte en confirmado.", "Drafts, requests in orchestration, and booked shipments for your organization. Unknown state is never converted into confirmed.")}</p></div>
    <Link className={styles.primary} href="/freight-request/new"><PackagePlus size={17}/>{t("Nueva solicitud", "New request")}</Link></header>
    <RequestList requests={requests} initialQuery={query.q ?? ""} />
  </div>;
}
