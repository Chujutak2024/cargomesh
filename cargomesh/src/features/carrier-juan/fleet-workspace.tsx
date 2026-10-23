"use client";
import {SearchField} from "@/components/ui";
import {useFleetIncidents} from './use-fleet-incidents';
import {CarrierSkeleton,CarrierUpdating} from "@/features/carrier-navigation/carrier-loading";
import {useCarrierMemoryState} from "@/features/carrier-navigation/carrier-continuity";
import {carrierDisplayName} from '@/shared/lib/display-identity';
import {readJuanHash,navigateJuanHash,subscribeJuanRoute,juanHref} from "./juan-navigation";

import dynamic from "next/dynamic";
import {createPortal} from "react-dom";
import {CarrierLink} from "@/features/carrier-navigation/carrier-link";
import views from "./commercial-workspace.module.css";
import {CarrierKpis} from "./carrier-kpis";
import {DriversWorkspace} from "./drivers-workspace";
import {ServiceSpecifications} from "./service-specifications";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Download, Fuel, Gauge, LayoutGrid, List, MapPin, RefreshCw, Search, ShieldCheck, Truck, UsersRound, Plus, Wrench, Package, Clock3 } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { ContentMotion } from "@/features/product-motion/content-motion";
import { portalErrorCopy } from "./api";
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import type {PortalRecord} from '@/features/carrier-portal/records';
import {recordData,recordName} from '@/features/carrier-portal/records';
import {connectedDriver} from '@/features/carrier-portal/connected-fleet-presentation';
import {ConnectedCrew} from '@/features/carrier-portal/connected-crew';
import {ConnectedTruckRegistration} from './connected-truck-registration';
import {useConnectedFleet} from './use-connected-fleet';
import { EXAMPLE_AS_OF, filterFleet, fleetSummary, remainingRangeKm, matchesFleetFilter, type FleetFilter, type FleetSort, type FleetStatus, type FleetVehicle } from "./fleet-model";
import { applyDemoCommand, createFleetDemo, demoFleetVehicles, type DemoCommand } from "./fleet-demo";
import { useFleetDemo } from "./use-fleet-demo";
import { FleetAssignmentBoard, FleetCoverage, FleetJourneySummary } from "./fleet-operational-views";
import { DriverPortrait, DriverProfile } from "./driver-profile";
import {useOperations} from "./use-operations";
import {CarrierSites} from "./carrier-sites";
import {TruckRegistration} from "./truck-registration";
import {vehicleCarrierId} from "./operations-model";
import {TruckInspection} from "./truck-inspection";
import {inspectFleet} from "./truck-inspection-model";
import s from "./fleet.module.css";
import {fleetCardIdentity} from "./fleet-card-identity";
import {RegularDriverEditor} from "./regular-driver-editor";
import {capacityFilters,fleetTruckType,fleetTruckTypeLabel,matchesDirectoryFilters,type FleetCapacityFilter} from './fleet-directory-filters';
import {FleetTruckPreview} from './fleet-truck-preview';

const AssociatedTruck = dynamic(()=>import("@/features/logistics-3d/logistics-truck").then(m=>m.LogisticsTruck),{ssr:false,loading:()=> <p role="status">Preparing the associated 3D model…</p>});

function serviceCaption(row:PortalRecord,compact=false){
 const d=recordData(row),temperature=d.temperatureRange as {minCelsius:number;maxCelsius:number}|null;
 const name=temperature?(d.serviceClass==='LTL'?'Shared temperature-controlled cargo':'Temperature-controlled cargo'):(d.serviceClass==='LTL'?'Shared cargo transport':'Cargo transport');
 if(compact)return name;
 const weight=typeof d.maxWeightKg==='number'?d.maxWeightKg>=1000?`Up to ${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(d.maxWeightKg/1000)} tonnes`:`Up to ${d.maxWeightKg.toLocaleString('en-US')} kg`:'Load limit not specified';
 const status=({ACTIVE:'Active',INACTIVE:'Inactive',SUSPENDED:'Suspended'} as Record<string,string>)[String(d.status)]??String(d.status);
 return [weight,temperature?`${temperature.minCelsius} to ${temperature.maxCelsius} °C`:'Temperature not specified',d.status==='ACTIVE'?null:status].filter(Boolean).join(' · ');
}

const filters: { id: FleetFilter; es: string; en: string }[] = [
  { id: "all", es: "Todos", en: "All" }, { id: "service", es: "En servicio", en: "In service" },
  { id: "maintenance", es: "En taller", en: "In shop" }, { id: "due", es: "Servicio próximo", en: "Service due" },
  { id: "fuel", es: "Combustible bajo", en: "Low fuel" }, { id: "reefer", es: "Refrigerados", en: "Reefers" },
];
const statusLabels: Record<FleetStatus, [string, string]> = { AVAILABLE: ["Disponible", "Available"],
  IN_SERVICE: ["En servicio", "In service"], MAINTENANCE: ["En taller", "In shop"], OUT_OF_SERVICE: ["Fuera de servicio", "Out of service"] };
function VehicleStatus({ vehicle }: { vehicle: FleetVehicle }) {
  const { t } = useLocale();
  return <span className={s.status} data-status={vehicle.status}><span aria-hidden="true" />{t(...statusLabels[vehicle.status])}</span>;
}
function FuelValue({ value }: { value: number | null }) {
  const { t } = useLocale();
  return <><strong>{value === null ? "—" : value + "%"}</strong>{value === null ? <small>{t("Sin lectura", "No reading")}</small>
    : <meter className={s.fuelMeter} min={0} max={100} low={25} high={100} optimum={80} value={value} aria-label={t("Nivel de combustible", "Fuel level")} />}</>;
}
function ServiceValue({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  return vehicle.maintenance ? <><strong className={s.serviceDate}>{new Date(vehicle.maintenance.startsAt).toLocaleDateString(localeTag, { day: "numeric", month: "short" })}</strong>
    <small>{vehicle.maintenance.kind}</small></> : <><strong>—</strong><small>{t("Sin registro", "No record")}</small></>;
}
function ReferencePhoto({ vehicle }: { vehicle: FleetVehicle; eager?: boolean }) {
  return <FleetTruckPreview vehicle={vehicle}/>;
}
function VehicleFacts({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  const date = (value: string | null) => value ? new Date(value.length === 10 ? value + "T12:00:00Z" : value).toLocaleDateString(localeTag) : "—";
  return <>
    <dl className={s.vehicleFacts}>
      <div><dt>{t('Marca y modelo','Make and model')}</dt><dd>{fleetCardIdentity(vehicle).model || t('Sin registro','Not recorded')}</dd></div>
      <div><dt>{t("Placa", "Plate")}</dt><dd>{vehicle.plate || "—"}</dd></div>
      <div><dt>{t("Capacidad de carga", "Load capacity")}</dt><dd>{vehicle.capacityKg.toLocaleString(localeTag)} kg</dd></div>
      <div><dt>{t("Fecha de registro", "Registration date")}</dt><dd>{date(vehicle.registeredAt)}</dd></div>
      <div><dt>{t("Alta en CargoMesh", "Added to CargoMesh")}</dt><dd>{date(vehicle.createdAt)}</dd></div>
    </dl>
    <details className={s.recordIdentifiers}><summary>{t('Identificadores del registro','Record identifiers')}</summary><dl><div><dt>{t('Código interno','Internal code')}</dt><dd><code>{vehicle.code}</code></dd></div><div><dt>Record ID</dt><dd><code>{vehicle.id}</code></dd></div>{vehicle.model?<div><dt>{t('Modelo original del registro','Original recorded model')}</dt><dd>{vehicle.model}</dd></div>:null}</dl></details>
    <p className={s.cardDescription}>{vehicle.description || t("Descripción sin registrar", "Description not recorded")}</p>
    <div className={s.statusContext}><span>{t("Último estado", "Latest state")}</span><VehicleStatus vehicle={vehicle} />
      <p>{vehicle.statusReason || t("Sin descripción de estado", "No state description")}</p>
      <dl><div><dt>{t("Estado desde", "State since")}</dt><dd>{date(vehicle.statusChangedAt)}</dd></div>
        <div><dt>{t("Última modificación", "Last modified")}</dt><dd>{vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleString(localeTag, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</dd></div></dl>
    </div>
  </>;
}
function RangeValue({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  const range = remainingRangeKm(vehicle);
  return <small className={s.rangeValue}>{range === null ? t("Autonomía sin datos", "Range unavailable") : "≈ " + range.toLocaleString(localeTag) + " km · " + t("autonomía estimada", "estimated range")}</small>;
}
function VehicleCard({ vehicle, open, openDriver, openScheduling, openRegularDriver, canManageRegularDriver, buttonRef, list }: { vehicle: FleetVehicle; open: () => void; openDriver:()=>void; openScheduling:()=>void; openRegularDriver:()=>void; canManageRegularDriver:boolean; buttonRef: (node: HTMLButtonElement | null) => void; list: boolean }) {
  const { t, localeTag } = useLocale();
  const identity = fleetCardIdentity(vehicle), driver = vehicle.driverProfile;
  const typeLabel = t(...fleetTruckTypeLabel(fleetTruckType(vehicle)));
  const capacity = Number.isFinite(vehicle.capacityKg) && vehicle.capacityKg > 0
    ? new Intl.NumberFormat(localeTag, { maximumFractionDigits: 2 }).format(vehicle.capacityKg / 1000) + ' t'
    : t('Sin dato', 'Not recorded');
  const driverRole = vehicle.driverProfileRole === 'regular' ? t('Habitual', 'Usual driver') : t('Asignado', 'Assigned driver');
  const experience = driver?.experienceYears === null || driver?.experienceYears === undefined ? null
    : new Intl.NumberFormat(localeTag, { maximumFractionDigits: 1 }).format(driver.experienceYears) + ' ' + t(driver.experienceYears === 1 ? 'año' : 'años', driver.experienceYears === 1 ? 'year' : 'years');
  return <article className={`${s.vehicleCard} ${s.demoTruckCard} ${list ? s.listCard : ''}`} data-body={vehicle.variant}>
    <div className={s.truckImage} data-variant={vehicle.variant}>
      <button type="button" className={s.cardImageOpen} onClick={open} aria-label={t('Ver camión ', 'View truck ') + identity.title}/>
      <div className={s.imageBadges}>
        <VehicleStatus vehicle={vehicle}/>
        <span className={s.condition}>
          {vehicle.conditionScore === null ? <Clock3 size={13} aria-hidden="true"/> : <Gauge size={13} aria-hidden="true"/>}
          {vehicle.conditionScore === null ? t('Sin evaluar', 'Not assessed') : t('Condición', 'Condition') + ' ' + vehicle.conditionScore + '/100'}
        </span>
      </div>
      <FleetTruckPreview vehicle={vehicle}/>
    </div>
    <div className={s.cardBody}>
      <div className={s.cardIdentity}>
        <div><h2>{identity.title}</h2><p id={`fleet-model-${vehicle.id}`}>{typeLabel}</p></div>
        <span className={s.capacityBadge} aria-label={t('Capacidad de carga: ', 'Load capacity: ') + capacity}><Package size={15} aria-hidden="true"/>{capacity}</span>
      </div>
      <div className={s.cardDriverPanel}>
        {vehicle.referencesPending?<span className={s.cardDriverMissing}><CarrierUpdating>{t('Consultando conductor…','Loading driver…')}</CarrierUpdating></span>:driver ? <>
          <button type="button" className={s.cardDriverProfile} onClick={openDriver} aria-label={t('Ver conductor: ', 'View driver: ') + driver.name}>
            <DriverPortrait driver={driver}/><span><strong>{driver.name}</strong><small>{driverRole}{experience ? ' · ' + experience : ''}</small></span>
          </button>
          {vehicle.source === 'SERVICE' && canManageRegularDriver ? <button data-cm-action type="button" className={s.cardDriverChange} onClick={openRegularDriver} aria-label={t('Cambiar conductor habitual de ', 'Change usual driver for ') + identity.title}>{t('Cambiar', 'Change')}</button> : null}
        </> : <>
          <span className={s.cardDriverEmpty}><UsersRound size={21} aria-hidden="true"/></span>
          <span className={s.cardDriverMissing}><strong>{vehicle.driverEvidenceUnavailable?t('Conductor sin verificar','Driver unverified'):t('Sin conductor habitual', 'No usual driver')}</strong></span>
          {vehicle.source === 'SERVICE' ? <button data-cm-action type="button" className={s.cardDriverChange} onClick={canManageRegularDriver ? openRegularDriver : openScheduling}>{canManageRegularDriver ? t('Asignar', 'Assign') : t('Ver agenda', 'Schedule')}</button> : null}
        </>}
      </div>
      <button data-cm-action type="button" className={s.cardDetailsButton} ref={buttonRef} onClick={open} aria-label={t('Ver detalles de ', 'View details for ') + identity.title} aria-describedby={`fleet-model-${vehicle.id}`}>{t('Ver detalles del camión', 'View truck details')}<ArrowRight size={17} aria-hidden="true"/></button>
    </div>
  </article>;
}


export function FleetWorkspace({access=[],headerTarget=null}:{access?:CarrierPortalAccessV2[];headerTarget?:HTMLDivElement|null}) {
  const { t, locale, localeTag } = useLocale();
  const [filterCarrier]=useCarrierMemoryState('fleet:carrier',access.length===1?access[0].carrierId:'');
  const [source, setSource] = useState<"example" | "service">("service"), [filter, setFilter] = useCarrierMemoryState<FleetFilter>("fleet:filter:"+filterCarrier,"all"), [search, setSearch] = useCarrierMemoryState("fleet:search:"+filterCarrier,""), [sort, setSort] = useCarrierMemoryState<FleetSort>("fleet:sort:"+filterCarrier,"attention"), [layout, setLayout] = useCarrierMemoryState<"grid"|"list">("fleet:layout:"+filterCarrier,"grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [inspectionId,setInspectionId]=useState<string|null>(null);
  const [driverView,setDriverView]=useState(false),[driverFromDetail,setDriverFromDetail]=useState(false);
  const [view, setView] = useState<"vehicles" | "coverage" | "assignment" | "carriers" | "register" | "drivers">("vehicles");
  const operations=useOperations();
  const { demo, setDemo, ready, storageAvailable } = useFleetDemo(operations.inventory,operations.ready);
  const connected=useConnectedFleet(access,source==='service',view==='carriers');
  const [editing,setEditing]=useState<PortalRecord|null>(null),[savedMessage,setSavedMessage]=useState(''),[saving,setSaving]=useState(false);
  const [standaloneDriverId,setStandaloneDriverId]=useState<string|null>(null),[manageDrivers,setManageDrivers]=useState(false);
  const [regularAssetId,setRegularAssetId]=useState<string|null>(null);
  const [capacity,setCapacity]=useCarrierMemoryState<FleetCapacityFilter>('fleet:capacity:'+filterCarrier,'all'),[truckType,setTruckType]=useCarrierMemoryState('fleet:type:'+filterCarrier,'all');
  const localView=source==='example';
  const result=connected.current?{vehicles:connected.vehicles,readAt:connected.current.readAt,truncated:connected.current.partial,gaps:connected.current.visualGaps.length}:null;
  const loading=connected.loading,error=connected.error,checkedAt=Date.parse(connected.current?.readAt??new Date().toISOString());
  const cardButtons = useRef(new Map<string, HTMLButtonElement>()), returnTo = useRef<string | null>(null);
  const examples = useMemo(() => demoFleetVehicles(demo,operations.inventory), [demo,operations.inventory]);
  useEffect(()=>{const sync=()=>{const parts=readJuanHash().split('/'),service=parts[2]==='service',suffix=parts[service?3:2],id=parts[service?4:3];if(service)setSource('service');if(suffix==='vehicle'&&id){setView('vehicles');setSelected(decodeURIComponent(id));setDriverView(false);}else if(['vehicles','coverage','assignment','carriers','register','drivers'].includes(suffix)){setView(suffix as typeof view);setSelected(null);}else if(!suffix){setView('vehicles');setSelected(null);}setStandaloneDriverId(null);setEditing(null);};sync();return subscribeJuanRoute(sync);},[]);
  const changeView=(next:typeof view)=>{if(saving)return;setSelected(null);setStandaloneDriverId(null);setEditing(null);setView(next);navigateJuanHash("/fleet/"+(source==="service"?"service/":"")+next);};
  useEffect(() => { if (!selected && returnTo.current) { cardButtons.current.get(returnTo.current)?.focus(); returnTo.current = null; } }, [selected]);
  const resetScope=()=>{setRegularAssetId(null);setSelected(null);setStandaloneDriverId(null);setInspectionId(null);setEditing(null);setManageDrivers(false);setSavedMessage('');};
  // Drivers and Scheduling open the Carrier directory, independent of truck filters.
  useEffect(()=>{
    if(localView||!['drivers','assignment'].includes(view)||connected.carrierId)return;
    const requested=new URLSearchParams(window.location.search).get('carrier');
    const carrier=access.find(row=>row.carrierId===requested)??access[0];
    if(carrier)connected.setCarrierId(carrier.carrierId);
  },[localView,view,access,connected.carrierId]);
  const connect=()=>connected.refresh();
  const vehicles:FleetVehicle[] = localView ? examples : connected.vehicles;
  const inspected=vehicles.find(vehicle=>vehicle.id===inspectionId);
  const inspection=useMemo(()=>inspected?inspectFleet(inspected,operations.state.carriers):null,[inspected,operations.state.carriers]);
  useEffect(()=>setInspectionId(null),[source,view,selected]);
  const now = localView ? Date.parse(EXAMPLE_AS_OF) : checkedAt;
  const directoryVehicles=vehicles.filter(vehicle=>matchesDirectoryFilters(vehicle,capacity,truckType));
  const visible = filterFleet(directoryVehicles, filter, search, sort, now);
  const truckTypes=Array.from(new Set(vehicles.map(fleetTruckType))).sort((a,b)=>t(...fleetTruckTypeLabel(a)).localeCompare(t(...fleetTruckTypeLabel(b)),localeTag));
  const vehicle = selected ? vehicles.find(value => value.id === selected) : null;
  const summary = fleetSummary(vehicles, now);
  const incidentCount=useFleetIncidents(connected.carrierId,connected.current?.operational.executions,!!connected.current&&!connected.current.referencesPending&&!connected.current.partial&&!connected.current.visualGaps.includes('executions'),connected.current?.readAt??'',!localView&&view==='vehicles');
  const driverRows=connected.current?.drivers.filter(row=>row.carrierId===connected.carrierId&&connected.services.some(service=>service.id===recordData(row).serviceId))??[];
  const canManageCrew=!connected.error&&connected.carrier?.role==='ADMIN'&&!!connected.current&&!connected.current.partial&&!connected.loading;
  const regularAsset=connected.vehicles.find(row=>row.id===regularAssetId);
  const canWriteService=(serviceId?:string)=>!!serviceId&&!connected.error&&!connected.loading&&connected.carrier?.role==='ADMIN'&&!!connected.current&&!connected.current.partial&&connected.services.some(row=>row.id===serviceId&&recordData(row).status==='ACTIVE');
  const inspectionRecord=connected.current?.assets.find(row=>row.id===inspectionId);
  const canManageInspection=!localView&&!!inspectionRecord&&canWriteService(inspected?.serviceId);
  const standaloneDriver=driverRows.find(row=>row.id===standaloneDriverId),driverVehicle=vehicles.find(row=>row.driverId===standaloneDriverId||row.regularDriverId===standaloneDriverId);
  const saved=(row:PortalRecord)=>{setSavedMessage(recordName(row)+' saved — revision '+row.version);setEditing(null);connected.refresh();navigateJuanHash('/fleet/vehicle/'+row.id);};
  const registerButton = (id: string, node: HTMLButtonElement | null) => { if (node) cardButtons.current.set(id, node); else cardButtons.current.delete(id); };
  const command = (value: DemoCommand) => { const next = applyDemoCommand(demo, value,undefined,operations.inventory); if (!next.error) setDemo(next.state); return next.error; };
  const open = (id: string) => { returnTo.current = id; setDriverView(false); setSelected(id); };
  const openDriver=(id:string,fromDetail=false)=>{returnTo.current=id;setSelected(id);setDriverView(true);setDriverFromDetail(fromDetail);};
  const back = () => { setSelected(null);setStandaloneDriverId(null); if(readJuanHash().includes("/vehicle/")) navigateJuanHash("/fleet/"+(source==="service"?"service/":"")+"vehicles"); };
  const contextControls = !localView ? <div className={s.contextControls}>
    <label><select aria-label="Carrier" disabled={loading||saving} value={connected.carrierId} onChange={e=>{resetScope();connected.setCarrierId(e.target.value);}}><option value="">Select Carrier</option>{access.map(row=><option key={row.carrierId} value={row.carrierId}>{carrierDisplayName(row.carrierName,row.carrierId)}</option>)}</select></label>
    <button data-cm-action type="button" className={s.contextRefresh} disabled={loading||saving||!connected.carrier} aria-label={view==='carriers'?'Refresh sites and coverage':'Refresh fleet'} title={loading?'Loading…':view==='carriers'?'Refresh sites and coverage':'Refresh fleet'} onClick={connect}><RefreshCw size={17} aria-hidden="true"/></button>
  </div> : null;
  const fleetHref=(section:string)=>juanHref('#/fleet/'+(localView?'':'service/')+section);
  const primaryView=view==='drivers'?'drivers':view==='assignment'?'assignment':'vehicles';
  const driversDisabled=localView||saving;
  const schedulingDisabled=saving;
  const registrationDisabled=(!localView&&!connected.services.some(row=>canWriteService(row.id)))||saving;
  const truckDirectory=view==='vehicles'&&!vehicle&&!standaloneDriver&&!editing;
  const needsService=!localView&&view==='register';
  const directoryFilters=<div className={s.directoryFilters}>
    <label><span className={s.srOnly}>{t('Tonelaje','Load capacity')}</span><select value={capacity} disabled={loading||saving} onChange={event=>setCapacity(event.target.value as FleetCapacityFilter)}>{capacityFilters.map(option=><option key={option.id} value={option.id}>{t(option.es,option.en)}</option>)}</select></label>
    <label><span className={s.srOnly}>{t('Tipo de camión','Truck type')}</span><select value={truckType} disabled={loading||saving} onChange={event=>setTruckType(event.target.value)}><option value="all">{t('Todos los tipos','All truck types')}</option>{truckTypes.map(type=><option key={type} value={type}>{t(...fleetTruckTypeLabel(type))}</option>)}</select></label>
  </div>;
  const serviceSelector=!localView?<div className={s.serviceContext}>
    <label className={s.contextService}><span className={s.srOnly}>Transport service</span><select disabled={loading||saving||!connected.current} value={connected.serviceId} onChange={e=>{resetScope();connected.setServiceId(e.target.value);}}><option value="">Select service</option>{connected.services.map(row=>{
      const sameName=connected.services.filter(other=>serviceCaption(other,true)===serviceCaption(row,true));
      const sameDetails=sameName.filter(other=>serviceCaption(other)===serviceCaption(row));
      return <option key={row.id} value={row.id}>{serviceCaption(row,true)}{sameName.length>1?' · '+serviceCaption(row):''}{sameDetails.length>1?' · Ref '+row.id.slice(-4):''}</option>;
    })}</select></label>
    {connected.service?<ServiceSpecifications key={connected.serviceId} service={connected.service}/>:null}
  </div>:null;
  return <div className={s.workspace}>
    {regularAsset&&!localView&&regularAsset.serviceId&&canWriteService(regularAsset.serviceId)&&!connected.current?.regularDriversUnavailable?<RegularDriverEditor key={connected.carrierId+regularAsset.serviceId+regularAsset.id} carrierId={connected.carrierId} serviceId={regularAsset.serviceId} assetId={regularAsset.id} plate={regularAsset.plate??regularAsset.code} record={connected.current?.regularDrivers?.find(row=>row.assetId===regularAsset.id&&row.serviceId===regularAsset.serviceId)} drivers={connected.current?.drivers??[]} close={()=>setRegularAssetId(null)} saved={()=>{setRegularAssetId(null);connected.refresh();}} onBusyChange={setSaving}/>:null}
    {view!=='carriers'?<div className={s.primaryViews}><nav className={`${views.views} ${s.viewLinks}`} aria-label="Fleet views">
      <CarrierLink href={fleetHref('vehicles')} aria-current={primaryView==='vehicles'?'page':undefined} aria-disabled={saving||undefined} onClick={event=>{if(saving)event.preventDefault();}}><Truck size={17} aria-hidden="true"/>Trucks</CarrierLink>
      <CarrierLink href={fleetHref('drivers')} aria-current={primaryView==='drivers'?'page':undefined} aria-disabled={driversDisabled||undefined} onClick={event=>{if(driversDisabled)event.preventDefault();}}><UsersRound size={17} aria-hidden="true"/>Drivers</CarrierLink>
      <CarrierLink href={fleetHref('assignment')} aria-current={primaryView==='assignment'?'page':undefined} aria-disabled={schedulingDisabled||undefined} onClick={event=>{if(schedulingDisabled)event.preventDefault();}}><CalendarDays size={17} aria-hidden="true"/>Scheduling</CarrierLink>
    </nav>{needsService?serviceSelector:truckDirectory||view==='coverage'?directoryFilters:null}</div>:null}
    {headerTarget?createPortal(contextControls,headerTarget):contextControls}
    {loading&&result&&!localView?<CarrierUpdating/>:null}
    {error&&!localView?<div className={s.error} role="alert"><ShieldCheck size={20}/><p>{error}</p><button onClick={connect}>Retry</button></div>:null}
    {!access.length&&!localView?<p role="status">No authorized Carrier membership. Local examples are not used as a fallback.</p>:null}
    {result?.truncated&&!localView&&!loading?<p className={s.sourceNote} role="status">Partial catalog: counts cover loaded records and saving is disabled.</p>:null}
    {connected.current?.visualGaps.length&&!localView&&!loading?<p className={s.sourceNote}>Pending operational sources: {connected.current.visualGaps.join(', ')}. Missing evidence does not confirm availability.</p>:null}
    {savedMessage&&!localView?<p role="status" className={s.sourceNote}>{savedMessage}</p>:null}
    {truckDirectory&&(localView||result)?<CarrierKpis label="Fleet overview, loaded records" metrics={[
      {id:'trucks',label:t("Total de camiones","Total trucks"),value:!localView&&!result?null:summary.total,tone:'blue',art:'fleet-truck',description:localView?'Local example truck records.':'Truck records loaded across authorized road services.'},
      {id:'normal',label:t("Estado normal","Normal operating state"),value:!localView&&!result?null:summary.normal,tone:'teal',art:'fleet-shield',description:'Recorded as available or in service. Operating state does not confirm booking availability.'},
      {id:'maintenance',label:t("En mantenimiento","In maintenance"),value:!localView&&!result?null:summary.maintenance,tone:'violet',art:'fleet-wrench',description:'Current recorded maintenance state.'},
      {id:'incidents',label:t('Incidencias reportadas','Reported incidents'),value:incidentCount,tone:'indigo',art:'fleet-incidents',description:t('Incidencias registradas de las operaciones del Carrier. — indica lectura pendiente o incompleta.','Reported incidents across Carrier operations. — means pending or incomplete data.')},
    ]}/>:null}
    {view==='carriers'?<div className={s.contextBar}>{serviceSelector}</div>:null}
    <ContentMotion animateOnChange={false} ready={localView||!!result} enabled={view!=='carriers'} identity={(result?"ready:":"loading:")+(standaloneDriver?'driver:'+standaloneDriver.id:editing?'edit:'+editing.id:selected?`${selected}:${driverView?"driver":"truck"}`:view)} focusOnChange>
      {view==='carriers'?<CarrierSites example={localView} context={connected}/>:editing&&!localView&&connected.current&&connected.carrier?<ConnectedTruckRegistration key={editing.id} carrierId={connected.carrierId} carrierName={connected.carrier.carrierName} serviceId={String(recordData(editing).serviceId)} depots={connected.current.depots} partners={connected.current.partners} record={editing} canWrite={canWriteService(String(recordData(editing).serviceId))} onBusyChange={setSaving} back={()=>setEditing(null)} saved={saved}/>:standaloneDriver?<DriverProfile profile={connectedDriver(standaloneDriver,driverVehicle)} vehicle={driverVehicle} back={()=>setStandaloneDriverId(null)} openTruck={()=>{if(driverVehicle){setStandaloneDriverId(null);setSelected(driverVehicle.id);}}}/>:vehicle ? driverView&&vehicle.driverProfile?<DriverProfile vehicle={vehicle} back={()=>driverFromDetail?setDriverView(false):back()} openTruck={()=>setDriverView(false)}/>:<><VehicleDetail vehicle={vehicle} back={back} openDriver={()=>openDriver(vehicle.id,true)} />{!localView&&canWriteService(vehicle.serviceId)?<button onClick={()=>setEditing(connected.current?.assets.find(row=>row.id===vehicle.id)??null)}>Edit recorded truck</button>:null}</> : !localView && !result ? (error||!access.length?null:loading?<CarrierSkeleton shape={view==='drivers'||view==='assignment'?'agenda':'cards'}/>:<section className={s.empty}><h2>{t("Sin vehículos registrados","No registered vehicles")}</h2></section>)
        :needsService&&!connected.service?<section className={s.empty} aria-busy={connected.services.length>0&&view!=='register'}><Truck size={28} aria-hidden="true"/><h2>{!connected.services.length?t('No hay servicios de carretera registrados','No road services registered'):view==='register'?t('Selecciona un servicio','Select a service'):t('Cargando recursos…','Loading resources…')}</h2>{view==='register'&&connected.services.length?<p>{t('Elige el servicio para registrar el camión.','Choose the service for the truck registration.')}</p>:null}</section>
         :!localView&&loading&&connected.current?.referencesPending&&['drivers','assignment'].includes(view)?<CarrierSkeleton shape="agenda"/>
        :view==='register'&&!localView&&connected.current&&connected.carrier?<ConnectedTruckRegistration key={connected.carrierId+connected.serviceId} carrierId={connected.carrierId} carrierName={connected.carrier.carrierName} serviceId={connected.serviceId} depots={connected.current.depots} partners={connected.current.partners} canWrite={connected.canWrite} onBusyChange={setSaving} back={()=>changeView('vehicles')} saved={saved}/>
        : view==="register"&&localView?<TruckRegistration back={()=>changeView("vehicles")} registered={id=>{navigateJuanHash("/fleet/vehicle/"+id);}}/>

        : view==='drivers'&&!localView&&connected.current?<>
         <div hidden={manageDrivers}><DriversWorkspace key={connected.carrierId} drivers={driverRows} assignments={connected.current.operational['driver-assignments']} carrierId={connected.carrierId} serviceId="" readAt={connected.current.readAt} assignmentsUnavailable={connected.current.visualGaps.includes('driver-assignments')} onOpen={setStandaloneDriverId} onManage={()=>setManageDrivers(true)}/></div>
         {manageDrivers?<section className={s.panel}><button type="button" onClick={()=>setManageDrivers(false)}><ArrowLeft size={16} aria-hidden="true"/>Back to drivers</button><ConnectedCrew carrierId={connected.carrierId} serviceId="" allServices references={connected.current} canWrite={canManageCrew} initialSection="drivers" onCatalogChanged={connected.refresh}/></section>:null}
        </>
        :view==='assignment'&&!localView&&connected.current?<ConnectedCrew carrierId={connected.carrierId} serviceId="" allServices references={connected.current} canWrite={canManageCrew} initialSection="operations" onCatalogChanged={connected.refresh}/>
        : view === "coverage" ? <><div className={s.coverageActions}><button disabled={saving} onClick={()=>changeView('vehicles')}><ArrowLeft size={16} aria-hidden="true"/>Vehicle directory</button><button data-cm-action className={s.primary} disabled={registrationDisabled} onClick={()=>changeView('register')}><Plus size={16} aria-hidden="true"/>New truck</button></div><FleetCoverage vehicles={directoryVehicles} open={open} registerButton={registerButton} /></>
        : view === "assignment" && localView ? <FleetAssignmentBoard state={demo} vehicles={vehicles} command={command} reset={() => setDemo(createFleetDemo(operations.inventory))} ready={ready} storageAvailable={storageAvailable} open={open} registerButton={registerButton} /> : <>
        <div className={`${s.toolbar} ${s.unifiedToolbar}`}>
          <SearchField fieldClassName={s.search} hideLabel floatingLabel={t("Buscar", "Search")} label={t("Buscar camión, conductor o ubicación", "Search truck, driver or location")} placeholder={t("Buscar camión, conductor o ubicación…", "Search truck, driver or location…")} value={search} onValueChange={setSearch}/>
          <label className={s.stateFilter}><span className={s.srOnly}>{t("Filtro de vehículos", "Vehicle filter")}</span><select value={filter} data-active={filter!=='all'} onChange={event=>setFilter(event.target.value as FleetFilter)}>{filters.map(value=><option key={value.id} value={value.id}>{t(value.es,value.en)} · {directoryVehicles.filter(vehicle=>matchesFleetFilter(vehicle,value.id,now)).length}</option>)}</select></label>
          <label className={s.sort}><span className={s.srOnly}>{t("Ordenar por", "Sort by")}</span><select value={sort} onChange={event => setSort(event.target.value as FleetSort)}><option value="attention">{t("Atención necesaria", "Attention needed")}</option><option value="code">{t("Código del vehículo", "Vehicle code")}</option><option value="fuel">{t("Menor combustible", "Lowest fuel")}</option></select></label>
          <div className={s.directoryActions}><button data-cm-action className={s.primary} disabled={registrationDisabled} onClick={()=>changeView('register')}><Plus size={16} aria-hidden="true"/>New truck</button><div className={s.layoutSwitch} role="group" aria-label={t("Vista de vehículos", "Vehicle view")}><button aria-label={t("Tarjetas", "Cards")} aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={18} aria-hidden="true" /></button><button aria-label={t("Lista", "List")} aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={18} aria-hidden="true" /></button></div></div>
        </div>
        <span className={s.srOnly} role="status" aria-live="polite">{visible.length} {t("vehículos mostrados", "vehicles shown")}</span>
        {visible.length ? <div className={layout === "grid" ? s.vehicleGrid : s.vehicleList}>{visible.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} list={layout === "list"} open={() => setInspectionId(vehicle.id)} openDriver={()=>openDriver(vehicle.id)} openScheduling={()=>{if(vehicle.serviceId)connected.setServiceId(vehicle.serviceId);changeView('assignment');}} canManageRegularDriver={!localView&&canWriteService(vehicle.serviceId)&&!connected.current?.regularDriversUnavailable} openRegularDriver={()=>setRegularAssetId(vehicle.id)} buttonRef={node => registerButton(vehicle.id, node)} />)}</div>
          : <section className={s.empty}><Search size={30} aria-hidden="true" /><h3>{vehicles.length ? t("Sin coincidencias", "No matches") : t("No hay vehículos de carretera en esta consulta", "No road vehicles in this read")}</h3><p>{t("Prueba otro filtro o término de búsqueda.", "Try another filter or search term.")}</p><button onClick={() => { setFilter("all"); setSearch("");setCapacity('all');setTruckType('all'); }}>{t("Limpiar filtros", "Clear filters")}</button></section>}
      </>}
    </ContentMotion>
    {inspection?<TruckInspection key={inspection.id} context={inspection} illustrative={!localView} onClose={()=>setInspectionId(null)} onOpenDetail={()=>{setSelected(inspection.id);setInspectionId(null);}}
      onEdit={canManageInspection?()=>{setInspectionId(null);setEditing(inspectionRecord!);}:undefined}
      onAssignTrip={canManageInspection?()=>{if(inspected?.serviceId)connected.setServiceId(inspected.serviceId);setInspectionId(null);changeView('assignment');}:undefined}
      onAssignDriver={canManageInspection&&!connected.current?.regularDriversUnavailable?()=>{setInspectionId(null);setRegularAssetId(inspection.id);}:undefined}
    />:null}
  </div>;
}

function VehicleDetail({ vehicle, back, openDriver }: { vehicle: FleetVehicle; back: () => void; openDriver:()=>void }) {
  const { t, localeTag } = useLocale();
  const operations=useOperations(),carrier=vehicle.source==="EXAMPLE"?operations.state.carriers.find(c=>c.id===vehicleCarrierId(vehicle)):null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...vehicle, notice: vehicle.source === "EXAMPLE" ? "SIMULATED LOCAL EXAMPLE — NO REAL TELEMETRY" : "Recorded service data. Null metrics are unavailable. No circulation or capacity confirmation." }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `CargoMesh-${vehicle.code}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className={s.detail}>
    <div className={s.detailHeading}><div><button onClick={back} className={s.back}><ArrowLeft size={18} aria-hidden="true" />{t("Volver a la flota", "Back to fleet")}</button><p className={s.detailTrail}>{t("Flota / Camiones / ", "Fleet / Trucks / ")}{fleetCardIdentity(vehicle).title}</p><h2 tabIndex={-1}>{fleetCardIdentity(vehicle).title}{fleetCardIdentity(vehicle).model?<span> · {fleetCardIdentity(vehicle).model}</span>:null}</h2></div><button onClick={download}><Download size={16} aria-hidden="true" />{t("Descargar ficha", "Download record")}</button></div>
    <div className={s.detailHero}><div className={s.detailVisual}><ReferencePhoto vehicle={vehicle} eager /><span className={s.detailCode}>{fleetCardIdentity(vehicle).title}</span></div><div className={s.detailInfo}><div className={s.detailStatusLine}><VehicleStatus vehicle={vehicle} />{vehicle.conditionScore !== null ? <span className={s.condition}><Gauge size={14} aria-hidden="true" />{t("Condición", "Condition")} {vehicle.conditionScore}/100</span> : null}</div><p className={s.provenance}>{t("Última actualización: ", "Last updated: ")}{new Date(vehicle.updatedAt).toLocaleString(localeTag)}</p><dl>
      <div><dt>{vehicle.driverProfileRole==="regular"?t("Conductor habitual","Regular driver"):t("Conductor asignado", "Assigned driver")}</dt><dd>{vehicle.driverProfile?<button className={s.driverLink} onClick={openDriver}><DriverPortrait driver={vehicle.driverProfile}/><span>{vehicle.driverProfile.name}</span><ArrowRight size={14} aria-hidden="true"/></button>:vehicle.driver || t("Sin registro", "Not recorded")}</dd></div>
      <div><dt>{t("Última posición", "Last position")}</dt><dd>{vehicle.location || t("No disponible", "Unavailable")}</dd></div>
      <div><dt>{t("Velocidad", "Speed")}</dt><dd>{vehicle.speedKmh === null ? t("No disponible", "Unavailable") : vehicle.speedKmh + " km/h"}</dd></div>
      <div><dt>{t("Placa", "Plate")}</dt><dd>{vehicle.plate || "—"}</dd></div><div><dt>{t("Carrocería", "Body type")}</dt><dd>{vehicle.body}</dd></div><div><dt>{t("Base", "Home base")}</dt><dd>{vehicle.depot || t("Sin registro", "Not recorded")}</dd></div>
    </dl>{vehicle.coordinates ? <a className={s.mapLink} href={`https://www.google.com/maps/search/?api=1&query=${vehicle.coordinates.lat},${vehicle.coordinates.lng}`} target="_blank" rel="noreferrer"><MapPin size={16} aria-hidden="true" />{t("Ver posición registrada", "View recorded position")} ↗</a> : null}<small>{vehicle.source === "SERVICE" ? t("La posición registrada no incluye fecha de observación; no confirma movimiento actual.", "The recorded position has no observation timestamp; it does not confirm current motion.") : ""}</small></div></div>
    {vehicle.visual&&!vehicle.photoDataUrl?<section className={s.modelPreview} aria-label="Associated 3D model"><AssociatedTruck compact variant={vehicle.visual.family} designId={vehicle.visual.designId} label={fleetCardIdentity(vehicle).title}/></section>:null}
    <div className={s.detailMetrics}>
      <div><Gauge size={18} aria-hidden="true" /><span>{t("Odómetro", "Odometer")}</span><strong>{vehicle.odometerKm === null ? "—" : vehicle.odometerKm.toLocaleString(localeTag) + " km"}</strong><small>{t("Lectura registrada", "Recorded reading")}</small></div>
      <div><Fuel size={18} aria-hidden="true" /><span>{t("Combustible", "Fuel")}</span><FuelValue value={vehicle.fuelPercent} /><RangeValue vehicle={vehicle} /></div>
      <div><Truck size={18} aria-hidden="true" /><span>{t("Utilización · 30 días", "Utilization · 30 days")}</span><strong>{vehicle.utilizationPercent === null ? "—" : vehicle.utilizationPercent + "%"}</strong>{vehicle.utilizationPercent !== null ? <meter className={s.utilizationMeter} min={0} max={100} value={vehicle.utilizationPercent} aria-label={t("Utilización del camión en 30 días", "Truck utilization over 30 days")} /> : null}{vehicle.source === "SERVICE" ? <small>{t("Sin medición", "No measurement")}</small> : null}</div>
      <div><Gauge size={18} aria-hidden="true" /><span>{t("Costo por km", "Cost per km")}</span><strong>{vehicle.costPerKm === null ? "—" : "S/ " + vehicle.costPerKm.toFixed(2)}</strong><small>{vehicle.source === "EXAMPLE" ? t("PEN", "PEN") : t("Sin registro", "No record")}</small></div>
      <div><Wrench size={18} aria-hidden="true" /><span>{t("Próximo servicio", "Next service")}</span><ServiceValue vehicle={vehicle} /></div>
    </div>
    {carrier?<section className={s.panel}><h3>Carrier y sede</h3><p><strong>{carrier.name}</strong> · {vehicle.depot}</p><a href="#/fleet/carriers">Consultar sedes y alcance</a>{vehicle.volumeM3!==undefined?<dl className={s.vehicleFacts}><div><dt>Año del modelo</dt><dd>{vehicle.modelYear}</dd></div><div><dt>Volumen útil</dt><dd>{vehicle.volumeM3} m³</dd></div><div><dt>Seguro vigente hasta</dt><dd>{vehicle.insuranceUntil}</dd></div><div><dt>Revisión técnica vigente hasta</dt><dd>{vehicle.inspectionUntil}</dd></div></dl>:null}</section>:null}
    <EngineChart key={vehicle.id} vehicle={vehicle} />
    <div className={s.detailBottom}><section className={s.panel}><div className={s.panelTitle}><Truck size={21} aria-hidden="true" /><h3>{t("Registro y estado", "Registration and state")}</h3></div><VehicleFacts vehicle={vehicle} /></section>
      <section className={s.panel}><div className={s.panelTitle}><MapPin size={21} aria-hidden="true" /><h3>{t("Zonas y destino", "Areas and destination")}</h3></div><FleetJourneySummary vehicle={vehicle} />{vehicle.source === "SERVICE" ? <small>{t("Solo se muestran destinos y zonas vinculados por el servicio.", "Only destinations and areas linked by the service are shown.")}</small> : null}</section></div>
    <div className={s.detailBottom}><section className={s.panel}><div className={s.panelTitle}><Wrench size={21} aria-hidden="true" /><h3>{t("Mantenimiento", "Maintenance")}</h3></div>{vehicle.maintenance ? <><strong>{vehicle.maintenance.kind}</strong><p>{new Date(vehicle.maintenance.startsAt).toLocaleString(localeTag)} — {new Date(vehicle.maintenance.endsAt).toLocaleString(localeTag)}</p><span className={s.maintenanceTag}>{vehicle.maintenance.status === "IN_PROGRESS" ? t("En progreso", "In progress") : t("Programado", "Scheduled")}</span></> : <p>{t("No hay un mantenimiento próximo en los registros consultados.", "No upcoming maintenance in the retrieved records.")}</p>}</section>
      <section className={s.panel}><div className={s.panelTitle}><ShieldCheck size={21} aria-hidden="true" /><h3>{t("Datos del vehículo", "Vehicle data")}</h3></div><p><strong>{vehicle.capacityKg.toLocaleString(localeTag)} kg</strong> · {t("Capacidad útil declarada", "Declared useful capacity")}</p><p>{t("La capacidad declarada y el estado operativo no confirman disponibilidad. Requiere comprobar reservas, mantenimiento y reposicionamiento.", "Declared capacity and operating status do not confirm availability. Reservations, maintenance and repositioning must be checked.")}</p>{vehicle.source === "SERVICE" ? <small>{t("Fuente: registros del servicio V2 consultados con tu sesión.", "Source: V2 service records retrieved using your session.")}</small> : null}</section></div>
  </section>;
}

function EngineChart({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  const [period, setPeriod] = useState<7 | 14>(14), [active, setActive] = useState<string | null>(null);
  const days = vehicle.engineDays.slice(-period), highlighted = days.find(day => day.date === active);
  const total = days.reduce((sum, day) => sum + day.driving + day.idle, 0);
  return <section className={`${s.panel} ${s.chartPanel}`}><div className={s.chartHeading}><div><h3>{t("Horas de motor por día", "Engine hours per day")}</h3><p>{days.length ? total.toLocaleString(localeTag, { maximumFractionDigits: 1 }) + " h" : t("Sin lecturas de motor disponibles", "No engine readings available")}</p></div><div className={s.chartPeriods} role="group" aria-label={t("Periodo del gráfico", "Chart period")}><button aria-pressed={period === 7} onClick={() => { setPeriod(7); setActive(null); }}>7 {t("días", "days")}</button><button aria-pressed={period === 14} onClick={() => { setPeriod(14); setActive(null); }}>14 {t("días", "days")}</button></div></div>
    {days.length ? <><div className={s.legend}><span><i />{t("Conducción", "Driving")}</span><span><i />{t("Motor en ralentí", "Engine idle")}</span><span><i />{t("Día seleccionado", "Selected day")}</span></div><div className={s.chart}>
      <div className={s.axis} aria-hidden="true">{[12, 9, 6, 3, 0].map(value => <span key={value}>{value} h</span>)}</div><div className={s.plot} data-days={days.length} style={{ gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` }}>{days.map(day => <button key={day.date} className={s.barColumn} aria-pressed={active === day.date} onMouseEnter={() => setActive(day.date)} onFocus={() => setActive(day.date)} onClick={() => setActive(day.date)} aria-label={new Date(day.date + "T12:00:00Z").toLocaleDateString(localeTag) + ": " + day.driving + " h " + t("conducción", "driving") + ", " + day.idle + " h " + t("ralentí", "idle")}>
        <span className={s.barTrack}><span className={s.stackedBar} style={{ height: `${(day.driving + day.idle) / 12 * 100}%` }}><i className={s.idleBar} style={{ flex: day.idle }} /><i className={s.drivingBar} style={{ flex: day.driving }} /></span></span><span className={s.barDate}>{new Date(day.date + "T12:00:00Z").toLocaleDateString(localeTag, { day: "numeric", month: "short" })}</span></button>)}</div></div>
      <p className={s.chartReadout} aria-live="polite">{highlighted ? <>{new Date(highlighted.date + "T12:00:00Z").toLocaleDateString(localeTag)} · <strong>{highlighted.driving} h</strong> {t("conducción", "driving")} · <strong>{highlighted.idle} h</strong> {t("ralentí", "idle")}</> : t("Pasa el cursor o usa Tab para consultar cada día.", "Hover or use Tab to inspect each day.")}</p></>
      : <div className={s.chartEmpty}><Gauge size={28} aria-hidden="true" /><p>{t("No hay lecturas de conducción ni de ralentí disponibles.", "Driving and idle readings are unavailable.")}</p></div>}
  </section>;
}
