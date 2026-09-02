import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { localeTag, translate } from "@/features/i18n/config";
import { getRequestLocale } from "@/features/i18n/server";
import { getExceptions } from "@/features/operations/operations-server";
import styles from "../../operational-page.module.css";

export const dynamic = "force-dynamic";
export default async function ExceptionsPage() {
  const [member, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  const items = await getExceptions(member); const fmt = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" });
  return <div className={styles.page}><header className={styles.header}><div><span className={styles.eyebrow}><ShieldAlert size={15}/> review</span><h1>{translate(locale, "Excepciones", "Exceptions")}</h1><p>{translate(locale, "Rechazos, expiraciones, fallos y resultados sin coincidencia que requieren una decisión válida.", "Rejections, expirations, failures, and no-match outcomes requiring a valid decision.")}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><h2>{translate(locale, "Pendientes de revisión", "Pending review")}</h2><span className={styles.status}>{items.length}</span></header>{items.length ? <div className={styles.list}>{items.map((item) => <Link className={styles.row} href={item.href} key={`${item.kind}-${item.id}`}><span className={styles.stack}><strong>{item.requestCode}</strong><small>{item.kind}</small></span><span>{item.detail}</span><small>{fmt.format(new Date(item.updatedAt))}</small><span className={styles.status}>{translate(locale, "Revisar", "Review")}</span></Link>)}</div> : <div className={styles.empty}><ShieldAlert size={28}/><strong>{translate(locale, "Sin excepciones persistidas", "No persisted exceptions")}</strong><p>{translate(locale, "No hay rechazos, expiraciones, fallos ni corridas NO_MATCH visibles para esta organización.", "There are no visible rejections, expirations, failures, or NO_MATCH runs for this organization.")}</p></div>}</section>
  </div>;
}
