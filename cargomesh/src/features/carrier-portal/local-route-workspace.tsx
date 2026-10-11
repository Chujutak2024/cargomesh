"use client";
import {useMemo} from "react";
import {ArrowRight,Building2,CalendarDays,MapPin,Package,Route,Truck} from "lucide-react";
import type {LocalDraft} from "./local-draft-model";
import {LocalRoute,locationLabel} from "./local-draft-controls";
import {useOperations} from "./use-operations";
import {useFleetDemo} from "./use-fleet-demo";
import {demoFleetVehicles} from "./fleet-demo";
import {carrierCovers,requestOperation} from "./operations-model";
import {RequestIncidents} from "./request-incidents";
import {truckLabel} from "./local-truck-preference";
import {fleetReferencePhoto} from "./fleet-photos";
import {operationalPanel} from "./carrier-sites";
import {localRequestReference} from "./local-request-presentation";
import s from "./operations.module.css";
import type {LocalRequestEntry} from "./local-request-demo";
import {RouteRequestPicker} from "./route-request-picker";
import {LocalRequestJourney} from "./local-request-journey";
export function LocalRouteWorkspace({requestId,draft,onInspect,entries,select}:{requestId:string;draft:LocalDraft;onInspect?:()=>void;entries:LocalRequestEntry[];select:(id:string)=>boolean}){const ops=useOperations(),{demo}=useFleetDemo(ops.inventory,ops.ready),vehicles=useMemo(()=>demoFleetVehicles(demo,ops.inventory),[demo,ops.inventory]),op=requestOperation(ops.state,requestId),unit=vehicles.find(v=>v.id===op.vehicleId),carriers=ops.state.carriers.filter(c=>carrierCovers(c,draft.originId,draft.destinationId));const date=(v:string)=>v?new Date(v+"T12:00:00").toLocaleDateString("es-PE",{day:"numeric",month:"short"}):"Por definir";
 return <div className={s.root}><section className={s.routeHero} aria-label="Resumen operativo de ruta"><div><div className={s.chips}><span>{localRequestReference(requestId)}</span><span>{op.status==="CANCELLED"?"Solicitud cancelada":op.incidents.some(i=>!i.resolvedAt)?"Incidencia pendiente":"Plan de transporte"}</span></div><h2 className="cm-mt-3">{locationLabel(draft.originId,"es")}<ArrowRight size={20}/>{locationLabel(draft.destinationId,"es")}</h2><p>{draft.cargoDescription}</p></div><div className={s.routeMetrics}><div><span className={s.row}><Package size={14}/>Carga</span><strong>{(draft.quantity*draft.unitWeightKg).toLocaleString("es-PE")} kg</strong></div><div><span className={s.row}><CalendarDays size={14}/>Recogida</span><strong>{date(draft.pickupDate)}</strong></div><div><span className={s.row}><CalendarDays size={14}/>Entrega</span><strong>{date(draft.deliveryDate)}</strong></div></div></section>
 <LocalRequestJourney onOpenMap={()=>{const node=document.getElementById("active-request-map");node?.focus({preventScroll:true});node?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}} key={"journey-"+requestId} draft={draft} requestId={requestId} inactive={op.status==="CANCELLED"}/><LocalRoute draft={draft} requestId={requestId} inactive={op.status==="CANCELLED"} preference={unit&&op.status!=="CANCELLED"?{type:unit.variant,model:unit.model??"",photoDataUrl:null}:undefined} sidebar={<RouteRequestPicker entries={entries} activeId={requestId} select={select}/>}/>
 <div className={s.routeBelow}><section className={operationalPanel}><div className={s.header}><h3 className={s.row}><Building2 size={20} color="#0b8a8c"/>Carriers y cobertura</h3><a href="#/fleet/carriers">Ver sedes</a></div>{carriers.length?<div className={s.coverageList}>{carriers.map(c=><div key={c.id}><span className={s.carrierMark} style={{background:c.color}}>{c.name.slice(0,1)}</span><span><strong>{c.name}</strong><small>{c.sites.length} sedes · trayecto registrado</small></span><span className={s.statusPill}>En alcance</span></div>)}</div>:<p>No hay un carrier con este trayecto registrado. Consulta las sedes y sus alcances.</p>}<p className={s.hint}>La cobertura del trayecto se consulta por separado de la disponibilidad del camión.</p></section>
 <section className={operationalPanel}><div className={s.header}><h3 className={s.row}><Truck size={20} color="#8061be"/>Camión y planificación</h3><a href={unit?`#/fleet/vehicle/${unit.id}`:"#/request/route"}>{unit?"Ver unidad":"Cambiar preferencia"}</a></div>{unit?<div className={s.truckMini}><img src={fleetReferencePhoto(unit).src} alt=""/><div><strong>{unit.code} · {unit.plate}</strong><small>{unit.model}</small><small>{unit.capacityKg.toLocaleString("es-PE")} kg · {op.status==="CANCELLED"?"programación cancelada":"reemplazo programado"}</small></div></div>:<div className={s.truckMini}><Truck size={34} color="#5892a1"/><div><strong>{truckLabel(draft.truckPreference,"es")}</strong><small>Preferencia de equipo · unidad por asignar</small></div></div>}<div className={s.timeline}><div><span>Recogida prevista</span><strong>{date(draft.pickupDate)}</strong><small>{locationLabel(draft.originId,"es")}</small></div><div><span>Entrega prevista</span><strong>{date(draft.deliveryDate)}</strong><small>{locationLabel(draft.destinationId,"es")}</small></div></div></section></div>
 {onInspect?<button type="button" onClick={onInspect} className={s.row}><Truck size={17}/>Ver resumen del camión<ArrowRight size={15}/></button>:null}
 <RequestIncidents key={"incidents-"+requestId} requestId={requestId} draft={draft} vehicles={vehicles}/>
 </div>;
}
