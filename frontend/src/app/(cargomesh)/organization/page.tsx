import { Building2, CreditCard, ShieldCheck, Users } from "lucide-react";
import { OrganizationPolicies } from "@/components/organization-policies";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { translate } from "@/features/i18n/config";
import { getRequestLocale } from "@/features/i18n/server";
import { getOrganizationProfile } from "@/features/operations/operations-server";
import styles from "../operational-page.module.css";
import orgStyles from "./organization.module.css";

export const dynamic = "force-dynamic";
export default async function OrganizationPage() {
  const [member, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  const profile = await getOrganizationProfile(member); const org = profile.organization;
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}><Building2 size={15}/> tenant</span><h1>{org.name}</h1><p>{translate(locale, "Perfil corporativo, miembros y políticas persistidas de la organización activa.", "Corporate profile, members, and persisted policies for the active organization.")}</p></div><span className={styles.status}>{org.status}</span></header>
    <div className={styles.grid}>
      <section className={styles.info}><Building2 size={20}/><h2>{translate(locale, "Datos corporativos", "Corporate details")}</h2><dl className={orgStyles.details}><dt>{translate(locale, "Razón social", "Legal name")}</dt><dd>{org.legal_name ?? "—"}</dd><dt>{org.business_identifier_type ?? translate(locale, "Identificador", "Identifier")}</dt><dd>{org.business_identifier_value ?? "—"}</dd><dt>{translate(locale, "País", "Country")}</dt><dd>{org.country_code ?? "—"}</dd><dt>{translate(locale, "Correo verificado", "Verified email")}</dt><dd>{org.verified_corporate_email ?? "—"}</dd><dt>{translate(locale, "Teléfono", "Phone")}</dt><dd>{org.corporate_phone ?? "—"}</dd></dl></section>
      <section className={styles.info}><CreditCard size={20}/><h2>{translate(locale, "Facturación corporativa", "Corporate billing")}</h2><p>{profile.preferences?.billing_mode ?? translate(locale, "No configurada", "Not configured")}</p><p>{translate(locale, "Moneda predeterminada", "Default currency")}: <strong>{org.default_currency}</strong></p></section>
    </div>
    <section className={styles.panel}><header className={styles.panelHeader}><h2><ShieldCheck size={16}/> {translate(locale, "Políticas BALANCED", "BALANCED policies")}</h2><span className={styles.status}>{profile.currentRole}</span></header>{profile.preferences ? <OrganizationPolicies policies={profile.preferences} canEdit={profile.canEdit}/> : <div className={styles.empty}><strong>{translate(locale, "No hay políticas persistidas", "No persisted policies")}</strong></div>}</section>
    <section className={styles.panel}><header className={styles.panelHeader}><h2><Users size={16}/> {translate(locale, "Miembros", "Members")}</h2><span className={styles.status}>{profile.members.length}</span></header><div className={styles.list}>{profile.members.map((person) => <div className={styles.row} key={person.id}><span className={styles.stack}><strong>{person.display_name}</strong><small>{person.corporate_email}</small></span><span>{person.role}</span><span>{person.status}</span></div>)}</div></section>
  </div>;
}
