import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { Info } from "lucide-react";
import { translate } from "@/features/i18n/config";
import { requireDemoPageAccess as requireOperationalRouteAccess } from "@/server/demo/access";
import { getRequestLocale } from "@/server/i18n/server";
import styles from "../operational-page.module.css";
export default async function HelpPage() {
  const [, locale] = await Promise.all([requireOperationalRouteAccess(), getRequestLocale()]);
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}>
    <header className={styles.header}><div>
      <h1>{t("Tu flujo de transporte V2", "Your V2 shipping flow")}</h1>
      <p>{t("De la solicitud al seguimiento, siempre con datos autorizados y estados verificables.", "From request to tracking, always with authorized data and verifiable states.")}</p></div></header>
    <section className={styles.panel} aria-label={t("Pasos del flujo", "Flow steps")}>
      <ol className={styles.guideList}>
        <li><span><Link href="/freight-request/new">{t("Crea una solicitud", "Create a request")}</Link> {t("con sedes, carga, unidades, equipo y ventanas revisables; el asistente comparte el mismo borrador local.", "with facilities, cargo, units, equipment, and editable windows; the assistant shares the same local draft.")}</span></li>
        <li><span>{t("Confirma la creación del DRAFT y consulta la evaluación ROAD preliminar. UNKNOWN no equivale a capacidad confirmada.", "Confirm creation of the DRAFT and review preliminary ROAD serviceability. UNKNOWN never means confirmed capacity.")}</span></li>
        <li><span><Link href="/requests">{t("Mis cargas", "My shipments")}</Link> {t("muestra solamente solicitudes de tu organización. Compara ofertas reales y autoriza el booking con consentimiento explícito.", "shows only your organization's requests. Compare real offers and authorize booking with explicit consent.")}</span></li>
        <li><span><Link href="/tracking">{t("Seguimiento", "Tracking")}</Link> {t("presenta eventos e incidencias reportados; el mapa y el visor 3D nunca simulan GPS en vivo.", "shows reported events and incidents; the map and 3D viewer never simulate live GPS.")}</span></li>
      </ol>
      <p className={styles.callout}><Info size={17} aria-hidden="true" />{t("Si faltan ofertas, geometría o ejecución, verás un estado vacío o desconocido. No se crean datos ficticios para completar el flujo.", "If offers, geometry, or execution data are missing, you will see an empty or unknown state. No fictional data is created to fill the flow.")}</p>
    </section>
  </div>;
}
