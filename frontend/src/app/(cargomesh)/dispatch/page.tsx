import { Route } from "lucide-react";
import Link from "next/link";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { getRequestLocale } from "@/features/i18n/server";
import { localeTag, translate } from "@/features/i18n/config";
import { getDispatchQueue } from "@/features/operations/operations-server";
import styles from "../operational-page.module.css";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const [member, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  const runs = await getDispatchQueue(member);
  const fmt = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" });
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}><Route size={15} /> Smart Dispatch</span><h1>{translate(locale, "Bandeja de despachos", "Dispatch queue")}</h1><p>{translate(locale, "Corridas persistidas y progreso real por provider. La selección siempre requiere una acción humana explícita.", "Persisted runs and actual progress by provider. Selection always requires an explicit human action.")}</p></div></header>
    <section className={styles.panel}>
      <header className={styles.panelHeader}><h2>{translate(locale, "Evaluaciones", "Evaluations")}</h2><span className={styles.status}>{runs.length}</span></header>
      {runs.length ? <div className={styles.list}>{runs.map((run) =>
        <Link className={styles.row} href={`/dispatch/${run.id}`} key={run.id}>
          <span className={styles.stack}><strong>{run.requestCode}</strong><small>{run.runType}</small></span>
          <span className={styles.stack}><strong>{translate(locale, "Providers considerados", "Providers considered")}</strong><small>{run.candidateCount}</small></span>
          <span className={styles.stack}><strong>{fmt.format(new Date(run.startedAt))}</strong><small>{run.completedAt ? translate(locale, "Finalizada", "Completed") : translate(locale, "En progreso", "In progress")}</small></span>
          <span className={styles.status}>{run.status}</span>
        </Link>)}</div> : <div className={styles.empty}><Route size={28} /><strong>{translate(locale, "Aún no hay despachos", "No dispatch runs yet")}</strong><p>{translate(locale, "Las corridas aparecerán aquí después de enviar una carga a evaluación.", "Runs will appear here after a shipment is sent for evaluation.")}</p></div>}
    </section>
  </div>;
}
