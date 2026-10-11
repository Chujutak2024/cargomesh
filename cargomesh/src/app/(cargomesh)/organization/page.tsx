import { Building2, ShieldCheck } from "lucide-react";
import { translate } from "@/features/i18n/config";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { getRequestLocale } from "@/server/i18n/server";
import styles from "../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function OrganizationPage() {
  const [member, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  const db = await createV2ServerSupabaseClient();
  const { data, error } = await db.from("organizations").select("name,status").eq("id", member.organizationId).single();
  if (error || !data) throw new Error("ORGANIZATION_UNAVAILABLE");
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}><Building2 size={15} aria-hidden="true" />{t("Organización", "Organization")}</span>
      <h1>{t("Tu espacio de trabajo", "Your workspace")}</h1>
      <p>{t("Información de la organización autenticada. Las sedes, solicitudes y operaciones visibles pertenecen a este tenant.", "Information for the authenticated organization. Visible facilities, requests, and operations belong to this tenant.")}</p></div></header>
    <section className={styles.panel} aria-label={t("Identidad de la organización", "Organization identity")}>
      <div className={styles.identity}><span className={styles.identityIcon}><Building2 size={22} aria-hidden="true" /></span><div><h2>{data.name}</h2><p>{t("Datos obtenidos de la sesión V2", "Data from the V2 session")}</p></div></div>
      <dl className={styles.facts}><div><dt>{t("Estado", "Status")}</dt><dd>{data.status}</dd></div><div><dt>{t("Tu rol", "Your role")}</dt><dd><ShieldCheck size={16} aria-hidden="true" /> {member.role}</dd></div></dl>
    </section>
  </div>;
}
