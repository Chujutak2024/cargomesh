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
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><Route size={15} /> Smart Dispatch</span>
          <h1>{translate(locale, "Bandeja de despachos", "Dispatch queue")}</h1>
          <p>{translate(locale, "Corridas persistidas y progreso real por provider. La selección siempre requiere una acción humana explícita.", "Persisted runs and actual progress by provider. Selection always requires an explicit human action.")}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link className={styles.primary} href="/dispatch/FR-1042?scenario=three">
            ⚡ {translate(locale, "Evaluación canónica FR-1042", "Canonical evaluation FR-1042")}
          </Link>
        </div>
      </header>
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2>{translate(locale, "Evaluaciones", "Evaluations")}</h2>
          <span className={styles.status}>{runs.length}</span>
        </header>
        {runs.length ? (
          <div className={styles.list}>
            {runs.map((run) => (
              <Link className={styles.row} href={`/dispatch/${run.id}`} key={run.id}>
                <span className={styles.stack}><strong>{run.requestCode}</strong><small>{run.runType}</small></span>
                <span className={styles.stack}><strong>{translate(locale, "Providers considerados", "Providers considered")}</strong><small>{run.candidateCount}</small></span>
                <span className={styles.stack}><strong>{fmt.format(new Date(run.startedAt))}</strong><small>{run.completedAt ? translate(locale, "Finalizada", "Completed") : translate(locale, "En progreso", "In progress")}</small></span>
                <span className={styles.status}>{run.status}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <Route size={32} />
            <strong>{translate(locale, "Aún no hay despachos en cola", "No dispatch runs yet")}</strong>
            <p>
              {translate(
                locale,
                "Las corridas aparecerán aquí después de enviar una carga a evaluación desde el intake, o puedes explorar directamente la corrida de evaluación con los 3 carriers WebMCP.",
                "Runs will appear here after sending a shipment for evaluation from the intake, or you can directly explore the evaluation run with all 3 WebMCP carriers.",
              )}
            </p>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
              <Link className={styles.primary} href="/dispatch/FR-1042?scenario=three">
                ⚡ {translate(locale, "Ver evaluación canónica FR-1042 (3 carriers)", "View canonical FR-1042 evaluation (3 carriers)")}
              </Link>
              <Link className={styles.secondary} href="/freight-request/new?requestCode=FR-1042">
                📝 {translate(locale, "Ir al Intake de solicitud", "Go to shipment intake")}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
