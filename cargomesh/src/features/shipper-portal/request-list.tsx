"use client";

import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { formatDateTime, formatMass, requestStatusLabel, requestStatusTone } from "./shipper-model";
import styles from "./shipper-portal.module.css";

type Filter = "ALL" | FreightRequestV2Data["status"];
type Sort = "UPDATED_DESC" | "UPDATED_ASC" | "PICKUP_ASC";

export function RequestList({ requests, initialQuery = "" }: { requests: FreightRequestV2Data[]; initialQuery?: string }) {
  const { locale, localeTag, t } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("UPDATED_DESC");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(localeTag);
    return requests.filter((request) => (filter === "ALL" || request.status === filter)
      && (!needle || [request.referenceCode, request.origin.label, request.destination.label,
        request.origin.city, request.destination.city, request.cargoSpecification.description, request.status,
        request.updatedAt, formatDateTime(request.updatedAt, localeTag)].some((value) => value.toLocaleLowerCase(localeTag).includes(needle))))
      .sort((left, right) => sort === "UPDATED_DESC" ? Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
        : sort === "UPDATED_ASC" ? Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
        : Date.parse(left.pickupWindow.startsAt) - Date.parse(right.pickupWindow.startsAt));
  }, [filter, localeTag, query, requests, sort]);
  const filters: Filter[] = ["ALL", "DRAFT", "AWAITING_SELECTION", "BOOKING", "BOOKED", "FAILED", "CANCELLED"];

  return <section className={styles.panel} aria-labelledby="request-list-title">
    <header className={styles.panelHeader}><div><h2 id="request-list-title">{t("Solicitudes de tu organización", "Your organization requests")}</h2>
      <p>{t("Sólo datos visibles para el tenant autenticado.", "Only data visible to the authenticated tenant.")}</p></div><SlidersHorizontal size={18} aria-hidden="true" /></header>
    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={16} aria-hidden="true" /><span className="sr-only">{t("Buscar solicitudes", "Search requests")}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Código, ciudad o carga…", "Code, city, or cargo…")} /></label>
      <div className={styles.toolbarActions}><div className={styles.filters} aria-label={t("Filtrar por estado", "Filter by status")}>{filters.map((status) => <button
          className={styles.filter} type="button" key={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>
          {status === "ALL" ? t("Todas", "All") : requestStatusLabel(status, locale)}
        </button>)}</div>
        <label className={styles.sort}><ArrowUpDown size={14} aria-hidden="true"/><span className="sr-only">{t("Ordenar solicitudes", "Sort requests")}</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="UPDATED_DESC">{t("Más recientes", "Newest first")}</option><option value="UPDATED_ASC">{t("Más antiguas", "Oldest first")}</option><option value="PICKUP_ASC">{t("Próximo recojo", "Next pickup")}</option>
        </select></label></div>
    </div>
    {visible.length ? <div className={styles.list}>{visible.map((request) => <Link className={styles.row} href={`/requests/${request.id}`} key={request.id}>
      <span className={styles.stack}><strong>{request.referenceCode}</strong><small>{formatDateTime(request.updatedAt, localeTag)}</small></span>
      <span className={styles.stack}><strong>{request.origin.city} → {request.destination.city}</strong><span>{request.origin.label} → {request.destination.label}</span></span>
      <span className={styles.stack}><strong>{formatMass(request.cargoSpecification.totalWeightKg, localeTag)} · {request.cargoSpecification.totalVolumeM3.toLocaleString(localeTag)} m³</strong><small>{request.cargoSpecification.description}</small></span>
      <span className={styles.status} data-tone={requestStatusTone(request.status)}>{requestStatusLabel(request.status, locale)}</span>
    </Link>)}</div> : <div className={styles.empty} role="status"><Search className={styles.emptyIcon} size={24} /><strong>{t("No hay coincidencias", "No matches")}</strong><p>{t("Cambia la búsqueda o el filtro. Los errores de API nunca se sustituyen por fixtures.", "Change the search or filter. API errors are never replaced by fixtures.")}</p></div>}
  </section>;
}
