"use client";
import dynamic from "next/dynamic";
import {useLocale} from "@/features/i18n/locale-provider";
import { lockDocumentScroll } from "@/shared/browser/scroll-lock";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, MapPin, Navigation, Route, Truck, X } from "lucide-react";
import { RoadMapCanvas } from "@/features/v2-road-map/road-map-canvas";
import { providerNote, type MapProvider } from "@/features/v2-road-map/road-map-model";
import { useLocalRoadPreview } from "@/features/v2-workspace/use-local-road-preview";
import { localMapPresentation } from "./local-draft-model";
import type { TruckInspectionContext } from "./truck-inspection-model";
import s from "./truck-inspection.module.css";
import { journeySnapshot } from "./journey-model";
import { createDepotCoordinator } from "@/features/logistics-3d/depot-coordinator";
const DepotArrival = dynamic(() => import("@/features/logistics-3d/depot-arrival"), { ssr: false, loading: () => <div className={s.loading} role="status">Preparando la sede 3D…</div> });
const RouteNavigation3D=dynamic(()=>import("@/features/logistics-3d/route-navigation-3d"),{ssr:false,loading:()=> <div className={s.loading} role="status">Preparando el recorrido 3D…</div>});

export function TruckInspection({ context, onClose, onOpenDetail, illustrative=false }: { context: TruckInspectionContext; onClose: () => void; onOpenDetail?:()=>void; illustrative?:boolean }) {
  const {t,locale,localeTag}=useLocale();
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<"summary" | "route" | "route3d" | "depot">("summary");
  // Owned above the conditionally mounted views, never by a canvas.
  const [depotCoordinator] = useState(createDepotCoordinator);
  const [provider, setProvider] = useState<MapProvider>("loading");
  const report = useCallback((provider: MapProvider) => setProvider(provider), []);
  const result = useLocalRoadPreview(context.routeDraft?.originId ?? "", context.routeDraft?.destinationId ?? "", view === "route"||view==="route3d");
  const presentation = useMemo(() => context.routeDraft ? localMapPresentation(context.routeDraft, result?.preview ?? null) : context.map, [context, result?.preview]);
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement;
    const releaseScroll = lockDocumentScroll(document);
    node?.showModal();
    return () => { node?.close(); releaseScroll(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [view]);
  const title=view==="summary"?t("Resumen del camión","Truck summary"):view==="route"?t("Ruta del camión","Truck route"):view==="route3d"?t("Vista 3D de la ruta","3D route view"):t("Operación en la sede","Depot visualization");
  return <dialog ref={dialog} className={`${s.dialog} ${view !== "summary" ? s.wide : ""}`} aria-labelledby="truck-inspection-title" data-inspection-view={view}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header className={s.header}>
      <div className={s.headerTitle}>{view !== "summary" ? <button onClick={() => setView(view==="route3d"?"route":"summary")} aria-label={view==="route3d"?t("Volver al mapa", "Back to map"):t("Volver al resumen", "Back to summary")}><ArrowLeft size={20}/></button> : <span className={s.headerIcon}><Truck size={22}/></span>}<div><small>{context.subtitle}</small><h2 ref={heading} tabIndex={-1} id="truck-inspection-title">{title}</h2></div></div>
      <button onClick={onClose} aria-label={t("Cerrar resumen del camión","Close truck summary")}><X size={22}/></button>
    </header>
    {illustrative?<p className={s.mapNote} role="note">Illustrative 3D preview · Reference model · No live position, load, depot presence or task is implied.</p>:null}
    {view === "summary" ? <div className={s.summary}>
      <div className={s.hero}><div className={`${s.photo} ${context.photoReference ? s.reference : ""}`}><img src={context.photo} alt={context.title}/>{context.photoReference ? <small>{t("Foto de referencia", "Reference photo")}</small> : null}</div><div className={s.identity}><span className={s.status}>{context.status}</span><h3>{context.title}</h3><p><MapPin size={15}/>{context.origin}<ArrowRight size={15}/>{context.destination}</p>{context.depot.site ? <small>{context.depot.carrier} · {context.depot.name}</small> : null}</div></div>
      <dl className={s.facts}>{context.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      <div className={s.actions}>
        <button onClick={() => setView("route")}><span className={s.actionIcon}><Route size={23}/></span><span><strong>{t("Ver ruta", "View route")}</strong><small>{t("Explorar el mapa ampliado", "Explore the map")}</small></span><ArrowRight size={18}/></button>
        <button onClick={() => setView("depot")}><span className={s.actionIcon}><Building2 size={23}/></span><span><strong>{t("Ver sede 3D", "View depot in 3D")}</strong><small>{t("Llegada, carga y salida", "Illustrative arrival, loading and departure")}</small></span><ArrowRight size={18}/></button>
      </div>
      <a className={s.detailLink} href="/vehicle-designs" target="_blank" rel="noopener noreferrer">3D design studio · 18 designs <ArrowRight size={15}/></a>
      {onOpenDetail?<button className={s.detailLink} onClick={onOpenDetail}>Open full vehicle record <ArrowRight size={15}/></button>:context.detailHref ? <a className={s.detailLink} href={context.detailHref} onClick={onClose}>{t("Abrir ficha completa", "Open full vehicle record")} <ArrowRight size={15}/></a> : null}
    </div> : view === "route" ? <div className={s.route}>
      <div className={s.routeTop}><p><MapPin size={17}/><strong>{context.origin}</strong><ArrowRight size={17}/><strong>{context.destination}</strong></p><div>{presentation.distanceKm !== null ? <span>{presentation.distanceKm.toLocaleString(localeTag)} km</span> : null}{presentation.estimatedTransitHours !== null ? <span>{presentation.estimatedTransitHours.toLocaleString(localeTag)} h</span> : null}<button className={s.view3d} onClick={()=>setView("route3d")}><Navigation size={16}/>{t("Vista 3D", "3D view")}</button></div></div>
      <div className={s.map}><RoadMapCanvas presentation={presentation} onProviderChange={report}/></div>
      <p className={s.mapNote} role="status">{providerNote(provider, presentation, locale)}{!context.routeDraft && !presentation.paths.length ? " · No hay geometría de recorrido registrada para esta unidad." : result?.status === "loading" ? " · Consultando recorrido…" : ""}</p>
    </div> : view==="route3d"?<RouteNavigation3D initialProgress={journeySnapshot(context.id).progress} presentation={presentation} origin={context.origin} destination={context.destination} variant={context.variant} custom={context.custom} modelAssetId={context.modelAssetId} title={context.title} loading={result?.status==="loading"}/>:<DepotArrival context={context} coordinator={depotCoordinator}/>}
  </dialog>;
}
