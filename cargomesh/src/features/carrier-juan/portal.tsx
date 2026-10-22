"use client";
import {carrierDisplayName} from '@/shared/lib/display-identity';
import {readJuanHash} from "./juan-navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, BriefcaseBusiness, CircleHelp, FileCheck2, LayoutDashboard, MapPinned, Network, RefreshCw, Search, ShieldCheck, Truck, X } from "lucide-react";
import { WorkflowInputsV2 } from "@/shared/schemas/v2/workflow";
import { CatalogInputsV2, parseCatalogRecordV2 } from "@/shared/schemas/v2/catalog";
import { z, type ZodTypeAny } from "zod";
import { useLocale } from "@/features/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { portalErrorCopy, portalRequest, PortalApiError } from "./api";
import { carrierResources, resourcePath, type PortalResource, type PortalSection } from "./resources";
import { carrierCommandPath, parseRecords, recordData, recordName, recordStatus, validCarrierId, type PortalRecord } from "./records";
import { ContractForm, DataValue, emptyInput } from "./contract-form";
import { CarrierMap } from "./carrier-map";
import { GuidanceImage } from "./guidance-image";
import { ContentMotion } from "@/features/product-motion/content-motion";
import { LogisticsTruck } from "@/features/logistics-3d/logistics-truck";
import {type CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {canCarrierAction,canCreateCarrierRecord,canReviseCarrierRecord} from './permissions';
import { loadCarrierEntry } from "./portal-entry";
import s from "./portal.module.css";

const sections = [
 {id:"overview",es:"Resumen",en:"Overview",icon:LayoutDashboard},
 {id:"network",es:"Red y servicios",en:"Network and services",icon:Network},
 {id:"fleet",es:"Flota y agenda",en:"Fleet and schedule",icon:Truck},
 {id:"commercial",es:"Oportunidades",en:"Opportunities",icon:BriefcaseBusiness},
 {id:"operations",es:"Operación",en:"Operations",icon:FileCheck2},
 {id:"map",es:"Mapa operativo",en:"Operations map",icon:MapPinned},
 {id:"help",es:"Ayuda",en:"Help",icon:CircleHelp},
] as const;
type Editor={schema:ZodTypeAny;initial?:unknown;path:string;revision?:number;title:string};
const manualOfferSchema=WorkflowInputsV2["offers.create"].innerType().extend({source:WorkflowInputsV2["offers.create"].innerType().shape.source.extend({channel:z.literal("MANUAL")})})
 .superRefine((value,ctx)=>{const result=WorkflowInputsV2["offers.create"].safeParse(value);if(!result.success)for(const issue of result.error.issues)ctx.addIssue(issue);});
function hashSection():PortalSection {const value=readJuanHash().replace(/^#\/?/,"");return sections.some(s=>s.id===value)?value as PortalSection:"overview";}
export function CarrierPortal(){
 const {locale,t}=useLocale(),es=locale==="es";
 const [section,setSection]=useState<PortalSection>("overview"),[reference,setReference]=useState("");
 const [carrierId,setCarrierId]=useState(""),[authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(false),[error,setError]=useState("");
 const [profile,setProfile]=useState<PortalRecord|null>(null),[revision,setRevision]=useState(0);
 const gate=useRef<AbortController|null>(null);
 const [access,setAccess]=useState<CarrierPortalAccessV2[]>([]);
 const [entryStatus,setEntryStatus]=useState<"loading"|"choose"|"empty"|"login"|"error"|"ready">("loading");
 const [entryAttempt,setEntryAttempt]=useState(0),[sessionKnown,setSessionKnown]=useState(false);
 const activeAccess=access.find(a=>a.carrierId===carrierId);
 useEffect(()=>{
  gate.current?.abort();const controller=new AbortController();gate.current=controller;
  setEntryStatus("loading");setError("");setAuthorized(false);setProfile(null);setCarrierId("");setAccess([]);setSessionKnown(false);
  void loadCarrierEntry(controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   setAccess(result.access);setSessionKnown(true);
   setReference(result.access.length===1?result.access[0].carrierId:"");
   if(result.profile){setProfile(result.profile);setCarrierId(result.profile.id);setAuthorized(true);setEntryStatus("ready");}
   else setEntryStatus(result.access.length?"choose":"empty");
  }).catch(failure=>{
   if(controller.signal.aborted)return;
   const needsLogin=failure instanceof PortalApiError&&failure.status===401;
   setEntryStatus(needsLogin?"login":"error");setError(needsLogin?"":portalErrorCopy(failure,es));
  });
  return()=>controller.abort();
 },[es,entryAttempt]);
 useEffect(()=>{setSection(hashSection());const listener=()=>{if(readJuanHash().startsWith("#/"))setSection(hashSection());};window.addEventListener("hashchange", listener);window.addEventListener("cm-carrier-route", listener);window.addEventListener("popstate", listener);
  return()=>{window.removeEventListener("hashchange", listener);window.removeEventListener("cm-carrier-route", listener);window.removeEventListener("popstate", listener);gate.current?.abort();};},[]);
 const connect=async()=>{
  if(!access.some(a=>a.carrierId===reference.trim())){setError(t("Introduce la referencia válida del transportista registrado.","Enter a valid registered carrier reference."));return;}
  gate.current?.abort();const controller=new AbortController();gate.current=controller;
  setChecking(true);setError("");setAuthorized(false);setProfile(null);setCarrierId("");
  const id=reference.trim();
  try{
   const loaded=await portalRequest("/api/v2/carrier-portal/carriers/"+id,{signal:controller.signal});
   if(controller.signal.aborted)return;
   const record=parseCatalogRecordV2("carriers",loaded.data);
   if(record.id!==id)throw new PortalApiError(502,"INVALID_RESPONSE");
   setProfile(record);setCarrierId(id);setAuthorized(true);setEntryStatus("ready");
  }catch(failure){if(!controller.signal.aborted){
    setError(portalErrorCopy(failure,es));
    if(failure instanceof PortalApiError&&failure.status===401){setEntryStatus("login");setSessionKnown(false);setAccess([]);}
   }}
  finally{if(!controller.signal.aborted)setChecking(false);}
 };
 const reloadProfile=async()=>{
  gate.current?.abort();const controller=new AbortController();gate.current=controller;
  try{const response=await portalRequest("/api/v2/carrier-portal/carriers/"+carrierId,{signal:controller.signal});if(controller.signal.aborted)return;
   const latest=parseCatalogRecordV2("carriers",response.data);
   if(latest.id!==carrierId)throw new PortalApiError(502,"INVALID_RESPONSE");
   setProfile(latest);setRevision(x=>x+1);setError("");
  }catch(failure){if(!controller.signal.aborted){setError(portalErrorCopy(failure,es));setAuthorized(false);setProfile(null);setCarrierId("");setEntryStatus(failure instanceof PortalApiError&&failure.status===401?"login":"error");setSessionKnown(false);setAccess([]);}}
 };
 const current=sections.find(x=>x.id===section)!;
 return <div className={s.shell}><a className={s.skip} href="#carrier-content">{t("Saltar al contenido","Skip to content")}</a>
  <aside className={s.rail}><a className={s.brand} href="/carrier-portal"><Image src="/v2-workspace/cargomesh-icon.png" width={42} height={42} sizes="42px" alt="CargoMesh"/><span><strong>CargoMesh</strong><br/>{t("TRANSPORTISTA","CARRIER")}</span></a>
   <nav aria-label={t("Navegación del transportista","Carrier navigation")}>{sections.map(({id,es:label,en,icon:Icon})=><a key={id} href={"#/"+id} aria-current={section===id?"page":undefined} aria-label={es?label:en}><Icon size={20} aria-hidden="true"/><span data-short={es?({overview:"Resumen",network:"Red",fleet:"Flota",commercial:"Ofertas",operations:"Operación",map:"Mapa",help:"Ayuda"}[id]):({overview:"Overview",network:"Network",fleet:"Fleet",commercial:"Offers",operations:"Ops",map:"Map",help:"Help"}[id])}>{es?label:en}</span></a>)}<a href="http://127.0.0.1:8080/carrier-control-tower" aria-label="Control tower preview"><MapPinned size={20} aria-hidden="true"/><span data-short="Preview">Control tower <small style={{fontSize:9,opacity:.7}}>Preview</small></span></a></nav>
   <div className={s.railFooter}><span>{t("Tu red. Tu operación.","Your network. Your operations.")}</span></div></aside>
  <div className={s.main}><header className={s.topbar}><div><strong>{t("Portal del transportista","Carrier portal")}</strong><small>{es?current.es:current.en}</small></div>
   <div><LanguageSwitcher/>{sessionKnown?<>{activeAccess?<span>{activeAccess.role}</span>:null}<form action="/api/auth/logout" method="post"><button type="submit">{t("Cerrar sesión","Sign out")}</button></form></>:null}</div></header>
   <main className={s.content} id="carrier-content"><ContentMotion identity={section} focusOnChange><div className={s.heading}><div><span className={s.eyebrow}>{profile?recordName(profile):t("Espacio del transportista","Carrier workspace")}</span>
    <h1 tabIndex={-1}>{es?current.es:current.en}</h1><p>{section==="overview"?t("Tu siguiente acción, con datos de tu operación.","Your next action, grounded in your operations."):t("Información registrada y acciones atribuidas a tu cuenta.","Recorded information and actions attributed to your account.")}</p></div>
    {authorized?<button onClick={()=>{gate.current?.abort();setAuthorized(false);setProfile(null);setCarrierId("");setError("");setChecking(false);setEntryStatus("choose");}}>{t("Cambiar transportista","Change carrier")}</button>:null}</div>
   {section==="help"?<Help/>:!authorized?<section className={s.card} aria-busy={entryStatus==="loading"||checking}>
    <div className={s.empty}><ShieldCheck size={32} aria-hidden="true"/>
     <h2>{entryStatus==="loading"?t("Abriendo tu espacio…","Opening your workspace…"):
      entryStatus==="login"?t("Inicia sesión para continuar","Sign in to continue"):
      entryStatus==="empty"?t("No tienes un transportista vinculado","No carrier linked to your account"):
      entryStatus==="error"?t("No pudimos abrir tu espacio","Unable to open your workspace"):
      t("Elige tu transportista","Choose your carrier")}</h2>
     {entryStatus==="loading"?<p role="status">{t("Comprobando tu sesión y acceso autorizado…","Checking your session and carrier access…")}</p>:
      entryStatus==="login"?<><p>{t("Ingresa con tu cuenta de CargoMesh para acceder a tu operación.","Use your CargoMesh account to access your operations.")}</p><a className={s.primary} href="/login?returnTo=%2Fcarrier-portal">{t("Iniciar sesión","Sign in")} <ArrowRight size={16} aria-hidden="true"/></a></>:
      entryStatus==="empty"?<p>{t("Pide a tu administrador que vincule tu cuenta a un transportista.","Ask your administrator to link your account to a carrier.")}</p>:
      entryStatus==="choose"?<p>{t("Selecciona el transportista con el que quieres trabajar.","Select the carrier you want to work with.")}</p>:null}
    </div>
    {entryStatus==="choose"?<form className={s.entry} onSubmit={e=>{e.preventDefault();void connect();}}>
     <label style={{flex:1}}>{t("Transportista autorizado","Authorized carrier")}<select value={reference} disabled={checking} onChange={e=>setReference(e.target.value)}><option value="">{t("Selecciona tu transportista","Select your carrier")}</option>{access.map(a=><option key={a.carrierId} value={a.carrierId}>{carrierDisplayName(a.carrierName,a.carrierId)} · {a.role}</option>)}</select></label>
     <button className={s.primary} disabled={checking||!reference} type="submit">{checking?t("Abriendo…","Opening…"):t("Abrir espacio","Open workspace")}<ArrowRight size={16} aria-hidden="true"/></button>
    </form>:null}
    {error?<p className={s.error} role="alert">{error}</p>:null}
    {entryStatus==="error"?<button onClick={()=>setEntryAttempt(x=>x+1)}><RefreshCw size={16} aria-hidden="true"/>{t("Reintentar","Try again")}</button>:null}
   </section>:
    section==="overview"&&activeAccess?<Overview access={activeAccess} carrierId={carrierId} profile={profile!} onSaved={()=>void reloadProfile()} key={revision}/>:
    section==="map"?<CarrierMap carrierId={carrierId}/>:
    activeAccess?<ResourceWorkspace key={section+carrierId} access={activeAccess} carrierId={carrierId} section={section}/>:null}</ContentMotion></main></div></div>;
}

function Help(){const {t}=useLocale();return <div className={s.grid}><section className={s.card}><GuidanceImage/><h2>{t("Un trabajo por sección","One job per section")}</h2>
 <dl className={s.details}><div><dt>{t("Red y servicios","Network and services")}</dt><dd>{t("Depósitos, servicios, áreas y corredores dirigidos. Una sede no confirma cobertura.","Depots, services, areas and directed lanes. A depot does not confirm coverage.")}</dd></div>
 <div><dt>{t("Flota y agenda","Fleet and schedule")}</dt><dd>{t("Activos, conductores, cupos y ventanas. La capacidad declarada no equivale a disponibilidad.","Assets, drivers, pools and windows. Declared capacity is not availability.")}</dd></div>
 <div><dt>{t("Oportunidades","Opportunities")}</dt><dd>{t("Responde a la solicitud y registra una oferta con precio, vigencia y evidencia propia.","Respond to a request and record an offer with your price, validity and evidence.")}</dd></div>
 <div><dt>{t("Operación","Operations")}</dt><dd>{t("Confirma bookings, registra posiciones e incidentes. Ninguna posición manual equivale a GPS en vivo.","Confirm bookings, record positions and incidents. A manual position is not live GPS.")}</dd></div></dl></section>
 <section className={s.card}><h2>{t("Estados y fuentes","States and sources")}</h2><p>{t("Verificado, estimado, simulado y desconocido se conservan como fueron registrados. No se infieren rutas ni cobertura.","Verified, estimated, simulated and unknown values retain their recorded provenance. Routes and coverage are not inferred.")}</p>
 <h3>{t("Permisos y conflictos","Permissions and conflicts")}</h3><p>{t("Si cambia tu permiso o alguien modifica el registro, vuelve a consultar antes de reintentar. Los errores del servicio nunca se reemplazan por datos de ejemplo.","If your permission changes or someone edits a record, reload before retrying. Service errors are never replaced with sample data.")}</p></section></div>;}

function Overview({carrierId,profile,onSaved,access}:{carrierId:string;profile:PortalRecord;onSaved:()=>void;access:CarrierPortalAccessV2}){
 const {locale,t}=useLocale(),es=locale==="es";const [items,setItems]=useState<Array<{key:string;count:number;next:boolean}>>([]),[error,setError]=useState("");const [editor,setEditor]=useState<Editor|null>(null);
 useEffect(()=>{const controller=new AbortController();void Promise.all(["opportunities","offers","executions"].map(async key=>{
  const resource=carrierResources.find(r=>r.key===key)!;const response=await portalRequest(resourcePath(carrierId,resource,"")+"?limit=25&offset=0",{signal:controller.signal});
  return{key,count:parseRecords(resource,response.data,carrierId).length,next:response.meta?.nextOffset!=null};
 })).then(setItems).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,es));});return()=>controller.abort();},[carrierId,es]);
 const max=Math.max(1,...items.map(i=>i.count));
 return <><section className={`${s.card} ${s.carrierHero}`}><div><span className={s.eyebrow}>{t("Tu operación, en contexto","Your operation, in context")}</span><h2>{recordName(profile)}</h2><p>{t("Administra tu red, revisa oportunidades y registra acciones con evidencia propia.","Manage your network, review opportunities and record actions with your own evidence.")}</p><a className={s.heroLink} href="#/commercial">{t("Revisar oportunidades","Review opportunities")}<ArrowRight size={16} aria-hidden="true"/></a></div><div><LogisticsTruck/><small>{t("Visualización ilustrativa; no representa GPS ni disponibilidad real.","Illustrative visualization; not live GPS or actual availability.")}</small></div></section><div className={s.metrics}>{["opportunities","offers","executions"].map(key=>{const item=items.find(i=>i.key===key);return <div key={key} className={s.metric}><small>{key==="opportunities"?t("Oportunidades","Opportunities"):key==="offers"?t("Ofertas","Offers"):t("Operaciones","Operations")}</small><strong>{item?item.count+(item.next?"+":""):"—"}</strong><small>{t("En la página consultada","In the fetched page")}</small></div>;})}</div>
 {error?<p role="alert" className={s.error}>{error}</p>:null}<div className={s.grid}><section className={s.card}><h2>{t("Continúa tu trabajo","Continue your work")}</h2><p>{t("Entra al área correspondiente para consultar los registros y sus acciones.","Open the relevant area to inspect records and their actions.")}</p>
 <div className={s.summaryLinks}>{sections.filter(i=>["network","fleet","commercial","operations"].includes(i.id)).map(i=><a key={i.id} href={"#/"+i.id}>{es?i.es:i.en}<ArrowRight size={18} aria-hidden="true"/></a>)}</div>
 {items.length?<><h3 style={{marginTop:24}}>{t("Volumen consultado","Fetched volume")}</h3><div className={s.chart} role="img" aria-label={items.map(i=>(carrierResources.find(r=>r.key===i.key)?.[es?"es":"en"]??i.key)+": "+i.count+(i.next?"+":"")).join(", ")}>{items.map(i=><div key={i.key}><i style={{height:Math.max(3,70*i.count/max)}}/><span>{carrierResources.find(r=>r.key===i.key)?.[es?"es":"en"]}</span></div>)}</div><small>{t("No representa el total histórico ni el rendimiento.","This is not a historical total or a performance measure.")}</small></>:null}</section>
 <section className={s.card}><h2>{t("Perfil del transportista","Carrier profile")}</h2><dl className={s.details}>{Object.entries(recordData(profile)).filter(([k])=>["code","commercialName","providerType","registeredCountry","status","operationalPhone"].includes(k)).map(([key,value])=><div key={key}><dt>{key==="commercialName"?t("Nombre comercial","Commercial name"):key==="registeredCountry"?t("País registrado","Registered country"):key==="operationalPhone"?t("Teléfono operativo","Operational phone"):key==="providerType"?t("Tipo","Type"):key==="status"?t("Estado","Status"):t("Código","Code")}</dt><dd><DataValue value={value} es={es}/></dd></div>)}</dl>
 {access.role==="ADMIN"?<button style={{marginTop:20}} onClick={()=>setEditor({schema:CatalogInputsV2.carriers,initial:recordData(profile),revision:profile.version,path:"/api/v2/carrier-portal/carriers/"+carrierId+"/revisions",title:t("Actualizar perfil","Update profile")})}>{t("Editar perfil","Edit profile")}</button>:null}</section></div>
 <EditorDialog editor={editor} onClose={()=>setEditor(null)} onSaved={onSaved}/></>;
}

function ResourceWorkspace({carrierId,section,access}:{carrierId:string;section:PortalSection;access:CarrierPortalAccessV2}){
 const {locale,t}=useLocale(),es=locale==="es";const resources=carrierResources.filter(r=>r.section===section);
 const [resourceKey,setResourceKey]=useState(resources[0].key),[parentId,setParentId]=useState(""),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0),[search,setSearch]=useState("");
 const resource=resources.find(r=>r.key===resourceKey)!;
 const [rows,setRows]=useState<PortalRecord[]>([]),[parents,setParents]=useState<PortalRecord[]>([]),[selected,setSelected]=useState<PortalRecord|null>(null),[next,setNext]=useState<number|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [editor,setEditor]=useState<Editor|null>(null);const path=resourcePath(carrierId,resource,parentId);
 const detailQuery=useRef<AbortController|null>(null),returnButton=useRef<HTMLButtonElement|null>(null),detailHeading=useRef<HTMLHeadingElement|null>(null);
 useEffect(()=>{if(selected){detailHeading.current?.focus({preventScroll:true});detailHeading.current?.scrollIntoView({block:"nearest",behavior:"instant"});}},[selected]);
 const closeDetail=()=>{setSelected(null);returnButton.current?.focus({preventScroll:true});};
 useEffect(()=>{const controller=new AbortController();detailQuery.current?.abort();setRows([]);setSelected(null);setNext(null);setError("");
  if(resource.parent&&!validCarrierId(parentId)){setLoading(false);return()=>controller.abort();}
  setLoading(true);void portalRequest(path+"?limit=25&offset="+offset,{signal:controller.signal}).then(result=>{
   const loaded=parseRecords(resource,result.data,carrierId);setRows(loaded);setNext(result.meta?.nextOffset??null);
  }).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,es));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>{controller.abort();detailQuery.current?.abort();};},[carrierId,resource,parentId,path,offset,refresh,es]);
 useEffect(()=>{setParents([]);if(!resource.parent)return;const key={service:"services",execution:"executions",incident:"incidents",asset:"assets"}[resource.parent];
  // Incidents must be selected under their execution; an arbitrary global incident picker would lose scope.
  if(key==="incidents")return;
  const source=carrierResources.find(r=>r.key===key)!;const controller=new AbortController();void portalRequest(resourcePath(carrierId,source,"")+"?limit=100&offset=0",{signal:controller.signal})
   .then(result=>setParents(parseRecords(source,result.data,carrierId))).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,es));});return()=>controller.abort();
 },[resource,carrierId,es]);
 const choose=(key:string)=>{detailQuery.current?.abort();setResourceKey(key);setParentId("");setRows([]);setSelected(null);setOffset(0);setSearch("");setEditor(null);};
 const canCreate=canCreateCarrierRecord(access.role,resource)&&(resource.parent!=="execution"||parents.some(p=>p.id===parentId&&["PLANNED","IN_PROGRESS"].includes(recordStatus(p))));
 const create=()=>{if(!resource.schema||!canCreate)return;let initial=emptyInput(resource.schema) as Record<string,unknown>;
  if(resource.key==="asset-events"){const parent=parents.find(p=>p.id===parentId);if(!parent)return;initial={...initial,expectedVersion:parent.version};}
  setEditor({schema:resource.schema,initial,path,title:t("Crear ","Create ")+(es?resource.es:resource.en)});};
 const visible=rows.filter(record=>(recordName(record)+" "+recordStatus(record)).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const detail=async(id:string)=>{detailQuery.current?.abort();const controller=new AbortController();detailQuery.current=controller;setError("");setSelected(null);
  try{const result=await portalRequest(path+"/"+encodeURIComponent(id),{signal:controller.signal});if(!controller.signal.aborted)setSelected(parseRecords(resource,[result.data],carrierId)[0]);}
  catch(e){if(!controller.signal.aborted)setError(portalErrorCopy(e,es));}};
 const action=(command:NonNullable<PortalResource["actions"]>[number])=>{if(!selected||!canCarrierAction(access.role,command.action,recordStatus(selected)))return;const schema=WorkflowInputsV2[command.action];setEditor({schema,initial:{...emptyInput(schema) as Record<string,unknown>,expectedVersion:selected.version},
  path:carrierCommandPath(carrierId,resource,selected.id,parentId,command.suffix),title:es?command.es:command.en});};
 return <><div className={s.tabs} role="group" aria-label={t("Área de trabajo","Work area")}>{resources.map(r=><button key={r.key} aria-pressed={r.key===resourceKey} onClick={()=>choose(r.key)}>{es?r.es:r.en}</button>)}</div>
 <div className={s.resourceLayout} data-detail-open={selected?"true":"false"}><section className={s.card}><div className={s.heading}><div><h2>{es?resource.es:resource.en}</h2><p>{t("Consulta, revisa y actúa sobre el registro seleccionado.","Browse, review and act on the selected record.")}</p></div>
  {canCreate?<button className={s.primary} disabled={loading||!!resource.parent&&!parentId} onClick={create}>{t("Añadir registro","Add record")}</button>:null}</div>
  {resource.parent?<div className={s.toolbar}><label className={s.parent}>{resource.parent==="service"?t("Servicio","Service"):resource.parent==="execution"?t("Operación","Operation"):resource.parent==="asset"?t("Activo","Asset"):t("Referencia del incidente","Incident reference")}
   {resource.parent==="incident"?<input value={parentId} onChange={e=>{setParentId(e.target.value);setOffset(0);}}/>:<select value={parentId} onChange={e=>{setParentId(e.target.value);setOffset(0);}}><option value="">{t("Seleccionar registro","Select record")}</option>{parents.map(p=><option key={p.id} value={p.id}>{recordName(p)}</option>)}</select>}</label>
   <small>{t("Solo registros consultados de este transportista. Si no aparece, consulta el área correspondiente.","Only records fetched for this carrier. If missing, inspect the relevant area.")}</small></div>:null}
  <div className={s.toolbar}><label><span><Search size={14} aria-hidden="true"/> {t("Buscar en esta página","Search this page")}</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <button onClick={()=>{setSelected(null);setRefresh(x=>x+1);}} disabled={loading}><RefreshCw size={16} aria-hidden="true"/>{t("Actualizar","Refresh")}</button></div>
  {error?<p className={s.error} role="alert">{error}</p>:null}
  {loading?<p className={s.loading} role="status">{t("Consultando registros…","Loading records…")}</p>:resource.parent&&!parentId?<div className={s.empty}><h3>{t("Selecciona el registro relacionado","Select the related record")}</h3><p>{t("La consulta y las acciones quedarán dentro de ese contexto.","The query and actions stay within that context.")}</p></div>:!error&&visible.length===0?<div className={s.empty}><h3>{search?t("No hay coincidencias","No matches"):t("No hay registros en esta página","No records in this page")}</h3><p>{t("No se han añadido registros de ejemplo. Prueba otra consulta o crea un registro con tus datos.","No sample records have been added. Try another query or create a record using your data.")}</p></div>:
  visible.length?<div className={s.tableWrap}><table className={s.table}><caption style={{textAlign:"left",padding:12}}>{es?resource.es:resource.en} · {visible.length} {t("registros consultados","fetched records")}</caption><thead><tr><th scope="col">{t("Registro","Record")}</th><th scope="col">{t("Estado","Status")}</th><th scope="col">{t("Actualizado","Updated")}</th><th scope="col">{t("Acción","Action")}</th></tr></thead><tbody>{visible.map(record=><tr key={record.id} data-selected={selected?.id===record.id?"true":"false"}><th scope="row" style={{textTransform:"none",fontSize:14,background:"transparent",letterSpacing:0}}>{recordName(record)}<small style={{display:"block",fontWeight:400,overflowWrap:"anywhere"}}>{record.id}</small></th><td><span className={s.status}><DataValue value={recordStatus(record)} es={es}/></span></td><td>{new Date(record.updatedAt).toLocaleString(locale)}</td><td><button aria-expanded={selected?.id===record.id} aria-controls="carrier-record-detail" onClick={event=>{returnButton.current=event.currentTarget;void detail(record.id);}}>{t("Revisar","Review")}<ArrowRight size={14} aria-hidden="true"/></button></td></tr>)}</tbody></table></div>:null}
  <div className={s.pagination}><small>{t("Página de hasta 25 registros; búsqueda sobre lo consultado.","Up to 25 records per page; search covers fetched records.")}</small><div><button disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-25))}>{t("Anterior","Previous")}</button><button disabled={next===null||loading} onClick={()=>next!==null&&setOffset(next)}>{t("Siguiente","Next")}</button></div></div></section>
  {selected?<section className={`${s.card} ${s.recordDetail}`} id="carrier-record-detail"><div className={s.detailHeading}><div><span className={s.eyebrow}>{t("Registro seleccionado","Selected record")}</span><h2 ref={detailHeading} tabIndex={-1}>{recordName(selected)}</h2><small>{t("Versión","Version")} {selected.version} · {new Date(selected.updatedAt).toLocaleString(locale)}</small></div><button onClick={closeDetail} aria-label={t("Cerrar detalle","Close details")}><X size={18} aria-hidden="true"/></button></div>
   <div className={s.actions}>{canReviseCarrierRecord(access.role,resource)?<button onClick={()=>setEditor({schema:resource.schema!,initial:recordData(selected),path:path+"/"+selected.id+"/revisions",revision:selected.version,title:t("Editar registro","Edit record")})}>{t("Editar y crear revisión","Edit and create revision")}</button>:null}
   {resource.actions?.filter(command=>canCarrierAction(access.role,command.action,recordStatus(selected))).map(command=><button key={command.action} onClick={()=>action(command)}>{es?command.es:command.en}</button>)}
   {resource.key==="offers"&&canCarrierAction(access.role,"offers.supersede",recordStatus(selected))?<button disabled={!validCarrierId(String(recordData(selected).opportunityId??""))} onClick={()=>{const data=recordData(selected);setEditor({schema:manualOfferSchema,
    initial:{...data,supersedesOfferId:selected.id,source:{channel:"MANUAL",issuerId:access.operatorId,evidence:emptyInput(WorkflowInputsV2["offers.create"].innerType().shape.source.shape.evidence)}},
    path:"/api/v2/carriers/"+carrierId+"/opportunities/"+encodeURIComponent(String(data.opportunityId))+"/offers",title:t("Revisar y sustituir oferta","Review and supersede offer")});}}>{t("Revisar y sustituir oferta","Review and supersede offer")}</button>:null}
   {resource.key==="opportunities"&&canCarrierAction(access.role,"offers.create",recordStatus(selected))?<button className={s.primary} onClick={()=>{const data=recordData(selected),schema=manualOfferSchema;
     setEditor({schema,initial:{...emptyInput(schema) as Record<string,unknown>,planCandidateId:data.planId,coveredAssignmentIds:data.assignmentIds,
      coveredServiceIds:Array.isArray(data.assignmentSnapshots)?Array.from(new Set(data.assignmentSnapshots.map(item=>item&&typeof item==="object"&&"serviceId" in item?item.serviceId:null).filter(Boolean))):[],
      source:{channel:"MANUAL",issuerId:access.operatorId,evidence:emptyInput(WorkflowInputsV2["offers.create"].innerType().shape.source.shape.evidence)}},
      path:path+"/"+selected.id+"/offers",title:t("Registrar oferta propia","Record your offer")});}}>{t("Crear oferta","Create offer")}</button>:null}</div>
   <DataValue value={recordData(selected)} es={es}/></section>:null}</div>
  <EditorDialog editor={editor} onClose={()=>setEditor(null)} onSaved={()=>{setSelected(null);setRefresh(x=>x+1);}}/>
 </>;
}

function EditorDialog({editor,onClose,onSaved}:{editor:Editor|null;onClose:()=>void;onSaved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),busy=useRef(false);useEffect(()=>{busy.current=false;if(editor&&!dialog.current?.open)dialog.current?.showModal();if(!editor&&dialog.current?.open)dialog.current.close();},[editor]);
 return <dialog ref={dialog} className={s.dialog} aria-label={editor?.title} onCancel={e=>{e.preventDefault();if(!busy.current)onClose();}}>{editor?<ContractForm key={editor.path+editor.title} {...editor} onClose={onClose} onSaved={onSaved} onBusyChange={value=>{busy.current=value;}}/>:null}</dialog>;
}
