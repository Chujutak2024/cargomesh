import { Boxes, Warehouse } from "lucide-react";
import { getRequestLocale } from "@/server/i18n/server";
import { translate } from "@/features/i18n/config";
import { listWorkspaceCatalog, listWorkspaceFacilities } from "@/server/services/v2-workspace/workspace-server";
import { FacilityDirectory } from "@/features/shipper-portal/facility-directory";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const [facilities, profiles, locale] = await Promise.all([
    listWorkspaceFacilities(), listWorkspaceCatalog("cargo-profiles"), getRequestLocale(),
  ]);
  const t = (es: string, en: string) => translate(locale, es, en);
  return <div className={styles.page}><header className={styles.hero}><div className={styles.heroCopy}>
    <span className={styles.eyebrow}>{t("Datos de la organización", "Organization data")}</span><h1>{t("Sedes y perfiles de carga", "Facilities and cargo profiles")}</h1>
    <p>{t("Las sedes seleccionadas usan su ubicación canónica persistida. Su existencia no confirma cobertura, capacidad, precio ni reserva.", "Selected facilities use their persisted canonical location. Their existence does not confirm coverage, capacity, price, or booking.")}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Sedes propias", "Owned facilities")}</h2><p>{facilities.length} {t("registros visibles", "visible records")}</p></div><Warehouse size={19}/></header>
      <FacilityDirectory facilities={facilities}/></section>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Perfiles reutilizables", "Reusable profiles")}</h2><p>{t("Sólo precargan datos de tu tenant; siempre se revalidan.", "They only prefill data from your tenant; they are always revalidated.")}</p></div><Boxes size={19}/></header>
      {profiles.length ? <div className={styles.facilityGrid}>{profiles.map((profile) => {
        const value = profile.value as { name: string; active: boolean; requirements: string[]; preferredEquipment: string | null; typicalUnits: unknown[] };
        return <article className={styles.facility} key={profile.id}><div className={styles.facilityHead}><h2>{value.name}</h2><span className={styles.status} data-tone={value.active ? "positive" : "neutral"}>{value.active ? t("Activo", "Active") : t("Inactivo", "Inactive")}</span></div>
          <p>{value.typicalUnits.length} {t("tipos de unidad", "unit templates")} · {value.preferredEquipment ?? t("Equipo sin preferencia", "No equipment preference")}</p><div className={styles.metaLine}>{value.requirements.map((item) => <span key={item}>{item}</span>)}</div></article>;
      })}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><Boxes size={22}/></span><strong>{t("Sin perfiles de carga", "No cargo profiles")}</strong><p>{t("Puedes completar la solicitud manualmente sin asumir datos.", "You can complete the request manually without assuming data.")}</p></div>}</section>
  </div>;
}
