"use client";
import dynamic from "next/dynamic";
import {createPortal} from "react-dom";
import { createDepotCoordinator } from "@/features/logistics-3d/depot-coordinator";
import {useLocale} from "@/features/i18n/locale-provider";
import { lockDocumentScroll } from "@/shared/browser/scroll-lock";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Box, Building2, MapPin, Navigation, Route, Truck, X } from "lucide-react";
const RoadMapCanvas=dynamic(()=>import("@/features/v2-road-map/road-map-canvas").then(module=>module.RoadMapCanvas),{ssr:false});
import { providerNote, type MapProvider } from "@/features/v2-road-map/road-map-model";
import { useLocalRoadPreview } from "@/features/v2-workspace/use-local-road-preview";
import { localMapPresentation } from "./local-draft-model";
import type { TruckInspectionContext } from "./truck-inspection-model";
import {TruckReferenceStill} from '@/features/logistics-3d/truck-reference-still';
import s from "./truck-inspection.module.css";
import { journeySnapshot } from "./journey-model";
const AssociatedTruck=dynamic(()=>import("@/features/logistics-3d/logistics-truck").then(m=>m.LogisticsTruck),{ssr:false});
const DepotArrival = dynamic(() => import("@/features/logistics-3d/depot-arrival"), { ssr: false, loading: () => <div className={s.loading} role="status">Preparing the 3D depot…</div> });
const RouteNavigation3D=dynamic(()=>import("@/features/logistics-3d/route-navigation-3d"),{ssr:false,loading:()=> <div className={s.loading} role="status">Preparing the 3D route…</div>});

export function TruckInspection({ context, onClose, onEdit, onAssignTrip, onAssignDriver }: { context: TruckInspectionContext; onClose: () => void; onOpenDetail?:()=>void; onEdit?:()=>void; onAssignTrip?:()=>void; onAssignDriver?:()=>void; illustrative?:boolean }) {
  const {t,locale,localeTag}=useLocale();
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<"summary" | "route" | "route3d" | "depot" | "model">("summary");
  const [depotCoordinator] = useState(createDepotCoordinator);
  const [provider, setProvider] = useState<MapProvider>("loading");
  const report = useCallback((provider: MapProvider) => setProvider(provider), []);
  const result = useLocalRoadPreview(context.routeDraft?.originId ?? "", context.routeDraft?.destinationId ?? "", view === "route"||view==="route3d");
  const presentation = useMemo(() => context.routeDraft ? localMapPresentation(context.routeDraft, result?.preview ?? null) : context.map, [context, result?.preview]);
  useEffect(() => {
    if(!mounted)return;
    const node = dialog.current, previous = document.activeElement;
    const releaseScroll = lockDocumentScroll(document);
    node?.showModal();
    return () => { node?.close(); releaseScroll(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, [mounted]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [view,mounted]);
  const title=view==="model"?"Associated 3D model":view==="summary"?t("Resumen del camión","Truck summary"):view==="route"?t("Ruta del camión","Truck route"):view==="route3d"?t("Vista 3D de la ruta","3D route view"):t("Operación en la sede","Depot visualization");
  const updated=context.facts.find(fact=>fact.key==='updated');
  const metrics=['capacity','odometer','fuel'].flatMap(key=>context.facts.filter(fact=>fact.key===key));
  const detailOrder=['model','updated','driver'];
  const details=context.facts.filter(fact=>!['plate','capacity','odometer','fuel'].includes(fact.key??'')).sort((a,b)=>(detailOrder.includes(a.key??'')?detailOrder.indexOf(a.key!):3)-(detailOrder.includes(b.key??'')?detailOrder.indexOf(b.key!):3));
  const metricValue=(value:string)=>{const match=value.match(/^(.*?)\s*(kg|km|%)$/);return match?<>{match[1]}<small>{match[2]}</small></>:<span className={s.unknownValue}>{value}</span>;};
  return mounted?createPortal(<dialog ref={dialog} className={`${s.dialog} ${view !== "summary" ? s.wide : ""}`} aria-labelledby="truck-inspection-title" data-inspection-view={view}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header className={s.header}>
      {view==='summary'?<div className={s.breadcrumb}><Truck size={15} aria-hidden="true"/><span>{t('Flota y conductores','Fleet & drivers')}</span><span aria-hidden="true">/</span><h2 ref={heading} tabIndex={-1} id="truck-inspection-title">{title}</h2></div>:<div className={s.headerTitle}><button onClick={() => setView(view==="route3d"?"route":"summary")} aria-label={view==="route3d"?t("Volver al mapa", "Back to map"):t("Volver al resumen", "Back to summary")}><ArrowLeft size={20}/></button><div><small>{context.subtitle}</small><h2 ref={heading} tabIndex={-1} id="truck-inspection-title">{title}</h2></div></div>}
      <button onClick={onClose} aria-label={t("Cerrar resumen del camión","Close truck summary")}><X size={22}/></button>
    </header>
    {view === "summary" ? <><div className={s.summary}>
      <div className={s.hero}><div className={`${s.photo} ${context.photoReference ? s.reference : ""}`}><TruckReferenceStill designId={context.visualDesignId} photo={context.photoReference?undefined:context.photo} fallback={context.photo} alt={context.title}/></div><div className={s.identity}><div className={s.identityLine}><h3>{context.title}</h3><span className={s.status} data-status={context.statusCode}>{context.status}</span></div><p><MapPin size={13} aria-hidden="true"/>{context.origin}<ArrowRight size={13} aria-hidden="true"/>{context.destination}</p></div></div>
      {metrics.length?<dl className={s.metricStrip} aria-label={t('Métricas del camión','Truck metrics')}>{metrics.map(fact=><div key={fact.key}><dt>{fact.label}</dt><dd>{metricValue(fact.value)}</dd></div>)}</dl>:null}
      <section className={s.factSection} aria-labelledby="truck-facts-title"><div className={s.factsHeading}><h3 id="truck-facts-title">{t('Detalles del vehículo','Vehicle details')}</h3></div><dl className={s.facts}>{details.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.key==='driver'&&onAssignDriver?<button type="button" className={s.assignDriver} onClick={onAssignDriver}>{fact.value==='Por asignar'?t('Asignar conductor habitual','Set regular driver'):fact.value}</button>:fact.value}</dd></div>)}</dl></section>
      <section className={s.explore} aria-labelledby="truck-explore-title"><h3 id="truck-explore-title">{t('Explorar','Explore')}</h3><div className={s.actions}>
        {context.visualDesignId?<button type="button" onClick={()=>setView("model")}><span className={s.actionIcon}><Box size={18} aria-hidden="true"/></span><span><strong>{t('Modelo 3D','3D model')}</strong><small>{t('Ver el camión en detalle','View truck details')}</small></span></button>:null}
        <button type="button" onClick={() => setView("route")}><span className={s.actionIcon}><Route size={18} aria-hidden="true"/></span><span><strong>{t('Ruta','Route')}</strong><small>{t('Explorar en el mapa','Explore the map')}</small></span></button>
        <button type="button" onClick={() => setView("depot")}><span className={s.actionIcon}><Building2 size={18} aria-hidden="true"/></span><span><strong>{t('Depósito 3D','3D depot')}</strong><small>{t('Vista ilustrativa','Illustrative view')}</small></span></button>
      </div></section>
    </div><footer className={s.summaryFooter}><small>{updated?<> {t('Actualizado el','Updated on')} {updated.value}</>:context.subtitle}</small><div className={s.footerActions}><button data-cm-action type="button" onClick={onClose}>{t('Cerrar','Close')}</button>{onEdit?<button data-cm-action type="button" onClick={onEdit}>{t('Editar camión','Edit truck')}</button>:null}{onAssignTrip?<button data-cm-action type="button" className={s.primaryAction} onClick={onAssignTrip}>{t('Asignar viaje','Assign trip')}</button>:null}</div></footer></> : view === "model" ? <div className={s.summary}><AssociatedTruck compact variant={context.variant} designId={context.visualDesignId} label={context.title}/></div> : view === "route" ? <div className={s.route}>
      <div className={s.routeTop}><p><MapPin size={17}/><strong>{context.origin}</strong><ArrowRight size={17}/><strong>{context.destination}</strong></p><div>{presentation.distanceKm !== null ? <span>{presentation.distanceKm.toLocaleString(localeTag)} km</span> : null}{presentation.estimatedTransitHours !== null ? <span>{presentation.estimatedTransitHours.toLocaleString(localeTag)} h</span> : null}<button className={s.view3d} onClick={()=>setView("route3d")}><Navigation size={16}/>{t("Vista 3D", "3D view")}</button></div></div>
      <div className={s.map}><RoadMapCanvas presentation={presentation} onProviderChange={report}/></div>
      <p className={s.mapNote} role="status">{providerNote(provider, presentation, locale)}{!context.routeDraft && !presentation.paths.length ? " · No hay geometría de recorrido registrada para esta unidad." : result?.status === "loading" ? " · Consultando recorrido…" : ""}</p>
    </div> : view==="route3d"?<RouteNavigation3D initialProgress={journeySnapshot(context.id).progress} presentation={presentation} origin={context.origin} destination={context.destination} variant={context.variant} custom={context.custom} modelAssetId={context.modelAssetId} title={context.title} loading={result?.status==="loading"}/>:<DepotArrival context={context} coordinator={depotCoordinator}/>}
  </dialog>,document.body):null;
}
