import { PackagePlus } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { RequestList } from "@/features/shipper-portal/request-list";
import { getRequestLocale } from "@/server/i18n/server";
import { translate } from "@/features/i18n/config";
import { operationsReader } from "@/server/services/v2-workspace/operations-server";
import { operationsReadIssues } from "@/server/services/v2-workspace/operations-collection";
import { OperationsNavigation, OperationsReadNotice, OperationsCollectionNotice } from "@/features/shipper-portal/operations-navigation";
import { parseOperationsQuery } from "@/features/shipper-portal/operations-query";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; offset?: string }> }) {
  const [reader, locale, query] = await Promise.all([operationsReader(), getRequestLocale(), searchParams]);
  const { offset } = parseOperationsQuery(new URLSearchParams({ offset: query.offset ?? "0" }));
  const requests = await reader.requests(offset);
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}>
    <h1>{t("Mis cargas", "My shipments")}</h1></div>
    <Link className={styles.primary} href="/freight-request/new"><PackagePlus size={17}/>{t("Nueva solicitud", "New request")}</Link></header>
    <OperationsNavigation/>
    <OperationsReadNotice issues={operationsReadIssues({ requests })}/>
    <OperationsCollectionNotice collection={requests} paginate/>
    <RequestList requests={requests.data} />
  </div>;
}
