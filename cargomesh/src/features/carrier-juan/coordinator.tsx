"use client";
import {CarrierContinuityProvider,useCarrierScrollMemory} from "@/features/carrier-navigation/carrier-continuity";
import {carrierDisplayName} from '@/shared/lib/display-identity';
import dynamic from 'next/dynamic';
import {usePathname} from 'next/navigation';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {CommercialWorkspace} from './commercial-workspace';
import {ConnectedOrders} from './connected-orders';
import {ConnectedDashboard} from './connected-dashboard';
import type {PipelineViewState} from '@/features/carrier-portal/connected-commercial-workspace';
import {readJuanHash,juanHref,juanHash,subscribeJuanRoute} from './juan-navigation';
import {navigateCarrier} from '@/features/carrier-navigation/carrier-link';
import {authorizedCarrierFromSearch} from '@/features/carrier-navigation/carrier-context';
const RouteLab=dynamic(()=>import('@/features/road-route-lab/route-lab').then(m=>m.RouteLab));
import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowRight, CircleHelp, ClipboardCheck, FileText, LayoutDashboard, MapPinned, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FreightRequestV2ResponseSchema, type FreightRequestV2Response } from "@/shared/schemas/v2/freight-request";
import { V2IntakePrototype } from "@/features/v2-intake/v2-intake-prototype";
import { getFreightRequestV2, getRoadServiceabilityV2, assertServiceabilityCorrelation, reconcileCandidateSelection } from "@/features/v2-intake/v2-intake-client";
import type { RoadServiceabilityEvaluationV2Data, FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { GuidanceImage } from "./guidance-image";
import { ContentMotion } from "@/features/product-motion/content-motion";
const LogisticsTruck=dynamic(()=>import("@/features/logistics-3d/logistics-truck").then(module=>module.LogisticsTruck),{ssr:false});
import { RequestSummary } from "./request-summary";
import { LocalDraftWorkspace, LocalDraftRecovery } from "./local-draft-workspace";
import { useLocalDraft } from "./use-local-draft";
import { useLocalRequestExamples } from "./use-local-request-examples";
import { localRequestReference } from "./local-request-presentation";
import { FleetWorkspace } from "./fleet-workspace";
import { portalErrorCopy, portalRequest, PortalApiError } from "./api";
import { DataValue, valueLabel } from "./contract-form";
import s from "./portal.module.css";
import { CarrierNavigation, CarrierMenuButton } from "@/features/carrier-navigation/carrier-navigation";
import navStyles from "@/features/carrier-navigation/carrier-navigation.module.css";

type Request=FreightRequestV2Response["data"];
const navigation=[
 {id:"dashboard",es:"Panel",en:"Dashboard",icon:LayoutDashboard},
 {id:"shipments",es:"Solicitudes",en:"Requests",icon:FileText},
 {id:"request",es:"Nueva solicitud",en:"New request",icon:FileText},
 {id:"desk",es:"Offers",en:"Offers",icon:ClipboardCheck},
 {id:"tracking",es:"Orders",en:"Orders",icon:MapPinned},
 {id:"fleet",es:"Flota",en:"Fleet",icon:Truck},
 {id:"pipeline",es:"Pipeline",en:"Pipeline",icon:ClipboardCheck},
 {id:"tower",es:"Control tower",en:"Control tower",icon:MapPinned},
 {id:"route-lab",es:"Rutas calculadas",en:"Road routing lab",icon:MapPinned},
 {id:"help",es:"Ayuda",en:"Help",icon:CircleHelp},
] as const;
type View=typeof navigation[number]["id"];
function viewFromHash():View{const name=readJuanHash().replace(/^#\/?/,"").split("/")[0];return navigation.some(v=>v.id===name)?name as View:"fleet";}
type WorkspaceProps={previewEnabled?:boolean;initialAccess?:CarrierPortalAccessV2[]};
export function JuanCarrierWorkspace(props:WorkspaceProps){
 const scope=(props.initialAccess??[]).map(row=>row.operatorId+":"+row.carrierId+":"+row.role).sort().join("|");
 return <CarrierContinuityProvider key={scope}><CarrierWorkspaceBody {...props}/></CarrierContinuityProvider>;
}
function CarrierWorkspaceBody({previewEnabled=false,initialAccess=[]}:WorkspaceProps){
 const [requestsBusy,setRequestsBusy]=useState(false);
 const [fleetHeaderTarget,setFleetHeaderTarget]=useState<HTMLDivElement|null>(null);
 const [pipelineViews,setPipelineViews]=useState<Record<string,PipelineViewState>>({});
 const pathname=usePathname();const [pipelineCarrierId,setPipelineCarrierId]=useState(initialAccess[0]?.carrierId??'');
 const pipelineCarrier=initialAccess.find(row=>row.carrierId===pipelineCarrierId);
 useEffect(()=>{
  const sync=()=>setPipelineCarrierId(previous=>authorizedCarrierFromSearch(initialAccess.map(row=>row.carrierId),previous,window.location.search));
  sync();window.addEventListener('cm-carrier-route',sync);window.addEventListener('popstate',sync);
  return()=>{window.removeEventListener('cm-carrier-route',sync);window.removeEventListener('popstate',sync);};
 },[initialAccess]);
 const {locale,t}=useLocale(),es=locale==="es";const [view,setView]=useState<View>(()=>{const name=juanHash(pathname).replace(/^#\/?/,"").split("/")[0];return navigation.some(v=>v.id===name)?name as View:"fleet";});
 const isCommercial=['shipments','desk','pipeline'].includes(view);
 const [headingRoute,setHeadingRoute]=useState(()=>juanHash(pathname));
 const headerTitle=useRef<HTMLHeadingElement>(null),previousHeadingRoute=useRef(headingRoute);
 useEffect(()=>{if(previousHeadingRoute.current!==headingRoute)headerTitle.current?.focus({preventScroll:true});previousHeadingRoute.current=headingRoute;},[headingRoute]);
 const local=useLocalDraft(!isCommercial&&view!=="tracking"&&view!=="tower");const [source,setSource]=useState<"local"|"service">("local");
 const localRequests=useLocalRequestExamples(local.record,local.enabled&&!isCommercial&&view!=="tracking"&&view!=="tower",local.save);
 const useLocal=source==="local"&&!["dashboard","help","fleet","pipeline","tower","route-lab","shipments","desk","tracking"].includes(view);
 const [requests,setRequests]=useState<Request[]>([]),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [selected,setSelected]=useState<Request|null>(null),[evaluation,setEvaluation]=useState<RoadServiceabilityEvaluationV2Data|null>(null),[candidate,setCandidate]=useState<string|null>(null),[evaluating,setEvaluating]=useState(false),[evaluationError,setEvaluationError]=useState("");
 const [intakeOpened,setIntakeOpened]=useState(false);
 useEffect(()=>{if(view==="request"&&!useLocal&&local.phase!=="reading")setIntakeOpened(true);},[view,useLocal,local.phase]);
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all");const generation=useRef(0);
 const receivePersisted=useCallback((data:FreightRequestV2Data)=>{const parsed=FreightRequestV2ResponseSchema.shape.data.parse(data);
  setSelected(parsed);setRequests(previous=>[parsed,...previous.filter(row=>row.id!==parsed.id)].slice(0,25));setError("");setEvaluation(null);setCandidate(null);
 },[]);
 const receiveEvaluation=useCallback((data:FreightRequestV2Data,result:RoadServiceabilityEvaluationV2Data,id:string|null)=>{
  assertServiceabilityCorrelation(data,result);setSelected(FreightRequestV2ResponseSchema.shape.data.parse(data));setEvaluation(result);setCandidate(id);
 },[]);
 useEffect(()=>{
  const sync=()=>{if(window.location.hash.startsWith('#/')){navigateCarrier(juanHref(window.location.hash),true);return;}setView(viewFromHash());setHeadingRoute(readJuanHash());};
  sync();const unsubscribe=subscribeJuanRoute(sync);
  const links=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=(event.target as Element).closest?.('a[href]');const href=anchor?.getAttribute('href');if(href?.startsWith('#/')&&anchor?.closest('[data-juan-front]')){event.preventDefault();navigateCarrier(juanHref(href));}};
  document.addEventListener('click',links);return()=>{unsubscribe();document.removeEventListener('click',links);};
 },[pathname]);
 useCarrierScrollMemory(headingRoute,pipelineCarrierId);
 useEffect(()=>{const controller=new AbortController();
  if(isCommercial||source==="local"||view==="fleet"||view==="help"||view==="desk"||view==="tracking"||view==="pipeline"||view==="tower"){setLoading(false);return()=>controller.abort();}
  setLoading(true);setError("");setRequests([]);setNext(null);setSelected(null);setEvaluation(null);setCandidate(null);setEvaluating(false);generation.current++;
  void portalRequest("/api/v2/freight/requests?limit=25&offset="+offset,{signal:controller.signal}).then(result=>{
   if(!Array.isArray(result.data))throw new PortalApiError(502,"INVALID_RESPONSE");
   const data=result.data.map(row=>FreightRequestV2ResponseSchema.shape.data.parse(row));setRequests(data);setNext(result.meta?.nextOffset??null);
  }).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,es));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();},[offset,refresh,es,view,source,isCommercial]);
 const pick=async(id:string,target:View)=>{if(target==="desk"||target==="tracking"){navigateCarrier(juanHref("#/"+target));return;}setSource("service");const token=++generation.current;setSelected(null);setEvaluation(null);setCandidate(null);setEvaluationError("");setEvaluating(true);navigateCarrier(juanHref("#/"+target));
  try{const response=await getFreightRequestV2(id);if(token!==generation.current)return;const loaded=FreightRequestV2ResponseSchema.parse(response).data;setSelected(loaded);

  }catch(e){if(token===generation.current)setEvaluationError(portalErrorCopy(e,es));}finally{if(token===generation.current)setEvaluating(false);}
 };
 const filtered=requests.filter(r=>(status==="all"||r.status===status)&&(r.referenceCode+" "+r.origin.city+" "+r.destination.city+" "+r.cargoSpecification.description).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const current=navigation.find(i=>i.id===view)!;
 const viewLabel=(id:View,spanish:string,english:string)=>local.record&&source==="local"&&id==="request"?t("Editar solicitud","Edit request"):es?spanish:english;
 const currentLabel=viewLabel(view,current.es,current.en);
 const fleetHeading=headingRoute.replace(/^#\/fleet\/(?:service\/)?/,'').split('/')[0];
 const pageTitle=headingRoute==='#/desk/automation'?t('Automatización','Automation'):isCommercial?t('Comercial','Commercial'):(view==='dashboard'||view==='tower')?'Dashboard':view==='fleet'?({carriers:'Sites & coverage',coverage:'Areas and destinations',assignment:'Scheduling',register:'Register vehicle',drivers:'Drivers'} as Record<string,string>)[fleetHeading]??'Fleet & drivers':current.en;
 const viewDescription={
  dashboard:t("Consulta las solicitudes y continúa con el trabajo pendiente.","Inspect requests and continue pending work."),
  shipments:t("Busca una solicitud y abre su ficha.","Find a request and open its details."),
  request:t("Completa el origen, la carga y las fechas de la solicitud.","Complete the request origin, cargo and dates."),
  desk:"Prepare, issue and review the Carrier's commercial offers.",
  tracking:"Inspect customer bookings, capacity reservations and recorded operations.",
  fleet:fleetHeading==='carriers'?"Inspect recorded depots and service coverage.":t("Consulta el estado de los camiones y organiza su asignación.","View truck conditions and organize their assignments."),
  pipeline:'',tower:'Your shipments and exceptions in one view.','route-lab':'Calculated road routes',
  help:t("Consulta cómo gestionar solicitudes, rutas y camiones.","Learn how to manage requests, routes and trucks."),
 }[view];
 const Empty=()=> <div className={s.empty}><ShieldCheck size={30} aria-hidden="true"/><h2>{error?t("Datos no disponibles","Data unavailable"):t("No hay solicitudes en esta página","No requests in this page")}</h2><p>{error||t("Consulta otra página o crea una solicitud con el formulario del equipo.","Browse another page or create a request using the team form.")}</p>{error?<a href="/login">{t("Iniciar sesión","Sign in")} →</a>:<a href="#/request">{t("Nueva solicitud","New request")} →</a>}</div>;
 const renderTable=()=> <><div className={s.toolbar}><label>{t("Buscar en esta página","Search this page")}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>{t("Estado","Status")}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{t("Todos","All")}</option>{Array.from(new Set(requests.map(r=>r.status))).map(s=><option key={s} value={s}>{valueLabel(s,es)}</option>)}</select></label></div>
  <div className={s.tableWrap}><table className={s.table}><caption style={{textAlign:"left",padding:12}}>{t("Solicitudes consultadas","Fetched requests")} · {filtered.length}</caption><thead><tr><th scope="col">{t("Solicitud y ruta","Request and route")}</th><th scope="col">{t("Estado","Status")}</th><th scope="col">{t("Carga","Cargo")}</th><th scope="col">{t("Acción","Action")}</th></tr></thead><tbody>{filtered.map(request=><tr key={request.id}><th scope="row" style={{textTransform:"none",fontSize:14,letterSpacing:0,background:"transparent"}}>{request.referenceCode}<small style={{display:"block"}}>{request.origin.city} → {request.destination.city}</small></th><td><span className={s.status}><DataValue value={request.status} es={es}/></span></td><td>{request.cargoSpecification.totalWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</td><td><button onClick={()=>void pick(request.id,"desk")}>{t("Revisar","Review")}</button> <button onClick={()=>void pick(request.id,"tracking")}>{t("Ver ruta","View route")}</button></td></tr>)}</tbody></table></div>
  {!filtered.length?<p style={{padding:16}}>{t("No hay coincidencias con estos filtros.","No matches for these filters.")}</p>:null}
  <div className={s.pagination}><small>{t("Hasta 25 registros por consulta. No es el total histórico.","Up to 25 records per query. This is not the historical total.")}</small><div><button disabled={!offset||loading} onClick={()=>setOffset(Math.max(0,offset-25))}>{t("Anterior","Previous")}</button><button disabled={next===null||loading} onClick={()=>next!==null&&setOffset(next)}>{t("Siguiente","Next")}</button></div></div></>;
 return <CarrierNavigation current={view==="tracking"?"orders":view} locale={locale} towerHref="/carriers/control-tower" previewEnabled={previewEnabled} editRequest={!!local.record && source === "local"} sourceLabel={(view==="dashboard"||view==="pipeline"||view==="shipments"||view==="desk"||view==="tracking"||view==="tower")?(pipelineCarrier?carrierDisplayName(pipelineCarrier.carrierName,pipelineCarrier.carrierId):undefined)??"Carrier workspace":view==="fleet"?"Carrier fleet · source shown in the page":"Juan visual examples · no GPS"}><div data-juan-front className={`${s.shell} ${navStyles.workspaceSurface}`}>
 <div className={s.main}>
 <header className={[s.topbar,view==='fleet'?s.fleetTopbar:''].join(' ')}><div><CarrierMenuButton/><h1 className={s.workspaceTitle} ref={headerTitle} tabIndex={-1}>{pageTitle}</h1></div><div>{view==='fleet'?<div className={s.fleetHeaderSlot} ref={setFleetHeaderTarget}/>:null}{(view==='dashboard'||view==='pipeline'||view==='shipments'||view==='desk'||view==='tracking'||view==='tower')&&initialAccess.length>1?<label><select aria-label="Carrier" value={pipelineCarrierId} disabled={requestsBusy} onChange={e=>{const carrier=e.target.value;setPipelineCarrierId(carrier);navigateCarrier(juanHref('#/'+view)+'?carrier='+encodeURIComponent(carrier));}}>{initialAccess.map(row=><option key={row.carrierId} value={row.carrierId}>{carrierDisplayName(row.carrierName,row.carrierId)}</option>)}</select></label>:null}{(isCommercial||view==='tracking'||view==='dashboard'||view==='tower')?<button data-cm-action type="button" className={s.headerRefresh} disabled={requestsBusy||!pipelineCarrier} aria-label={isCommercial?"Refresh Commercial":view==="tracking"?"Refresh Orders":"Refresh Dashboard"} title={isCommercial?"Refresh Commercial":view==="tracking"?"Refresh Orders":"Refresh Dashboard"} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={17} aria-hidden="true"/></button>:null}<LanguageSwitcher compact/><form action="/api/auth/logout" method="post"><button type="submit">{t("Cerrar sesión", "Sign out")}</button></form></div></header>
 <main className={s.content} id="coordinator-content"><ContentMotion identity={view} enabled={!['shipments','desk','pipeline','fleet','tracking','dashboard','tower'].includes(view)}>{!useLocal&&!isCommercial&&view!=="dashboard"&&view!=="tower"&&view!=="fleet"&&view!=="tracking"?<div className={s.pageIntro}><p>{viewDescription}</p>{view!=="request"?<button onClick={()=>setRefresh(x=>x+1)} disabled={loading||requestsBusy}><RefreshCw size={16} aria-hidden="true"/>{t("Actualizar","Refresh")}</button>:null}</div>:null}
 {!["dashboard","pipeline","tower","route-lab","fleet","shipments","desk","tracking"].includes(view)?<p className={s.sourceNote}>Illustrative local examples. Changes here stay on this device; they do not create connected requests, offers or bookings.</p>:null}
 {local.enabled&&view!=="fleet"&&view!=="shipments"&&view!=="desk"&&view!=="tracking"&&!["dashboard","pipeline","tower","route-lab"].includes(view)?<><div className={s.localSourceBar}><span><span className={s.localDot} aria-hidden="true"/>{source==="service"?t("Datos del servicio","Service data"):local.record?t("Guardado en este dispositivo","Saved on this device"):t("Espacio local","Local workspace")}</span></div>{local.phase!=="ready"||view==="help"?<LocalDraftRecovery phase={local.phase} retry={local.retry} save={local.save}/>:null}</>:null}
 {useLocal&&localRequests.selected&&view!=="shipments"&&view!=="dashboard"?<div className={s.localRequestContext}><span><FileText size={15} aria-hidden="true"/><strong>{localRequestReference(localRequests.selected.id)}</strong></span><a href="#/shipments">{t("Ver las solicitudes","View requests")}<ArrowRight size={15} aria-hidden="true"/></a></div>:null}
 {useLocal&&localRequests.storageError?<p role="alert" className={s.error}>{t("No se pudieron cargar las solicitudes guardadas. Comprueba el almacenamiento del navegador.","Saved requests could not be loaded. Check browser storage.")}</p>:null}
 {(view==="request"&&!useLocal&&local.phase!=="reading"||intakeOpened)?<section hidden={view!=="request"||useLocal} className={`${s.card} ${s.intakeSurface}`}><V2IntakePrototype embedded onPersisted={receivePersisted} onEvaluation={receiveEvaluation}/></section>:null}
 {(view==='dashboard'||view==='tower')?pipelineCarrier?<ConnectedDashboard key={pipelineCarrier.operatorId+':'+pipelineCarrier.carrierId} carrier={pipelineCarrier} refreshToken={refresh}/>:<p>No authorized Carrier selected.</p>:view==='tracking'?pipelineCarrier?<ConnectedOrders key={pipelineCarrier.operatorId+':'+pipelineCarrier.carrierId} routeHash={headingRoute} carrier={pipelineCarrier} refreshToken={refresh} onBusyChange={setRequestsBusy}/>:<p>Select an authorized Carrier in the header to inspect Orders.</p>:isCommercial?pipelineCarrier?<CommercialWorkspace key={pipelineCarrier.operatorId+':'+pipelineCarrier.carrierId} carrier={pipelineCarrier} initialHash={headingRoute} refreshToken={refresh} onBusyChange={setRequestsBusy} initialBoardState={pipelineViews[pipelineCarrier.operatorId+':'+pipelineCarrier.carrierId]} onBoardStateChange={value=>setPipelineViews(previous=>({...previous,[pipelineCarrier.operatorId+':'+pipelineCarrier.carrierId]:value}))}/>:<p>No authorized Carrier selected.</p>:view==='route-lab'?<RouteLab embedded/>:useLocal&&!localRequests.selected?<LocalDraftRecovery phase={local.phase} retry={local.retry} save={local.save}/>:view==="fleet"?<FleetWorkspace access={initialAccess} headerTarget={fleetHeaderTarget}/>:useLocal&&localRequests.selected?<LocalDraftWorkspace key={localRequests.selected.id} record={localRequests.selected.record} view={view} save={localRequests.save} entries={localRequests.entries} activeId={localRequests.selected.id} select={localRequests.select}/>:
 view==="request"?null:
 view==="help"?<div className={s.grid}><section className={s.card}><GuidanceImage/><h2>{t("Continúa desde la solicitud","Continue from the request")}</h2><p>{t("El panel, la ficha, la revisión y el mapa utilizan la misma solicitud. Los cambios de origen, carga, fechas y camión se guardan automáticamente en este navegador.","The dashboard, details, review and map share one request. Origin, cargo, date and truck changes are saved automatically in this browser.")}</p><p>{t("Puedes cambiar de solicitud desde el Panel o el directorio sin perder los cambios guardados.","Switch requests from the dashboard or directory without losing saved changes.")}</p></section><section className={s.card}><h2>{t("Fuentes y permisos","Sources and permissions")}</h2><p>{t("El mapa muestra la ruta disponible entre las ciudades seleccionadas. La capacidad del vehículo y las condiciones del transporte se comprueban por separado.","The map shows the available route between the selected cities. Vehicle capacity and transport conditions are checked separately.")}</p><a href="/carriers/control-tower">{t("Abrir Dashboard","Open Dashboard")} →</a></section></div>:
 loading?<p className={s.loading} role="status">{t("Consultando solicitudes…","Loading requests…")}</p>:
 <>{error?<p role="alert" className={s.error}>{error}</p>:null}<div className={s.toolbar}><label>{t("Solicitud","Request")}<select value={selected?.id??""} onChange={e=>{if(e.target.value)void pick(e.target.value,view);}}><option value="">{t("Seleccionar solicitud","Select request")}</option>{requests.map(r=><option key={r.id} value={r.id}>{r.referenceCode} · {r.origin.city} → {r.destination.city}</option>)}</select></label></div>
 {evaluating?<p role="status" className={s.loading}>{t("Consultando solicitud y evaluación…","Loading request and evaluation…")}</p>:null}{evaluationError?<p role="alert" className={s.error}>{evaluationError}</p>:null}
 {!selected&&!evaluating?<section className={s.card}><div className={s.empty}><h2>{t("Selecciona una solicitud","Select a request")}</h2><p>{t("La vista usará el registro persistido y su versión vigente.","This view uses the persisted record and its current version.")}</p></div></section>:null}
 {selected?<><section className={s.card}><div className={s.heading}><div><h2>{selected.referenceCode}</h2><p>{selected.origin.city} → {selected.destination.city}</p></div><span className={s.status}><DataValue value={selected.status} es={es}/></span></div><dl className={s.details}><div><dt>{t("Versión","Version")}</dt><dd>{selected.draftVersion}</dd></div><div><dt>{t("Carga","Cargo")}</dt><dd>{selected.cargoSpecification.description} · {selected.cargoSpecification.totalWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</dd></div><div><dt>{t("Recogida","Pickup")}</dt><dd>{new Date(selected.pickupWindow.startsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")} — {new Date(selected.pickupWindow.endsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")}</dd></div><div><dt>{t("Entrega","Delivery")}</dt><dd>{new Date(selected.deliveryWindow.startsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")} — {new Date(selected.deliveryWindow.endsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")}</dd></div></dl></section>
 <section className={s.card}><h2>{t("Revisión de cobertura","Coverage review")}</h2>{evaluation?<><p>{t("Estado de elegibilidad","Eligibility state")}: <DataValue value={evaluation.overallStatus} es={es}/> · {t("Candidatos","Candidates")}: {evaluation.candidates.length}</p>{evaluation.candidates.map(item=><details key={item.candidateId} style={{padding:"14px 0",borderBottom:"1px solid #d9e4ec"}}><summary>{item.carrier.commercialName} · {item.service.code} · {item.status}</summary><DataValue value={item.checks} es={es}/></details>)}</>:<p>{t("No hay resultados verificados del servicio.","No verified service results available.")}</p>}<p style={{marginTop:16}}>{t("La contratación del transporte requiere la autorización del cliente.","Transport contracting requires client authorization.")}</p></section></>:null}</>}
 </ContentMotion></main></div></div></CarrierNavigation>;
}
