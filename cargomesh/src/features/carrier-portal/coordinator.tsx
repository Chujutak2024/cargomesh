"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, CircleHelp, ClipboardCheck, FileText, LayoutDashboard, MapPinned, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FreightRequestV2ResponseSchema, type FreightRequestV2Response } from "@/shared/schemas/v2/freight-request";
import { V2IntakePrototype } from "@/features/v2-intake/v2-intake-prototype";
import { getFreightRequestV2, getRoadServiceabilityV2, assertServiceabilityCorrelation, reconcileCandidateSelection } from "@/features/v2-intake/v2-intake-client";
import { mapServiceabilityToMapViewProps } from "@/features/v2-intake/mappers/road-map-props.mapper";
import type { RoadServiceabilityEvaluationV2Data, FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { RoadCandidateMapView } from "@/features/v2-road-map/road-candidate-map-view";
import { GuidanceImage } from "./guidance-image";
import { ContentMotion } from "@/features/product-motion/content-motion";
import { LogisticsTruck } from "@/features/logistics-3d/logistics-truck";
import { RequestSummary } from "./request-summary";
import { LocalDraftWorkspace, LocalDraftRecovery } from "./local-draft-workspace";
import { useLocalDraft } from "./use-local-draft";
import { useLocalRequestExamples } from "./use-local-request-examples";
import { localRequestReference } from "./local-request-presentation";
import { FleetWorkspace } from "./fleet-workspace";
import { portalErrorCopy, portalRequest, PortalApiError } from "./api";
import { DataValue, valueLabel } from "./contract-form";
import s from "./portal.module.css";

type Request=FreightRequestV2Response["data"];
const navigation=[
 {id:"dashboard",es:"Panel",en:"Dashboard",icon:LayoutDashboard},
 {id:"shipments",es:"Solicitudes",en:"Requests",icon:FileText},
 {id:"request",es:"Nueva solicitud",en:"New request",icon:FileText},
 {id:"desk",es:"Revisión",en:"Review",icon:ClipboardCheck},
 {id:"tracking",es:"Ruta",en:"Route",icon:MapPinned},
 {id:"fleet",es:"Flota",en:"Fleet",icon:Truck},
 {id:"help",es:"Ayuda",en:"Help",icon:CircleHelp},
] as const;
type View=typeof navigation[number]["id"];
function viewFromHash():View{const name=window.location.hash.replace(/^#\/?/,"").split("/")[0];return navigation.some(v=>v.id===name)?name as View:"fleet";}
export function ConnectedCoordinator(){
 const {locale,t}=useLocale(),es=locale==="es";const [view,setView]=useState<View>("fleet");
 const local=useLocalDraft();const [source,setSource]=useState<"local"|"service">("local");
 const localRequests=useLocalRequestExamples(local.record,local.enabled,local.save);
 const useLocal=!!local.record&&source==="local"&&view!=="help"&&view!=="fleet";
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
 useEffect(()=>{setView(viewFromHash());const listener=()=>{if(window.location.hash.startsWith("#/"))setView(viewFromHash());};window.addEventListener("hashchange",listener);return()=>window.removeEventListener("hashchange",listener);},[]);
 useEffect(()=>{const controller=new AbortController();
  if(view==="fleet"||view==="help"){setLoading(false);return()=>controller.abort();}
  setLoading(true);setError("");setRequests([]);setNext(null);setSelected(null);setEvaluation(null);setCandidate(null);setEvaluating(false);generation.current++;
  void portalRequest("/api/v2/freight/requests?limit=25&offset="+offset,{signal:controller.signal}).then(result=>{
   if(!Array.isArray(result.data))throw new PortalApiError(502,"INVALID_RESPONSE");
   const data=result.data.map(row=>FreightRequestV2ResponseSchema.shape.data.parse(row));setRequests(data);setNext(result.meta?.nextOffset??null);
  }).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,es));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();},[offset,refresh,es,view]);
 const pick=async(id:string,target:View)=>{setSource("service");const token=++generation.current;setSelected(null);setEvaluation(null);setCandidate(null);setEvaluationError("");setEvaluating(true);window.location.hash="/"+target;
  try{const response=await getFreightRequestV2(id);if(token!==generation.current)return;const loaded=FreightRequestV2ResponseSchema.parse(response).data;setSelected(loaded);
   if(target==="tracking"||target==="desk"){const serviceability=await getRoadServiceabilityV2(loaded.id,loaded.draftVersion);assertServiceabilityCorrelation(loaded as FreightRequestV2Data,serviceability.data);
    if(token===generation.current){setEvaluation(serviceability.data);setCandidate(previous=>reconcileCandidateSelection(previous,serviceability.data));}}
  }catch(e){if(token===generation.current)setEvaluationError(portalErrorCopy(e,es));}finally{if(token===generation.current)setEvaluating(false);}
 };
 const mapProps=useMemo(()=>selected&&evaluation?mapServiceabilityToMapViewProps(selected as FreightRequestV2Data,evaluation,candidate,setCandidate):null,[selected,evaluation,candidate]);
 const filtered=requests.filter(r=>(status==="all"||r.status===status)&&(r.referenceCode+" "+r.origin.city+" "+r.destination.city+" "+r.cargoSpecification.description).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const current=navigation.find(i=>i.id===view)!;
 const viewLabel=(id:View,spanish:string,english:string)=>local.record&&source==="local"&&id==="request"?t("Editar solicitud","Edit request"):es?spanish:english;
 const currentLabel=viewLabel(view,current.es,current.en);
 const viewDescription={
  dashboard:t("Consulta las solicitudes y continúa con el trabajo pendiente.","Inspect requests and continue pending work."),
  shipments:t("Busca una solicitud y abre su ficha.","Find a request and open its details."),
  request:t("Completa el origen, la carga y las fechas de la solicitud.","Complete the request origin, cargo and dates."),
  desk:t("Revisa los datos y los resultados de cada solicitud.","Review each request's details and results."),
  tracking:t("Consulta la ruta y sus datos disponibles.","Inspect the route and its available data."),
  fleet:t("Consulta el estado de los camiones y organiza su asignación.","View truck conditions and organize their assignments."),
  help:t("Consulta cómo gestionar solicitudes, rutas y camiones.","Learn how to manage requests, routes and trucks."),
 }[view];
 const Empty=()=> <div className={s.empty}><ShieldCheck size={30} aria-hidden="true"/><h2>{error?t("Datos no disponibles","Data unavailable"):t("No hay solicitudes en esta página","No requests in this page")}</h2><p>{error||t("Consulta otra página o crea una solicitud con el formulario del equipo.","Browse another page or create a request using the team form.")}</p>{error?<a href="/login">{t("Iniciar sesión","Sign in")} →</a>:<a href="#/request">{t("Nueva solicitud","New request")} →</a>}</div>;
 const renderTable=()=> <><div className={s.toolbar}><label>{t("Buscar en esta página","Search this page")}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>{t("Estado","Status")}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{t("Todos","All")}</option>{Array.from(new Set(requests.map(r=>r.status))).map(s=><option key={s} value={s}>{valueLabel(s,es)}</option>)}</select></label></div>
  <div className={s.tableWrap}><table className={s.table}><caption style={{textAlign:"left",padding:12}}>{t("Solicitudes consultadas","Fetched requests")} · {filtered.length}</caption><thead><tr><th scope="col">{t("Solicitud y ruta","Request and route")}</th><th scope="col">{t("Estado","Status")}</th><th scope="col">{t("Carga","Cargo")}</th><th scope="col">{t("Acción","Action")}</th></tr></thead><tbody>{filtered.map(request=><tr key={request.id}><th scope="row" style={{textTransform:"none",fontSize:14,letterSpacing:0,background:"transparent"}}>{request.referenceCode}<small style={{display:"block"}}>{request.origin.city} → {request.destination.city}</small></th><td><span className={s.status}><DataValue value={request.status} es={es}/></span></td><td>{request.cargoSpecification.totalWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</td><td><button onClick={()=>void pick(request.id,"desk")}>{t("Revisar","Review")}</button> <button onClick={()=>void pick(request.id,"tracking")}>{t("Ver ruta","View route")}</button></td></tr>)}</tbody></table></div>
  {!filtered.length?<p style={{padding:16}}>{t("No hay coincidencias con estos filtros.","No matches for these filters.")}</p>:null}
  <div className={s.pagination}><small>{t("Hasta 25 registros por consulta. No es el total histórico.","Up to 25 records per query. This is not the historical total.")}</small><div><button disabled={!offset||loading} onClick={()=>setOffset(Math.max(0,offset-25))}>{t("Anterior","Previous")}</button><button disabled={next===null||loading} onClick={()=>next!==null&&setOffset(next)}>{t("Siguiente","Next")}</button></div></div></>;
 return <div className={s.shell}><a href="#coordinator-content" className={s.skip}>{t("Saltar al contenido","Skip to content")}</a><aside className={s.rail}><a href="/v2-workspace" className={s.brand}><Image src="/v2-workspace/cargomesh-icon.png" width={42} height={42} sizes="42px" alt="CargoMesh"/><span><strong>CargoMesh</strong><br/>{t("COORDINACIÓN","COORDINATION")}</span></a><nav aria-label={t("Navegación del coordinador","Coordinator navigation")}>{navigation.map(({id,es:label,en,icon:Icon})=><a key={id} href={useLocal&&id==="desk"?"#/desk/review":"#/"+id} aria-label={viewLabel(id,label,en)} aria-current={id===view?"page":undefined}><Icon size={20} aria-hidden="true"/><span data-short={es?({dashboard:"Panel",shipments:"Lista",request:local.record&&source==="local"?"Editar":"Crear",desk:"Revisar",tracking:"Ruta",fleet:"Flota",help:"Ayuda"}[id]):({dashboard:"Home",shipments:"List",request:local.record&&source==="local"?"Edit":"Create",desk:"Review",tracking:"Route",fleet:"Fleet",help:"Help"}[id])}>{viewLabel(id,label,en)}</span></a>)}<a href="/carrier-control-tower" aria-label={t("Control Tower de prueba", "Control tower preview")}><MapPinned size={20} aria-hidden="true"/><span data-short="Preview">Control tower <small>Preview</small></span></a></nav><div className={s.railFooter}><span>{view==="fleet"?t("Consulta de flota","Fleet viewer"):local.record&&source==="local"?t("Solicitudes guardadas","Saved requests"):t("Datos del servicio V2","V2 service data")}</span></div></aside>
 <div className={s.main}>
 <header className={s.topbar}><div><strong>{t("Espacio Carrier", "Carrier workspace")}</strong><small>{currentLabel}</small></div><div><LanguageSwitcher/><form action="/api/auth/logout" method="post"><button type="submit">{t("Cerrar sesión", "Sign out")}</button></form></div></header>
 <main className={s.content} id="coordinator-content"><ContentMotion identity={view} focusOnChange><div className={s.heading}><div><span className={s.eyebrow}>{view==="fleet"?t("Coordinación de flota","Fleet coordination"):t("Coordinación de solicitudes","Request coordination")}</span><h1 tabIndex={-1}>{view==="dashboard"?t("Panel de coordinación","Coordination dashboard"):currentLabel}</h1>{!useLocal?<p>{viewDescription}</p>:null}</div>{!useLocal&&view!=="request"&&view!=="fleet"?<button onClick={()=>setRefresh(x=>x+1)} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>{t("Actualizar","Refresh")}</button>:null}</div>
 {local.enabled&&view!=="fleet"?<><div className={s.localSourceBar}><span><span className={s.localDot} aria-hidden="true"/>{source==="service"?t("Datos del servicio","Service data"):local.record?t("Guardado en este dispositivo","Saved on this device"):t("Espacio local","Local workspace")}</span></div>{local.phase!=="ready"||view==="help"?<LocalDraftRecovery phase={local.phase} retry={local.retry} save={local.save}/>:null}</>:null}
 {useLocal&&localRequests.selected&&view!=="shipments"&&view!=="dashboard"?<div className={s.localRequestContext}><span><FileText size={15} aria-hidden="true"/><strong>{localRequestReference(localRequests.selected.id)}</strong></span><a href="#/shipments">{t("Ver las solicitudes","View requests")}<ArrowRight size={15} aria-hidden="true"/></a></div>:null}
 {useLocal&&localRequests.storageError?<p role="alert" className={s.error}>{t("No se pudieron cargar las solicitudes guardadas. Comprueba el almacenamiento del navegador.","Saved requests could not be loaded. Check browser storage.")}</p>:null}
 {(view==="request"&&!useLocal&&local.phase!=="reading"||intakeOpened)?<section hidden={view!=="request"||useLocal} className={`${s.card} ${s.intakeSurface}`}><V2IntakePrototype embedded onPersisted={receivePersisted} onEvaluation={receiveEvaluation}/></section>:null}
 {view==="fleet"?<FleetWorkspace/>:useLocal&&localRequests.selected?<LocalDraftWorkspace key={view==="tracking"?"tracking":localRequests.selected.id} record={localRequests.selected.record} view={view} save={localRequests.save} entries={localRequests.entries} activeId={localRequests.selected.id} select={localRequests.select}/>:
 view==="request"?null:
 view==="help"?<div className={s.grid}><section className={s.card}><GuidanceImage/><h2>{t("Continúa desde la solicitud","Continue from the request")}</h2><p>{t("El panel, la ficha, la revisión y el mapa utilizan la misma solicitud. Los cambios de origen, carga, fechas y camión se guardan automáticamente en este navegador.","The dashboard, details, review and map share one request. Origin, cargo, date and truck changes are saved automatically in this browser.")}</p><p>{t("Puedes cambiar de solicitud desde el Panel o el directorio sin perder los cambios guardados.","Switch requests from the dashboard or directory without losing saved changes.")}</p></section><section className={s.card}><h2>{t("Fuentes y permisos","Sources and permissions")}</h2><p>{t("El mapa muestra la ruta disponible entre las ciudades seleccionadas. La capacidad del vehículo y las condiciones del transporte se comprueban por separado.","The map shows the available route between the selected cities. Vehicle capacity and transport conditions are checked separately.")}</p><a href="/carrier-control-tower">{t("Abrir Control Tower de prueba","Open Control tower preview")} →</a></section></div>:
 loading?<p className={s.loading} role="status">{t("Consultando solicitudes…","Loading requests…")}</p>:
 view==="dashboard"?<><div className={s.metrics}>{[[t("Solicitudes consultadas","Fetched requests"),requests.length],[t("Por completar","Incomplete"),requests.filter(r=>r.status==="DRAFT").length],[t("Pendientes de selección","Awaiting selection"),requests.filter(r=>r.status==="AWAITING_SELECTION").length]].map(([label,value])=><div className={s.metric} key={label}><small>{label}</small><strong>{error?"—":value}</strong><small>{t("En esta página","In this page")}</small></div>)}</div>{error||!requests.length?<section className={`${s.card} ${s.welcomeLayout}`}><Empty/><LogisticsTruck compact/></section>:<RequestSummary requests={requests} onReview={id=>void pick(id,"desk")} onRoute={id=>void pick(id,"tracking")}/>}</>:
 view==="shipments"?<section className={s.card}>{error||!requests.length?<Empty/>:renderTable()}</section>:
 <>{error?<p role="alert" className={s.error}>{error}</p>:null}<div className={s.toolbar}><label>{t("Solicitud","Request")}<select value={selected?.id??""} onChange={e=>{if(e.target.value)void pick(e.target.value,view);}}><option value="">{t("Seleccionar solicitud","Select request")}</option>{requests.map(r=><option key={r.id} value={r.id}>{r.referenceCode} · {r.origin.city} → {r.destination.city}</option>)}</select></label></div>
 {evaluating?<p role="status" className={s.loading}>{t("Consultando solicitud y evaluación…","Loading request and evaluation…")}</p>:null}{evaluationError?<p role="alert" className={s.error}>{evaluationError}</p>:null}
 {!selected&&!evaluating?<section className={s.card}><div className={s.empty}><h2>{t("Selecciona una solicitud","Select a request")}</h2><p>{t("La vista usará el registro persistido y su versión vigente.","This view uses the persisted record and its current version.")}</p></div></section>:null}
 {selected?<><section className={s.card}><div className={s.heading}><div><h2>{selected.referenceCode}</h2><p>{selected.origin.city} → {selected.destination.city}</p></div><span className={s.status}><DataValue value={selected.status} es={es}/></span></div><dl className={s.details}><div><dt>{t("Versión","Version")}</dt><dd>{selected.draftVersion}</dd></div><div><dt>{t("Carga","Cargo")}</dt><dd>{selected.cargoSpecification.description} · {selected.cargoSpecification.totalWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</dd></div><div><dt>{t("Recogida","Pickup")}</dt><dd>{new Date(selected.pickupWindow.startsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")} — {new Date(selected.pickupWindow.endsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")}</dd></div><div><dt>{t("Entrega","Delivery")}</dt><dd>{new Date(selected.deliveryWindow.startsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")} — {new Date(selected.deliveryWindow.endsAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")}</dd></div></dl></section>
 {view==="tracking"?mapProps?<RoadCandidateMapView {...mapProps}/>:!evaluating?<div className={s.notice}>{t("No hay una evaluación de ruta disponible para esta versión. No se dibuja geometría.","No route evaluation is available for this version. No geometry is drawn.")}</div>:null:
 <section className={s.card}><h2>{t("Revisión de cobertura","Coverage review")}</h2>{evaluation?<><p>{t("Estado de elegibilidad","Eligibility state")}: <DataValue value={evaluation.overallStatus} es={es}/> · {t("Candidatos","Candidates")}: {evaluation.candidates.length}</p>{evaluation.candidates.map(item=><details key={item.candidateId} style={{padding:"14px 0",borderBottom:"1px solid #d9e4ec"}}><summary>{item.carrier.commercialName} · {item.service.code} · {item.status}</summary><DataValue value={item.checks} es={es}/></details>)}</>:<p>{t("No hay resultados verificados del servicio.","No verified service results available.")}</p>}<p style={{marginTop:16}}>{t("La contratación del transporte requiere la autorización del cliente.","Transport contracting requires client authorization.")}</p></section>}</>:null}</>}
 </ContentMotion></main></div></div>;
}
