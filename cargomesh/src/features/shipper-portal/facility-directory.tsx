"use client";

import { Clock3, MapPin, Search, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { FacilityV2 } from "@/shared/schemas/v2/facilities";
import styles from "./shipper-portal.module.css";

export function FacilityDirectory({ facilities }: { facilities: FacilityV2[] }) {
  const { localeTag, t } = useLocale();
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(localeTag);
    return facilities.filter((facility) => (!activeOnly || facility.value.active) && (!needle || [
      facility.value.name, facility.value.code, facility.value.facilityType, facility.value.location.label,
      facility.value.location.city, facility.value.location.region, facility.value.location.countryCode,
    ].some((value) => value?.toLocaleLowerCase(localeTag).includes(needle))));
  }, [activeOnly, facilities, localeTag, query]);

  return <><div className={styles.toolbar}>
    <label className={styles.search}><Search size={16} aria-hidden="true"/><span className="sr-only">{t("Buscar sedes", "Search facilities")}</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Nombre, código, ciudad o dirección…", "Name, code, city, or address…")}/></label>
    <div className={styles.filters}><button className={styles.filter} type="button" aria-pressed={!activeOnly} onClick={() => setActiveOnly(false)}>{t("Todas", "All")}</button>
      <button className={styles.filter} type="button" aria-pressed={activeOnly} onClick={() => setActiveOnly(true)}>{t("Sólo activas", "Active only")}</button></div>
  </div>
  {visible.length ? <div className={styles.facilityGrid}>{visible.map((facility) => <article className={styles.facility} key={facility.id}><div className={styles.facilityHead}><div><h2>{facility.value.name}</h2><p>{facility.value.code} · {facility.value.facilityType}</p></div><span className={styles.status} data-tone={facility.value.active ? "positive" : "neutral"}>{facility.value.active ? t("Activa", "Active") : t("Inactiva", "Inactive")}</span></div>
    <p><MapPin size={14}/> {facility.value.location.label}, {facility.value.location.city}</p>
    <div className={styles.metaLine}><span><Clock3 size={13}/> {facility.value.operatingHours?.timezone ?? t("Horario desconocido", "Schedule unknown")}</span><span>v{facility.version}</span></div>
    {facility.value.accessRestrictions.length ? <p>{facility.value.accessRestrictions.map((rule) => rule.description).join(" · ")}</p> : <p>{t("Sin restricciones de acceso registradas.", "No access restrictions recorded.")}</p>}</article>)}</div>
  : <div className={styles.empty} role="status"><span className={styles.emptyIcon}><Warehouse size={22}/></span><strong>{t("No hay sedes que coincidan", "No matching facilities")}</strong><p>{t("Cambia la búsqueda o el filtro. Nunca se inventa un facilityId.", "Change the search or filter. A facilityId is never invented.")}</p></div>}</>;
}
