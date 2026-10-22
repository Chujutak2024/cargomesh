"use client";
import {displayReference,locationDisplayLabel,cargoDisplayDescription} from '@/shared/lib/display-identity';

import { ArrowUpDown, Search } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { formatDateTime, formatMass, requestStatusLabel, requestStatusTone } from "./shipper-model";
import styles from "./shipper-portal.module.css";
import operationsStyles from "./operations.module.css";
import { filterOperationRequests, operationDetailHref, operationStatuses, operationView, operationsSearch, operationsHistoryState, parseOperationsQuery, type OperationsQuery } from "./operations-query";

export function RequestList({ requests }: { requests: FreightRequestV2Data[]; initialQuery?: string }) {
  const { locale, localeTag, t } = useLocale();
  const params = useSearchParams(), pathname = usePathname();
  // URL is the source of presentation state, including browser Back/Forward and reload.
  // initialQuery remains accepted for existing preview consumers; the live URL takes precedence.
  const query = parseOperationsQuery(params);
  const [searchText, setSearchText] = useState(query.q);
  useEffect(() => setSearchText(query.q), [query.q]);
  const selectedRow = useRef<HTMLAnchorElement | null>(null);
  const view = operationView(pathname);
  function update(patch: Partial<OperationsQuery>) {
    const next = { ...parseOperationsQuery(new URLSearchParams(window.location.search)), ...patch };
    const serialized = new URLSearchParams(operationsSearch(next));
    const merged = new URLSearchParams(window.location.search);
    for (const name of ["q", "status", "sort", "from", "to", "selected", "offset", "view"]) merged.delete(name);
    serialized.forEach((value, name) => merged.set(name, value));
    window.history.replaceState(operationsHistoryState(window.history.state), "", `${pathname}${merged.size ? `?${merged}` : ""}${window.location.hash}`);
  }
  const visible = useMemo(() => filterOperationRequests(requests, query, localeTag, value => formatDateTime(value, localeTag)),
    [requests, params, localeTag]);
  useEffect(() => {
    selectedRow.current?.focus({ preventScroll: true });
  }, [query.selected]);

  return <section className={styles.panel} aria-labelledby="request-list-title">
    <header className={styles.panelHeader}><div><h2 id="request-list-title">{t("Solicitudes de tu organización", "Your organization requests")}</h2>
      </div></header>
    <div className={styles.toolbar}>
      <label className={styles.search}>
  <Search size={16} aria-hidden="true" />
  <input
    type="search"
    aria-label={t("Buscar solicitudes", "Search requests")}
    value={searchText}
    maxLength={200}
    onChange={(event) => { setSearchText(event.target.value); update({ q: event.target.value }); }}
    placeholder={t("Código, ciudad o carga…", "Code, city, or cargo…")}
  />
</label>
      <div className={styles.toolbarActions}><div className={styles.filters} aria-label={t("Filtrar por estado", "Filter by status")}>{operationStatuses.map((status) => <button
          className={styles.filter} type="button" key={status} aria-pressed={query.status === status} onClick={() => update({ status })}>
          {status === "ALL" ? t("Todas", "All") : requestStatusLabel(status, locale)}
        </button>)}</div>
        <label className={styles.sort}>
  <ArrowUpDown size={14} aria-hidden="true" />
  <select
    aria-label={t("Ordenar solicitudes", "Sort requests")}
    value={query.sort}
    onChange={(event) => update({ sort: event.target.value as OperationsQuery["sort"] })}
  >
          <option value="UPDATED_DESC">{t("Más recientes", "Newest first")}</option><option value="UPDATED_ASC">{t("Más antiguas", "Oldest first")}</option><option value="PICKUP_ASC">{t("Próximo recojo", "Next pickup")}</option>
        </select></label></div>
      <div className={styles.dateFilters}><label>{t("Actualizada desde (UTC)", "Updated from (UTC)")}<input type="date" value={query.from} onChange={(event) => update({ from: event.target.value, to: query.to && query.to < event.target.value ? "" : query.to })}/></label><label>{t("Hasta (UTC)", "To (UTC)")}<input type="date" min={query.from || undefined} value={query.to} onChange={(event) => update({ to: event.target.value })}/></label>
        <button className={operationsStyles.reset} type="button" onClick={() => update({ q: "", status: "ALL", sort: "UPDATED_DESC", from: "", to: "" })}>{t("Limpiar filtros", "Clear filters")}</button>
        <span role="status">{visible.length} / {requests.length} {t("solicitudes cargadas", "loaded requests")}</span></div>
    </div>
    {visible.length ? <div className={styles.list}>{visible.map((request) => <Link className={`${styles.row} ${query.selected === request.id ? operationsStyles.selected : ""}`}
      ref={query.selected === request.id ? selectedRow : undefined} aria-current={query.selected === request.id ? "true" : undefined}
      onClick={() => update({ selected: request.id })} href={operationDetailHref(request.id, query, view)} key={request.id}>
      <span className={styles.stack}><strong>{displayReference(request.referenceCode,'PED',request.id)}</strong><small>{t("Actualizada", "Updated")} {formatDateTime(request.updatedAt, localeTag)} · v{request.draftVersion}</small><small>{t("Creada", "Created")} {formatDateTime(request.createdAt, localeTag)}</small></span>
      <span className={styles.stack}><strong>{locationDisplayLabel(request.origin.city)} → {locationDisplayLabel(request.destination.city)}</strong><span>{locationDisplayLabel(request.origin.label)} → {locationDisplayLabel(request.destination.label)}</span>
        <small>{t("Recojo", "Pickup")}: {formatDateTime(request.pickupWindow.startsAt, localeTag)} – {formatDateTime(request.pickupWindow.endsAt, localeTag)}</small>
        <small>{t("Entrega", "Delivery")}: {formatDateTime(request.deliveryWindow.startsAt, localeTag)} – {formatDateTime(request.deliveryWindow.endsAt, localeTag)}</small></span>
      <span className={styles.stack}><strong>{formatMass(request.cargoSpecification.totalWeightKg, localeTag)} · {request.cargoSpecification.totalVolumeM3.toLocaleString(localeTag)} m³</strong><small>{cargoDisplayDescription(request.cargoSpecification.description,request.cargoSpecification.categoryCode)}</small></span>
      <span className={styles.status} data-tone={requestStatusTone(request.status)}>{requestStatusLabel(request.status, locale)}</span>
    </Link>)}</div> : <div className={styles.empty} role="status"><Search className={styles.emptyIcon} size={24} /><strong>{requests.length ? t("Sin coincidencias en los registros cargados", "No matches in loaded records") : t("No hay solicitudes cargadas", "No requests loaded")}</strong><p>{t("Prueba otros filtros o revisa el estado de lectura y la paginación.", "Try different filters or check read status and pagination.")}</p></div>}
  </section>;
}
