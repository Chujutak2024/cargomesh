import { Building2, ShieldCheck } from "lucide-react";
import { translate } from "@/features/i18n/config";
import { requireDemoPageAccess as requireOperationalRouteAccess } from "@/server/demo/access";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { getRequestLocale } from "@/server/i18n/server";
import styles from "../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function OrganizationPage() {
  await requireOperationalRouteAccess(); const member = {role:"DEMO"}, locale = await getRequestLocale();
  const data={name:"Sample Shipper organization",status:"DEMO"};
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}>
    <header className={styles.header}><div>
      <h1>{t("Tu espacio de trabajo", "Your workspace")}</h1>
      <p>{t("Escenario visual simulado para revisar el diseño de Cliente.", "Simulated visual scenario for reviewing the Shipper design.")}</p></div></header>
    <section className={styles.panel} aria-label={t("Identidad de la organización", "Organization identity")}>
      <div className={styles.identity}><span className={styles.identityIcon}><Building2 size={22} aria-hidden="true" /></span><div><h2>{data.name}</h2><p>{t("Datos de ejemplo del preview", "Preview sample data")}</p></div></div>
      <dl className={styles.facts}><div><dt>{t("Estado", "Status")}</dt><dd>{data.status}</dd></div><div><dt>{t("Tu rol", "Your role")}</dt><dd><ShieldCheck size={16} aria-hidden="true" /> {member.role}</dd></div></dl>
    </section>
  </div>;
}
