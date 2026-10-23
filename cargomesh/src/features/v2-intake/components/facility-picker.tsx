"use client";
import { displayDemoText, isHiddenClientFacility } from "@/shared/lib/demo-presentation";


import { Building2, Check, LocateFixed, MapPin, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Badge, Input } from "@/components/ui";
import type { IntakeFacilityOption } from "../contracts";
import { filterIntakeFacilities } from "../prototype-model";
import styles from "./facility-picker.module.css";

type Translate = (spanish: string, english: string) => string;

export function FacilityPicker({
  kind,
  facilities,
  value,
  excludedFacilityId,
  error,
  onChange,
  t,
}: {
  kind: "origin" | "destination";
  facilities: IntakeFacilityOption[];
  value: string;
  excludedFacilityId?: string;
  error?: string;
  onChange: (facilityId: string) => void;
  t: Translate;
}) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const visible = useMemo(
    () => filterIntakeFacilities(facilities.filter(f => !isHiddenClientFacility(f.code, f.facilityId)), query, excludedFacilityId),
    [excludedFacilityId, facilities, query],
  );
  const selected = facilities.find((facility) => facility.facilityId === value) ?? null;
  const origin = kind === "origin";

  return <section className={styles.picker} aria-labelledby={`${listId}-title`}>
    <header className={styles.header}>
      <span className={styles.kindIcon} data-kind={kind}><MapPin size={18} aria-hidden="true" /></span>
      <div><h3 id={`${listId}-title`}>{origin ? t("Origen", "Origin") : t("Destino", "Destination")}</h3></div>
      {selected ? <Badge tone="confirmed"><Check size={12} aria-hidden="true" />{t("Elegida", "Selected")}</Badge> : null}
    </header>

    <div className={styles.searchWrap}>
      <Search size={17} aria-hidden="true" />
      <Input
        fieldClassName={styles.searchField}
        label={origin ? t("Buscar sede de origen", "Search origin facility") : t("Buscar sede de destino", "Search destination facility")}
        type="search"
        role="combobox"
        aria-controls={listId}
        aria-expanded="true"
        autoComplete="off"
        placeholder={t("Código, sede, ciudad o región", "Code, facility, city, or region")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span className={styles.resultCount}>{visible.length}</span>
    </div>

    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.list} id={listId} role="listbox" aria-label={origin ? t("Sedes de origen", "Origin facilities") : t("Sedes de destino", "Destination facilities")}>
      {visible.map((facility) => {
        const active = facility.facilityId === value;
        const area = [facility.city, facility.region, facility.countryCode].filter(Boolean).join(" · ");
        const displayLabel = displayDemoText(facility.label) || facility.city;
        return <button
          className={styles.option}
          data-selected={active ? "true" : "false"}
          key={facility.facilityId}
          type="button"
          role="option"
          aria-selected={active}
          onClick={() => onChange(facility.facilityId)}
        >
          <span className={styles.facilityIcon}><Building2 size={18} aria-hidden="true" /></span>
          <span className={styles.optionCopy}><span className={styles.code}>{facility.code}</span><strong>{displayLabel}</strong><small>{area}</small></span>
          <span className={styles.geo} data-known={facility.lat != null ? "true" : "false"}><LocateFixed size={13} aria-hidden="true" />{facility.lat == null ? "UNKNOWN" : t("Canónica", "Canonical")}</span>
          <span className={styles.check} aria-hidden="true"><Check size={15} /></span>
        </button>;
      })}
      {!visible.length ? <div className={styles.empty} role="status"><Search size={20} aria-hidden="true" /><strong>{t("No encontramos coincidencias", "No matching facilities")}</strong><span>{t("Prueba con el código, nombre, ciudad o región del catálogo autorizado.", "Try the code, name, city, or region from the authorized catalog.")}</span></div> : null}
    </div>
  </section>;
}
