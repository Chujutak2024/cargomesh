"use client";
import dynamic from "next/dynamic";
import {useEffect,useId,useMemo,useRef,useState} from "react";
import {ArrowRight,Check,MapPin,Search,X} from "lucide-react";
import {displayDemoText,isHiddenClientFacility} from "@/shared/lib/demo-presentation";
import {filterIntakeFacilities} from "../prototype-model";
import type {IntakeFacilityOption} from "../contracts";
import {locatedFacility,type FacilityViewport} from "./facility-selection-model";
import {useFacilityRoadPreview} from './use-facility-road-preview';
import styles from "./facility-selection-workspace.module.css";

const FacilitySelectionMap=dynamic(()=>import("./facility-selection-map"),{ssr:false,loading:()=> <div className={styles.mapStatus} role="status">Loading map…</div>});
type Role="origin"|"destination";
type Props={facilities:IntakeFacilityOption[];originId:string;destinationId:string;originError?:string;destinationError?:string;onChange:(role:Role,id:string)=>void;t:(es:string,en:string)=>string};
function inViewport(facility:IntakeFacilityOption,bounds:FacilityViewport){
 if(!locatedFacility(facility))return false;
 return facility.lat!>=bounds.south&&facility.lat!<=bounds.north&&(bounds.west<=bounds.east?facility.lng!>=bounds.west&&facility.lng!<=bounds.east:facility.lng!>=bounds.west||facility.lng!<=bounds.east);
}
export function FacilitySelectionWorkspace({facilities,originId,destinationId,originError,destinationError,onChange,t}:Props){
 const [role,setRole]=useState<Role>(originId&&!destinationId?"destination":"origin");
 const [queries,setQueries]=useState({origin:"",destination:""});
 const [country,setCountry]=useState("");
 const [onlyLocated,setOnlyLocated]=useState(false),[recentOnly,setRecentOnly]=useState(false),[recent,setRecent]=useState<string[]>([]);
 const [previewId,setPreviewId]=useState<string|null>(null),[viewport,setViewport]=useState<FacilityViewport|null>(null),[area,setArea]=useState<FacilityViewport|null>(null);
 const [focus,setFocus]=useState<IntakeFacilityOption|null>(null);
 const [centeredIds,setCenteredIds]=useState<string[]|null>(null);
 const [cameraTarget,setCameraTarget]=useState<{sequence:number;facilities:IntakeFacilityOption[]}|null>(null);
 const inputId=useId();
 const authorized=useMemo(()=>facilities.filter(f=>!isHiddenClientFacility(f.code,f.facilityId)),[facilities]);
 const countries=useMemo(()=>[...new Set(authorized.map(f=>f.countryCode))].sort(),[authorized]);
 const countryNames=new Intl.DisplayNames([t('es','en')],{type:'region'});
 const origin=authorized.find(f=>f.facilityId===originId),destination=authorized.find(f=>f.facilityId===destinationId);
 const road=useFacilityRoadPreview(origin??null,destination??null);
 const previousSelection=useRef({originId,destinationId});
 useEffect(()=>{
  const previous=previousSelection.current;
  if(previous.originId===originId&&previous.destinationId===destinationId)return;
  previousSelection.current={originId,destinationId};
  const changed=previous.originId!==originId?origin:destination;
  setCenteredIds(null);setCameraTarget(null);setPreviewId(null);setFocus(changed??null);
 },[originId,destinationId,origin,destination]);
 const selectedId=role==='origin'?originId:destinationId,excludedId=role==='origin'?destinationId:originId;
 const filtered=useMemo(()=>filterIntakeFacilities(authorized,queries[role],centeredIds?'':excludedId).filter(f=>(!country||f.countryCode===country)&&(!onlyLocated||locatedFacility(f))&&(!recentOnly||recent.includes(f.facilityId))&&(!area||inViewport(f,area))&&(!centeredIds||centeredIds.includes(f.facilityId))),[authorized,queries,role,excludedId,country,onlyLocated,recentOnly,recent,area,centeredIds]);
 const preview=authorized.find(f=>f.facilityId===previewId)??null;
 const currentError=role==='origin'?originError:destinationError;
 function choose(facility:IntakeFacilityOption){
  if(facility.facilityId===excludedId)return;
  onChange(role,facility.facilityId);setRecent(ids=>[facility.facilityId,...ids.filter(id=>id!==facility.facilityId)].slice(0,8));setPreviewId(null);setFocus({...facility});setCameraTarget(null);
  if(role==='origin'&&!destinationId){setRole('destination');setCenteredIds(null);}
 }
 function resetFilters(){setCountry('');setOnlyLocated(false);setRecentOnly(false);setArea(null);setCenteredIds(null);}
 function centerFacilities(){
  const selected=[origin,destination].filter((f):f is IntakeFacilityOption=>Boolean(f)).filter(locatedFacility);
  const targets=selected.length?selected:filtered.filter(locatedFacility);
  if(!targets.length)return;
  resetFilters();setQueries(q=>({...q,[role]:''}));setCenteredIds(targets.map(f=>f.facilityId));setPreviewId(null);setFocus(null);
  setCameraTarget(previous=>({sequence:(previous?.sequence??0)+1,facilities:targets}));
 }
 return <div className={styles.workspace}>
  <section className={styles.listPanel} aria-label={t('Elegir sedes','Choose facilities')}>
   <div className={styles.segments} role="group" aria-label={t('Punto del envío','Shipment endpoint')}>
    {(['origin','destination'] as const).map(kind=><button key={kind} type="button" aria-pressed={role===kind} onClick={()=>{setRole(kind);setPreviewId(null);setArea(null);setCenteredIds(null);const endpoint=kind==='origin'?origin:destination;if(endpoint){setFocus({...endpoint});setCameraTarget(null);}}}><span>{kind==='origin'?'A':'B'}</span>{kind==='origin'?t('Origen','Origin'):t('Destino','Destination')}{(kind==='origin'?originId:destinationId)&&<Check size={15} aria-hidden="true"/>}</button>)}
   </div>
   <label className={styles.search} htmlFor={inputId}><Search size={18} aria-hidden="true"/><span className={styles.srOnly}>{role==='origin'?t('Buscar sede de origen','Search origin facility'):t('Buscar sede de destino','Search destination facility')}</span><input id={inputId} type="search" autoComplete="off" value={queries[role]} placeholder={role==='origin'?t('Buscar origen…','Search origin…'):t('Buscar destino…','Search destination…')} onChange={event=>{setQueries(q=>({...q,[role]:event.target.value}));setCenteredIds(null);}}/></label>
   <div className={styles.filters} aria-label={t('Filtrar sedes','Filter facilities')}>
    <button type="button" aria-pressed={!country&&!onlyLocated&&!recentOnly&&!area&&!centeredIds} onClick={resetFilters}>{t('Todas','All')} · {authorized.filter(f=>f.facilityId!==excludedId).length}</button>
    <button type="button" aria-pressed={onlyLocated} onClick={()=>{setOnlyLocated(value=>!value);setCenteredIds(null);}}>{t('Con ubicación','Located')}</button>
    {countries.map(code=><button type="button" key={code} aria-pressed={country===code} onClick={()=>{setCountry(current=>current===code?'':code);setArea(null);setCenteredIds(null);setPreviewId(null);}}>{countryNames.of(code)??code}</button>)}
    <button type="button" aria-pressed={recentOnly} onClick={()=>{setRecentOnly(value=>!value);setCenteredIds(null);}}>{t('Recientes','Recent')}</button>
   </div>
   <div className={styles.listHeading} aria-live="polite"><span>{filtered.length} {centeredIds?t('sedes centradas','centered facilities'):t('sedes','facilities')}</span>{(area||centeredIds)&&<button type="button" onClick={()=>{setArea(null);setCenteredIds(null);}}>{t('Quitar filtro del mapa','Clear map filter')} <X size={12} aria-hidden="true"/></button>}</div>
   {currentError&&<p role="alert" className={styles.error}>{currentError}</p>}
   <div className={styles.facilityList} role="group" aria-label={role==='origin'?t('Sedes de origen','Origin facilities'):t('Sedes de destino','Destination facilities')}>
    {filtered.map(facility=><button type="button" className={styles.facility} key={facility.facilityId} disabled={facility.facilityId===excludedId} title={facility.facilityId===excludedId?t('Ya elegida en el otro extremo','Already selected at the other endpoint'):undefined} aria-pressed={selectedId===facility.facilityId} data-preview={previewId===facility.facilityId} onClick={()=>choose(facility)}>
     <span className={styles.radio} aria-hidden="true">{selectedId===facility.facilityId&&<span/>}</span><span className={styles.facilityCopy}><strong>{displayDemoText(facility.label)||facility.city}</strong><span className={styles.meta}><code>{facility.code}</code><span>{[facility.city,facility.region!==facility.city?facility.region:null,facility.countryCode].filter(Boolean).join(' · ')}</span></span></span>
    </button>)}
    {!filtered.length&&<div className={styles.empty} role="status"><MapPin size={22} aria-hidden="true"/><strong>{t('No hay coincidencias','No matching facilities')}</strong><p>{recentOnly?t('Las sedes que elijas aparecerán aquí.','Facilities you select will appear here.'):t('Cambia el texto, el país o el área del mapa.','Try another search, country, or map area.')}</p><button type="button" onClick={()=>{resetFilters();setQueries(q=>({...q,[role]:''}));}}>{t('Limpiar filtros','Clear filters')}</button></div>}
   </div>
   <div className={styles.routeStrip} aria-label={t('Sedes seleccionadas','Selected facilities')}><span><b>A</b>{origin?.city??t('Elegir origen','Choose origin')}</span><ArrowRight size={15} aria-hidden="true"/><span data-destination="true"><b>B</b>{destination?.city??t('Elegir destino','Choose destination')}</span></div>
  </section>
  <section className={styles.mapPanel} aria-label={t('Mapa de sedes','Facilities map')}>
   <FacilitySelectionMap origin={origin??null} destination={destination??null} preview={preview} focus={focus} cameraTarget={cameraTarget} route={road.result} onPreview={setPreviewId} onViewport={setViewport} t={t}/>
   <div className={styles.mapToolbar}>{country&&<span>{countryNames.of(country)??country}</span>}<button type="button" disabled={!viewport} onClick={()=>{setArea(viewport);setCenteredIds(null);}}>{t('Buscar en esta área','Search this area')}</button><button type="button" aria-pressed={Boolean(centeredIds)} disabled={![origin,destination,...filtered].some(f=>f&&locatedFacility(f))} onClick={centerFacilities}>{t('Centrar sedes','Center facilities')}</button></div>
   {preview&&<aside className={styles.mapPopup}><button type="button" className={styles.popupClose} aria-label={t('Cerrar sede','Close facility')} onClick={()=>setPreviewId(null)}><X size={15} aria-hidden="true"/></button><strong>{displayDemoText(preview.label)||preview.city}</strong><small>{preview.code} · {preview.city} · {preview.countryCode}</small><button type="button" disabled={preview.facilityId===excludedId} onClick={()=>choose(preview)}>{preview.facilityId===excludedId?t('Ya elegida en el otro extremo','Already selected at the other endpoint'):role==='origin'?t('Elegir como origen','Set as origin'):t('Elegir como destino','Set as destination')}</button></aside>}
   {road.status==='empty'?<span className={styles.mapCaption}>{t('Elige origen y destino para consultar carreteras','Choose origin and destination to check roads')}</span>:<div className={styles.routeStatus} role="status" data-state={road.status}>
    <strong>{road.status==='blocked'?(road.result?.status==='blocked'&&road.result.reason==='DISCONNECTED_NETWORKS'?t('Sin conexión terrestre','No land connection'):t('No se encontró ruta vial','No driving route found')):road.status==='estimated'?t('Ruta por carretera estimada','Estimated driving route'):road.status==='checking'?t('Consultando carreteras…','Checking roads…'):t('Ruta vial sin verificar','Road route unverified')}</strong>
    <span>{road.result?.status==='estimated'?`${new Intl.NumberFormat(t('es','en'),{maximumFractionDigits:1}).format(road.result.distanceMeters/1000)} km · ${new Intl.NumberFormat(t('es','en'),{maximumFractionDigits:1}).format(road.result.durationSeconds/3600)} h · ${t('Acceso de camiones y cobertura pendientes','Truck access and coverage unverified')}`:road.status==='blocked'?(road.result?.status==='blocked'&&road.result.reason==='DISCONNECTED_NETWORKS'?t('Este trayecto no se puede realizar solo por carretera. El borrador no confirma transporte marítimo o aéreo.','This journey cannot be completed by road alone. The draft does not confirm sea or air transport.'):t('El proveedor no devolvió una ruta vial para estas sedes. Revisa los puntos elegidos.','The provider returned no driving route for these facilities. Review the selected locations.')):road.result?.status==='unavailable'&&road.result.reason==='COORDINATES_REQUIRED'?t('Faltan coordenadas en una de las sedes.','One facility has no coordinates.'):t('La línea punteada entre A y B es esquemática; no confirma una carretera ni cobertura.','The dotted A–B connection is schematic; it does not confirm a road or coverage.')}</span>
   </div>}
  </section>
 </div>;
}
