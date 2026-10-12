"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MapPinned, Search } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import { localeTag } from "@/features/i18n/config";
import { TrackingOverviewCard } from "./tracking-experience";
import { filterTrackingItems, matchesTrackingFilter, type TrackingFilter, type TrackingListItem } from "./tracking-presentation";
import s from "./tracking-experience.module.css";

export function TrackingList({ items }: { items: TrackingListItem[] }) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TrackingFilter>("all");
  const [sort, setSort] = useState<"recent" | "oldest">("recent");
  const visible = useMemo(() => filterTrackingItems(items, query, filter, sort), [items, query, filter, sort]);
  const filters: [TrackingFilter, string][] = [["all", t("Todos", "All")], ["active", t("En curso", "Active")], ["attention", t("Requieren atención", "Needs attention")], ["completed", t("Finalizados", "Completed")]];
  return <div className={s.page}>
    <header className={s.listHeader}><div><h1>{t("Seguimiento", "Tracking")}</h1><p>{t("Encuentra tu transporte y consulta su último reporte.", "Find your transport and its latest report.")}</p></div><Link className={s.heroAction} href="/bookings">{t("Ver reservas", "View bookings")}<ArrowRight size={16} aria-hidden="true"/></Link></header>
    {items.length ? <>
      <div className={s.filterRow} role="group" aria-label={t("Filtrar transportes", "Filter transports")}>{filters.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{items.filter((item) => matchesTrackingFilter(item, value)).length}</span></button>)}</div>
      <div className={s.searchRow}><label className={s.searchField}><Search size={18} aria-hidden="true"/><span className={s.srOnly}>{t("Buscar transporte", "Search transports")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Buscar por referencia, ruta o ubicación", "Search by reference, route or location")}/></label><label className={s.sortField}>{t("Ordenar", "Sort")}<select value={sort} onChange={(event) => setSort(event.target.value as "recent" | "oldest")}><option value="recent">{t("Actualizados recientemente", "Recently updated")}</option><option value="oldest">{t("Más antiguos primero", "Oldest first")}</option></select></label></div>
      <p className={s.resultCount} role="status">{visible.length} {visible.length === 1 ? t("transporte", "transport") : t("transportes", "transports")}</p>
      {visible.length ? <div className={s.overviewGrid}>{visible.map((item) => <TrackingOverviewCard key={item.execution.id} {...item} t={t} tag={localeTag(locale)}/>)}</div> : <div className={`${s.panel} ${s.empty}`}><Search size={26} aria-hidden="true"/><strong>{t("No hay coincidencias", "No matches")}</strong><p>{t("Prueba otra referencia o cambia el filtro.", "Try another reference or change the filter.")}</p><button type="button" className={s.heroAction} onClick={() => { setFilter("all"); setQuery(""); }}>{t("Restablecer filtros", "Reset filters")}</button></div>}
    </> : <section className={`${s.panel} ${s.empty}`}><MapPinned size={30} aria-hidden="true"/><h2>{t("Aún no hay transportes", "No transports yet")}</h2><p>{t("Cuando el transportista inicie una ejecución de tu reserva, podrás seguirla aquí.", "Once the carrier creates an execution for your booking, you can track it here.")}</p><Link className={s.heroAction} href="/bookings">{t("Consultar mis reservas", "Check my bookings")}<ArrowRight size={16} aria-hidden="true"/></Link></section>}
  </div>;
}
