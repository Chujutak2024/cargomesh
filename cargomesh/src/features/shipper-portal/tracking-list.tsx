"use client";

import { useMemo } from "react";
import {usePathname,useSearchParams} from "next/navigation";
import { ArrowRight, MapPinned, Search } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { useLocale } from "@/features/i18n/locale-provider";
import { localeTag } from "@/features/i18n/config";
import { TrackingOverviewCard } from "./tracking-experience";
import { filterTrackingItems, matchesTrackingFilter, type TrackingFilter, type TrackingListItem } from "./tracking-presentation";
import s from "./tracking-experience.module.css";
import {parseTrackingQuery,trackingSearch} from "./tracking-query";
import {operationsHistoryState} from "./operations-query";
import {TrackingRefresh} from "./tracking-controls";

export function TrackingList({ items,offset=0,nextOffset=null }: { items: TrackingListItem[];offset?:number;nextOffset?:number|null }) {
  const { locale, t } = useLocale();
  const params=useSearchParams(),path=usePathname(),state=parseTrackingQuery(params),{q:query,filter,sort}=state;
  function update(patch:Partial<typeof state>){window.history.replaceState(operationsHistoryState(window.history.state),"",`${path}${trackingSearch({...state,...patch})}`);}
  const visible = useMemo(() => filterTrackingItems(items, query, filter, sort), [items, query, filter, sort]);
  const filters: [TrackingFilter, string][] = [["all", t("Todos", "All")], ["active", t("En curso", "Active")], ["attention", t("Requieren atención", "Needs attention")], ["completed", t("Finalizados", "Completed")]];
  return <div className={s.page}>
    <header className={s.listHeader}><div><h1>{t("Seguimiento", "Tracking")}</h1><p>{t("Encuentra tu transporte y consulta su último reporte.", "Find your transport and its latest report.")}</p></div><TrackingRefresh/><Link className={s.heroAction} href="/bookings">{t("Ver reservas", "View bookings")}<ArrowRight size={16} aria-hidden="true"/></Link></header>
    <p className={s.resultCount}>{t("Búsqueda y contadores sobre esta página de hasta 25 transportes.","Search and counts cover this page of up to 25 transports.")}</p>
    {items.length ? <>
      <div className={s.filterRow} role="group" aria-label={t("Filtrar transportes", "Filter transports")}>{filters.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => update({filter:value})}>{label}<span>{items.filter((item) => matchesTrackingFilter(item, value)).length}</span></button>)}</div>
      <div className={s.searchRow}><label className={s.searchField}><Search size={18} aria-hidden="true"/><span className={s.srOnly}>{t("Buscar transporte", "Search transports")}</span><input type="search" value={query} maxLength={200} onChange={(event) => update({q:event.target.value})} placeholder={t("Buscar por referencia, ruta o ubicación", "Search by reference, route or location")}/></label><label className={s.sortField}>{t("Ordenar", "Sort")}<select value={sort} onChange={(event) => update({sort:event.target.value as "recent" | "oldest"})}><option value="recent">{t("Actualizados recientemente", "Recently updated")}</option><option value="oldest">{t("Más antiguos primero", "Oldest first")}</option></select></label></div>
      <p className={s.resultCount} role="status">{visible.length} {visible.length === 1 ? t("transporte", "transport") : t("transportes", "transports")}</p>
      {visible.length ? <div className={s.overviewGrid}>{visible.map((item) => <TrackingOverviewCard key={item.execution.id} {...item} queryString={trackingSearch(state)} t={t} tag={localeTag(locale)}/>)}</div> : <div className={`${s.panel} ${s.empty}`}><Search size={26} aria-hidden="true"/><strong>{t("No hay coincidencias", "No matches")}</strong><p>{t("Prueba otra referencia o cambia el filtro.", "Try another reference or change the filter.")}</p><button type="button" className={s.heroAction} onClick={() => update({filter:"all",q:""})}>{t("Restablecer filtros", "Reset filters")}</button></div>}
    </> : <section className={`${s.panel} ${s.empty}`}><MapPinned size={30} aria-hidden="true"/><h2>{t("No hay transportes en esta página", "No transports on this page")}</h2><p>{t("Una ejecución planificada puede aparecer antes de su salida; no equivale a transporte iniciado.", "A planned execution can appear before departure; it does not mean transport has started.")}</p><Link className={s.heroAction} href="/bookings">{t("Consultar mis reservas", "Check my bookings")}<ArrowRight size={16} aria-hidden="true"/></Link></section>}
    <nav className={s.badgeRow} aria-label={t("Paginación de transportes","Transport pagination")}>
      {offset>0?<Link className={s.heroAction} href={`/tracking${trackingSearch({...state,offset:Math.max(0,offset-25)})}`}>{t("Página anterior","Previous page")}</Link>:null}
      {nextOffset!==null?<Link className={s.heroAction} href={`/tracking${trackingSearch({...state,offset:nextOffset})}`}>{t("Página siguiente","Next page")}</Link>:null}
    </nav>
  </div>;
}
