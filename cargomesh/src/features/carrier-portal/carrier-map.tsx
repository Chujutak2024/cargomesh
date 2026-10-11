"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Info, MapPin } from "lucide-react";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import { useLocale } from "@/features/i18n/locale-provider";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/features/v2-road-map/google-maps-loader";
import { portalErrorCopy, portalRequest } from "./api";
import { parseRecords, recordData, recordName } from "./records";
import { carrierResources, resourcePath } from "./resources";
import { coordinatePair, coverageGeometry } from "./map-model";
import { OpenStreetMap } from "./open-street-map";
import { valueLabel } from "./contract-form";
import s from "./portal.module.css";

type Layer="depots"|"positions"|"nodes"|"conditions"|"coverage";
export type CarrierMapPoint={id:string;label:string;layer:Layer;lat:number|null;lng:number|null;source:string;observedAt:string|null;state:string};
type Area={id:string;label:string;geometry:ReturnType<typeof coverageGeometry>;excluded:boolean;source:string;verifiedAt:string|null};
export function CarrierMap({carrierId}:{carrierId:string}){
 const {locale,t}=useLocale(),es=locale==="es";const [points,setPoints]=useState<CarrierMapPoint[]>([]),[errors,setErrors]=useState<string[]>([]),[partial,setPartial]=useState(false),[loading,setLoading]=useState(true);
 const [layers,setLayers]=useState<Layer[]>(["depots","positions","nodes","conditions","coverage"]),[selected,setSelected]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
 const [services,setServices]=useState<Array<{id:string;label:string}>>([]),[serviceId,setServiceId]=useState(""),[areas,setAreas]=useState<Area[]>([]),[areaError,setAreaError]=useState("");
 const polygons=useRef<google.maps.Polygon[]>([]);
 const [useOsm,setUseOsm]=useState(false);
 const [provider,setProvider]=useState<"loading"|"google"|"osm"|"unavailable">("loading");const host=useRef<HTMLDivElement>(null),map=useRef<google.maps.Map|null>(null),markers=useRef<google.maps.Marker[]>([]);
 useEffect(()=>{const controller=new AbortController();setPoints([]);setErrors([]);setLoading(true);setPartial(false);
  const sources=["depots","executions","nodes","conditions"] as const;
  void Promise.allSettled(sources.map(async key=>{
   const resource=carrierResources.find(r=>r.key===key);
   const result=await portalRequest(key==="nodes"||key==="conditions"?"/api/v2/carrier-portal/carriers/"+encodeURIComponent(carrierId)+"/routing/"+key+"?limit=100&offset=0":resourcePath(carrierId,resource!,"")+"?limit=100&offset=0",{signal:controller.signal});
   if(!Array.isArray(result.data))throw new Error("Invalid response");
   const records=key==="nodes"||key==="conditions"?result.data.map(row=>{const record=WorkflowRecordV2Schema.parse(row);if(record.kind!==key)throw new Error("Invalid response");return record;}):parseRecords(resource!,result.data,carrierId);
   const mapped=records.map(record=>{
    const data=recordData(record),location=key==="executions"?data.lastKnownPosition:data.location;
    const source=data.source&&typeof data.source==="object"?data.source as Record<string,unknown>:null;
    const conditionLocation=location&&typeof location==="object"?location as Record<string,unknown>:null;
    return{id:record.id,label:key==="conditions"?valueLabel(String(data.kind),es)+" · "+String(conditionLocation?.city??conditionLocation?.label??record.id):recordName(record),layer:key==="executions"?"positions":key,...coordinatePair(location),
     source:key==="executions"?t("Última posición registrada; no es GPS en vivo","Last recorded position; not live GPS"):source?String(source.provider):t("Registro del transportista","Carrier record"),
     observedAt:typeof data.observedAt==="string"?data.observedAt:source?.observedAt?String(source.observedAt):null,state:key==="conditions"?String(data.confidence):source?.provenanceStatus?String(source.provenanceStatus):"UNKNOWN"} as CarrierMapPoint;
   });return{mapped,partial:result.meta?.nextOffset!=null};
  })).then(results=>{if(controller.signal.aborted)return;setPoints(results.flatMap(r=>r.status==="fulfilled"?r.value.mapped:[]));
   const sourceLabels=[t("Depósitos","Depots"),t("Posiciones","Positions"),t("Nodos publicados","Published nodes"),t("Condiciones publicadas","Published conditions")];
   setPartial(results.some(r=>r.status==="fulfilled"&&r.value.partial));setErrors(results.flatMap((r,i)=>r.status==="rejected"?[sourceLabels[i]+": "+portalErrorCopy(r.reason,es)]:[]));setLoading(false);
  });return()=>controller.abort();
 },[carrierId,es,t,refresh]);
 useEffect(()=>{const controller=new AbortController();setServices([]);setServiceId("");
  const resource=carrierResources.find(r=>r.key==="services")!;
  void portalRequest(resourcePath(carrierId,resource,"")+"?limit=100&offset=0",{signal:controller.signal})
   .then(result=>{if(!controller.signal.aborted)setServices(parseRecords(resource,result.data,carrierId).map(record=>({id:record.id,label:recordName(record)})));})
   .catch(error=>{if(!controller.signal.aborted)setAreaError(portalErrorCopy(error,es));});return()=>controller.abort();
 },[carrierId,es,refresh]);
 useEffect(()=>{const controller=new AbortController();setAreas([]);setAreaError("");if(!serviceId)return()=>controller.abort();
  const resource=carrierResources.find(r=>r.key==="areas")!;
  void portalRequest(resourcePath(carrierId,resource,serviceId)+"?limit=100&offset=0",{signal:controller.signal}).then(result=>{
   if(controller.signal.aborted)return;setAreas(parseRecords(resource,result.data,carrierId).map(record=>{
    const data=recordData(record),geography=data.geography as Record<string,unknown>;
    return{id:record.id,label:String(geography.city??geography.region??geography.countryCode)+" · "+valueLabel(String(data.role),es),geometry:coverageGeometry(geography.geometry),excluded:data.inclusion==="EXCLUDE",source:valueLabel(String(data.source),es),verifiedAt:typeof data.verifiedAt==="string"?data.verifiedAt:null};
   }));
  }).catch(error=>{if(!controller.signal.aborted)setAreaError(portalErrorCopy(error,es));});return()=>controller.abort();
 },[carrierId,serviceId,es,refresh]);
 const visible=useMemo(()=>points.filter(p=>layers.includes(p.layer)),[points,layers]);
 useEffect(()=>{let cancelled=false;const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();
  if(!key){setUseOsm(true);return;}
  const off=onGoogleMapsAuthFailure(()=>{setUseOsm(true);map.current=null;});
  void loadGoogleMaps(key).then(()=>{if(cancelled||!host.current)return;map.current=new google.maps.Map(host.current,{center:{lat:0,lng:0},zoom:2,gestureHandling:"cooperative",mapTypeControl:false,streetViewControl:false,fullscreenControl:true});setProvider("google");}).catch(()=>{if(!cancelled)setUseOsm(true);});
  return()=>{cancelled=true;off();markers.current.forEach(m=>m.setMap(null));polygons.current.forEach(p=>p.setMap(null));map.current=null;};
 },[]);
 useEffect(()=>{if(!map.current||provider!=="google")return;markers.current.forEach(m=>m.setMap(null));markers.current=[];
  polygons.current.forEach(p=>p.setMap(null));polygons.current=[];
  const bounds=new google.maps.LatLngBounds();visible.forEach(point=>{if(point.lat===null||point.lng===null)return;
   const position={lat:point.lat,lng:point.lng};const marker=new google.maps.Marker({position,map:map.current!,title:point.label,
    label:{text:point.layer==="positions"?"T":point.layer==="depots"?"D":point.layer==="conditions"?"!":"N",color:"white"},
    icon:{path:google.maps.SymbolPath.CIRCLE,fillColor:point.id===selected?"#185be7":point.layer==="positions"?"#008b91":"#153e55",fillOpacity:1,strokeColor:"white",strokeWeight:3,scale:point.id===selected?14:11}});
   marker.addListener("click",()=>setSelected(point.id));markers.current.push(marker);bounds.extend(position);
  });if(layers.includes("coverage"))areas.forEach(area=>{
   if(!area.geometry)return;const color=area.excluded?"#b33c48":"#00747c";
   if(area.geometry.type==="Polygon"){
    const paths=area.geometry.coordinates.map(ring=>ring.map(([lng,lat])=>({lat,lng})));
    const polygon=new google.maps.Polygon({paths,map:map.current!,fillColor:color,fillOpacity:.12,strokeColor:color,strokeWeight:2});polygons.current.push(polygon);
    paths.flat().forEach(position=>bounds.extend(position));
   }else area.geometry.coordinates.forEach(([lng,lat])=>{const marker=new google.maps.Marker({position:{lat,lng},map:map.current!,title:area.label,label:area.excluded?"−":"+"});markers.current.push(marker);bounds.extend({lat,lng});});
  });if(!bounds.isEmpty())map.current.fitBounds(bounds,40);
  return()=>{markers.current.forEach(m=>m.setMap(null));polygons.current.forEach(p=>p.setMap(null));};
 },[visible,selected,provider,layers,areas]);
 useEffect(()=>{if(selected&&!visible.some(p=>p.id===selected))setSelected(null);},[selected,visible]);
 const point=visible.find(p=>p.id===selected);
 return <><div className={s.notice}>{t("Las posiciones son registros, no seguimiento GPS. No se dibujan trayectos sin geometría publicada y procedencia verificable.","Positions are records, not GPS tracking. No paths are drawn without published geometry and verifiable provenance.")}</div>
 <div className={s.mapLayout}><section className={s.card}><div className={s.heading}><div><h2>{t("Tu red sobre el mapa","Your network on the map")}</h2><p>{t("Depósitos, posiciones, nodos y condiciones publicadas. La cobertura dibujada es un registro, no una confirmación de elegibilidad.","Depots, positions, published nodes and conditions. Drawn coverage is a record, not an eligibility confirmation.")}</p></div><button onClick={()=>setRefresh(x=>x+1)} disabled={loading}>{t("Actualizar","Refresh")}</button></div>
 <div className={s.mapSurface}><div ref={host} hidden={useOsm||provider==="unavailable"} role="region" aria-label={t("Mapa geográfico de la operación","Geographic operations map")}/>{useOsm?<OpenStreetMap points={visible} areas={layers.includes("coverage")?areas:[]} selected={selected} onSelect={setSelected} onStatus={setProvider} label={t("Mapa geográfico de la operación","Geographic operations map")}/>:null}{provider!=="google"&&provider!=="osm"?<div className={s.mapEmpty}><MapPin size={32} aria-hidden="true"/><h3>{provider==="loading"?t("Cargando mapa…","Loading map…"):t("Mapa no disponible","Map unavailable")}</h3><p>{t("La lista mantiene las referencias y su procedencia.","The list retains references and provenance.")}</p></div>:null}</div>
 <div className={s.mapNote}><Info size={15} aria-hidden="true"/><span>{provider==="google"?t("Mapa: Google Maps Platform · Capas registradas · Geometría de ruta no disponible","Map: Google Maps Platform · Recorded layers · Route geometry unavailable"):provider==="osm"?t("Mapa: OpenStreetMap · Capas registradas · Geometría de ruta no disponible","Map: OpenStreetMap · Recorded layers · Route geometry unavailable"):t("Proveedor cartográfico no disponible","Map provider unavailable")}</span></div>
 {partial?<p>{t("La consulta incluye hasta 100 registros por capa; hay más datos fuera de esta vista.","Up to 100 records per layer are fetched; additional data is outside this view.")}</p>:null}
 {errors.map((error,i)=><p key={i} role="alert" className={s.error}>{error}</p>)}</section>
 <section className={s.card}><h2>{t("Capas y referencias","Layers and references")}</h2><div className={s.layers}>{(["depots","positions","nodes","conditions","coverage"] as Layer[]).map(layer=><label key={layer}><input type="checkbox" checked={layers.includes(layer)} onChange={e=>setLayers(current=>e.target.checked?[...current,layer]:current.filter(x=>x!==layer))}/>{layer==="depots"?t("Depósitos","Depots"):layer==="positions"?t("Posiciones","Positions"):layer==="nodes"?t("Nodos publicados","Published nodes"):layer==="conditions"?t("Condiciones publicadas","Published conditions"):t("Áreas registradas","Recorded areas")}</label>)}</div>
 <label style={{display:"grid",gap:8,marginTop:20}}>{t("Cobertura de un servicio","Service coverage")}<select value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">{t("Seleccionar servicio","Select service")}</option>{services.map(service=><option key={service.id} value={service.id}>{service.label}</option>)}</select></label>
 <small>{t("Hasta 100 servicios y áreas por consulta.","Up to 100 services and areas per query.")}</small>{areaError?<p className={s.error} role="alert">{areaError}</p>:null}
 {layers.includes("coverage")?areas.map(area=><div key={area.id} style={{marginTop:12}}><strong>{area.label}</strong><p>{area.excluded?t("Exclusión registrada","Recorded exclusion"):t("Inclusión registrada","Recorded inclusion")} · {area.source} · {area.geometry?t("Geometría registrada","Recorded geometry"):t("Sin geometría publicada","No published geometry")}</p><small>{area.verifiedAt?new Date(area.verifiedAt).toLocaleString(locale):t("Sin fecha de verificación","No verification date")}</small></div>):null}
 <p style={{marginTop:16}}>{loading?t("Consultando referencias…","Loading references…"):visible.length+" "+t("referencias consultadas","fetched references")}</p>
 <div className={s.mapPointList}>{visible.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}>{p.label}<small>{p.lat===null||p.lng===null?t("Sin coordenadas","No coordinates"):p.state}</small></button>)}</div>
 {!loading&&!visible.length?<p>{t("Sin referencias disponibles en estas capas.","No references available in these layers.")}</p>:null}
 {point?<><h3 style={{marginTop:20}}>{point.label}</h3><dl className={s.details}><div><dt>{t("Fuente","Source")}</dt><dd>{point.source}</dd></div><div><dt>{t("Estado de datos","Data state")}</dt><dd>{point.state}</dd></div><div><dt>{t("Observado","Observed")}</dt><dd>{point.observedAt?new Date(point.observedAt).toLocaleString(locale):t("Sin fecha de observación","No observation date")}</dd></div><div><dt>{t("Coordenadas","Coordinates")}</dt><dd>{point.lat!==null&&point.lng!==null?point.lat+", "+point.lng:t("No disponibles","Unavailable")}</dd></div></dl></>:null}</section></div></>;
}
