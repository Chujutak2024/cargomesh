"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,Gauge,Info,LayoutGrid,List,MapPin,Search,ShieldCheck,Truck,Users,Wrench} from 'lucide-react';
import {Button,SearchField,Select} from '@/components/ui';
import {ContentMotion} from '@/features/product-motion/content-motion';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readConnectedFleet,readFleetAccess,roadAssets} from './connected-fleet-client';
import {connectedDriver,connectedVehiclePresentation} from './connected-fleet-presentation';
import {VehicleCard,VehicleDetail,PhotoCredits} from './fleet-presentation';
import {filterFleet,fleetSummary,matchesFleetFilter,type FleetFilter,type FleetSort} from './fleet-model';
import {DriverProfile,DriverPortrait} from './driver-profile';
import {ConnectedCrew} from './connected-crew';
import {ConnectedCarrierNetwork} from './connected-carrier-network';
import {ConnectedVehicleForm} from './connected-vehicle-form';
import {TruckInspection} from './truck-inspection';
import {inspectFleet} from './truck-inspection-model';
import {portalErrorCopy} from './api';
import {recordData,recordName,type PortalRecord} from './records';
import s from './fleet.module.css';
import c from './connected-fleet.module.css';

const filters:{id:FleetFilter;label:string}[]=[{id:'all',label:'All'},{id:'service',label:'In service'},{id:'maintenance',label:'In shop'},{id:'due',label:'Service due'},{id:'fuel',label:'Low fuel'},{id:'reefer',label:'Reefers'}];
export function ConnectedFleet({register,section,onNavigate,carrierContext}:{register:boolean;section:string;onNavigate:(view:'vehicles'|'register')=>void;carrierContext?:CarrierPortalAccessV2;demoAvailable?:boolean}){
 const [access,setAccess]=useState<CarrierPortalAccessV2[]|null>(null),[carrierId,setCarrierId]=useState(''),[serviceId,setServiceId]=useState('');
 const [data,setData]=useState<Awaited<ReturnType<typeof readConnectedFleet>>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0),[accessRefresh,setAccessRefresh]=useState(0),[search,setSearch]=useState(''),[directory,setDirectory]=useState<'vehicles'|'drivers'|'operations'|'coverage'|'depots'>('vehicles');
 const [selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState<PortalRecord|null>(null),[message,setMessage]=useState('');
 const [driverId,setDriverId]=useState<string|null>(null),[manageDrivers,setManageDrivers]=useState(false),[inspectionId,setInspectionId]=useState<string|null>(null);
 const [filter,setFilter]=useState<FleetFilter>('all'),[sort,setSort]=useState<FleetSort>('attention'),[layout,setLayout]=useState<'grid'|'list'>('grid');
 const cardButtons=useRef(new Map<string,HTMLButtonElement>()),returnTo=useRef<string|null>(null);
 useEffect(()=>{
  const controller=new AbortController();setAccess(null);setCarrierId('');setData(null);setError('');setLoading(true);
  if(carrierContext){setAccess([carrierContext]);setCarrierId(carrierContext.carrierId);setLoading(false);return()=>controller.abort();}
  void readFleetAccess(controller.signal).then(rows=>{if(!controller.signal.aborted){setAccess(rows);setCarrierId(rows.length===1?rows[0].carrierId:'');}}).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[accessRefresh,carrierContext]);
 const active=access?.find(row=>row.carrierId===carrierId);
 useEffect(()=>{
  const previousService=data?.carrierId===active?.carrierId?serviceId:'';const controller=new AbortController();
  setData(null);setSelected(null);setDriverId(null);setInspectionId(null);setEditing(null);setError('');setServiceId('');
  if(!active){if(access)setLoading(false);return()=>controller.abort();}setLoading(true);
  void readConnectedFleet(active.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted){setData(result);const road=result.services.filter(row=>{const v=recordData(row);return v.mode==='ROAD'&&v.status==='ACTIVE';});setServiceId(road.some(row=>row.id===previousService)?previousService:road.length===1?road[0].id:'');}}).catch(e=>{if(!controller.signal.aborted){setData(null);setError(portalErrorCopy(e,false));}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[active?.carrierId,refresh]);
 useEffect(()=>{if(!selected&&!driverId&&!inspectionId&&returnTo.current){cardButtons.current.get(returnTo.current)?.focus({preventScroll:true});returnTo.current=null;}},[selected,driverId,inspectionId]);
 const current=data?.carrierId===carrierId?data:null,services=current?.services.filter(row=>recordData(row).mode==='ROAD')??[],service=services.find(row=>row.id===serviceId);
 const canWrite=active?.role==='ADMIN'&&!!service&&recordData(service).status==='ACTIVE'&&!current?.partial;
 const vehicles=useMemo(()=>current?connectedVehiclePresentation(current,serviceId):[],[current,serviceId]);
 const drivers=current?.drivers.filter(row=>recordData(row).serviceId===serviceId)??[],now=Date.parse(current?.readAt??new Date().toISOString());
 const summary=fleetSummary(vehicles,now),visible=filterFleet(vehicles,filter,search,sort,now),vehicle=vehicles.find(v=>v.id===selected);
 const driverRow=drivers.find(r=>r.id===driverId),driverVehicle=vehicles.find(v=>v.driverId===driverId),inspected=vehicles.find(v=>v.id===inspectionId);
 const inspection=useMemo(()=>{if(!inspected)return null;const context=inspectFleet(inspected,[]);
 const labels:Record<string,string>={'Placa':'Plate','Capacidad de carga':'Load capacity','Conductor habitual':'Regular driver','Conductor asignado':'Assigned driver','Combustible':'Fuel','Odómetro':'Odometer','Última actualización':'Last updated'};
 return {...context,detailHref:undefined,status:inspected.status.replaceAll('_',' '),origin:inspected.location??'Position not recorded',destination:inspected.journey?.destination??'Journey not recorded',
 facts:context.facts.map(f=>({label:labels[f.label]??f.label,value:['Sin lectura','Sin registro','Por asignar'].includes(f.value)?'Pending data':f.value}))};},[inspected]);
 function changeService(id:string){setServiceId(id);setSelected(null);setDriverId(null);setInspectionId(null);setEditing(null);setSearch('');setMessage('');}
 function saved(record:PortalRecord){setMessage(recordName(record)+' saved · version '+record.version);setEditing(null);setRefresh(n=>n+1);onNavigate('vehicles');}
 function open(id:string){returnTo.current=id;setInspectionId(id);}
 const back=()=>{setSelected(null);setDriverId(null);};
 const view=section==='assignment'?'operations':section==='coverage'?'coverage':section==='carriers'?'depots':directory;
 return <div className={s.workspace}>
  <div className={s.sourceBar}><span className={s.provenance}><Info size={15} aria-hidden="true"/>Authorized carrier records · No GPS connection</span><Button variant="secondary" size="compact" disabled={loading} onClick={()=>access?setRefresh(n=>n+1):setAccessRefresh(n=>n+1)}>Refresh fleet</Button></div>
  {!vehicle&&!driverRow?<p className={s.sourceNote}>View trucks, work zones and driver assignments.</p>:null}
  {current&&service&&!loading&&!vehicle&&!driverRow&&!register&&!editing?<>
   <div className={s.summary}>
    <div className={s.summaryPrimary}><Truck size={22} aria-hidden="true"/><span>Total trucks</span><strong>{summary.total}{current.partial?'+':''}</strong><small>{current.partial?'Loaded fleet records · partial catalog':'Fleet records'}</small></div>
    <div><ShieldCheck size={22} aria-hidden="true"/><span>Normal operating state</span><strong>{summary.normal}</strong><small>Available or in service (recorded)</small></div>
    <div><Wrench size={22} aria-hidden="true"/><span>In maintenance</span><strong>{summary.maintenance}</strong><small>Current recorded state</small></div>
    <div><Gauge size={22} aria-hidden="true"/><span>Maintenance · past year</span><strong>{summary.annualPercent===null?'—':summary.annualPercent.toLocaleString('en-US',{maximumFractionDigits:1})+'%'}</strong><small>{summary.annualPercent===null?'Pending maintenance history':summary.maintained+' of '+summary.total+' trucks with maintenance'}</small></div>
   </div><p className={s.kpiNote}>Normal operating state does not confirm booking availability. Counts use authorized loaded records. Annual maintenance: {new Date(summary.startsAt).toLocaleDateString('en-US')} — {new Date(summary.endsAt).toLocaleDateString('en-US')}.</p>
  </>:null}
  <div className={c.context}>
   {!carrierContext?<Select label="Authorized carrier" value={carrierId} disabled={!access||loading} onChange={e=>{setCarrierId(e.target.value);changeService('');}}><option value="">Select carrier</option>{access?.map(row=><option key={row.carrierId} value={row.carrierId}>{row.carrierName} · {row.role}</option>)}</Select>:null}
   <Select label="Road service" value={serviceId} disabled={!current||loading} onChange={e=>changeService(e.target.value)}><option value="">Select service</option>{services.map(row=>{const v=recordData(row);return <option key={row.id} value={row.id}>{String(v.mode)} · {String(v.serviceClass)} · {v.maxWeightKg==null?'Capacity not recorded':String(v.maxWeightKg)+' kg'} · {String(v.status)}</option>;})}</Select>
  </div>
  {loading?<p role="status">Loading authorized fleet…</p>:null}
  {error?<div role="alert" className={c.error}>{error} <Button variant="secondary" onClick={()=>access?setRefresh(n=>n+1):setAccessRefresh(n=>n+1)}>Retry</Button></div>:null}
  {access?.length===0?<section className={s.panel}><h2>No authorized carrier</h2><p>Your account has no Carrier access.</p></section>:null}
  {current?.partial?<p role="status" className={c.notice}>Partial catalog read. Counts apply to loaded records; editing is unavailable until references are complete.</p>:null}
  {current?.visualGaps.length?<p role="status" className={c.notice}>Pending operational records: {current.visualGaps.join(', ')}. Missing history is not represented as zero activity.</p>:null}
  {message?<p role="status" className={c.notice}>{message}</p>:null}
  {current&&services.length===0?<section className={s.panel}><h2>No road service recorded</h2><p>Service setup is pending connection in this screen.</p></section>:null}
  {current&&service&&!loading?<>
   {!vehicle&&!driverRow&&!register&&!editing?<div className={s.sectionNavigation}><div className={s.viewSwitch} role="group" aria-label="Fleet sections">
    <Button variant="secondary" size="compact" aria-pressed={view==='vehicles'} onClick={()=>{setDirectory('vehicles');setManageDrivers(false);}}><Truck size={17}/>Trucks</Button>
    <Button variant="secondary" size="compact" aria-pressed={view==='coverage'} onClick={()=>setDirectory('coverage')}><MapPin size={17}/>Areas and destinations</Button>
    <Button variant="secondary" size="compact" aria-pressed={view==='drivers'} onClick={()=>setDirectory('drivers')}><Users size={17}/>Drivers</Button>
    <Button variant="secondary" size="compact" aria-pressed={view==='operations'} onClick={()=>setDirectory('operations')}><List size={17}/>Driver assignment & agenda</Button>
    <Button variant="secondary" size="compact" aria-pressed={view==='depots'} onClick={()=>setDirectory('depots')}><MapPin size={17}/>Depots and coverage</Button>
   </div>{canWrite?<Button variant="primary" onClick={()=>onNavigate('register')}><Truck size={17}/>New truck</Button>:null}</div>:null}
   <ContentMotion identity={driverRow?'driver:'+driverRow.id:vehicle?'vehicle:'+vehicle.id:register||editing?'registration':view} focusOnChange>
    {(register||editing)&&canWrite?<ConnectedVehicleForm key={carrierId+serviceId+(editing?.id??'new')} carrierId={carrierId} serviceId={serviceId} record={editing??undefined} depots={current.depots} partners={current.partners} onSaved={saved} onClose={()=>{setEditing(null);onNavigate('vehicles');}}/>:
     register?<section className={s.panel}><h2>Vehicle registration unavailable</h2><p>An active service, complete references and ADMIN role are required.</p><Button onClick={()=>onNavigate('vehicles')}>Back to fleet</Button></section>:
     driverRow?<DriverProfile profile={connectedDriver(driverRow,driverVehicle)} vehicle={driverVehicle} back={back} openTruck={()=>{setDriverId(null);setSelected(driverVehicle?.id??null);}}/>:
     vehicle?<><VehicleDetail vehicle={vehicle} back={back} openDriver={()=>setDriverId(vehicle.driverId??null)}/><div className={c.actions}>{canWrite?<Button onClick={()=>setEditing(current.assets.find(r=>r.id===vehicle.id)??null)}>Edit recorded vehicle</Button>:null}<Button variant="secondary" onClick={()=>open(vehicle.id)}>Open 3D inspection</Button></div></>:
     view==='coverage'||view==='depots'?<ConnectedCarrierNetwork carrierId={carrierId} role={active!.role}/>:
     view==='operations'?<ConnectedCrew carrierId={carrierId} serviceId={serviceId} references={current} canWrite={canWrite} initialSection="operations" onCatalogChanged={()=>setRefresh(n=>n+1)}/>:
     view==='drivers'?<section className={s.panel}><div className={s.directoryHeading}><div><h2>Drivers</h2><p>Profiles from the authorized service. Performance data remains pending.</p></div><Button variant="secondary" onClick={()=>setManageDrivers(v=>!v)}>{manageDrivers?'Close management':'Manage drivers'}</Button></div>
      {manageDrivers?<ConnectedCrew carrierId={carrierId} serviceId={serviceId} references={current} canWrite={canWrite} initialSection="drivers" onCatalogChanged={()=>setRefresh(n=>n+1)}/>:<div className={c.cards}>{drivers.map(row=>{const driver=connectedDriver(row);return <article className={s.panel} key={row.id}><DriverPortrait driver={driver}/><h3>{driver.name}</h3><p>{driver.licenseClass} · {String(recordData(row).dutyStatus).replaceAll('_',' ')}</p><Button variant="secondary" onClick={()=>setDriverId(row.id)}>View driver profile</Button></article>;})}{!drivers.length?<p>No drivers recorded in this service.</p>:null}</div>}</section>:<>
      <div className={s.directoryHeading}><div><h2 tabIndex={-1}>Vehicle directory</h2><p>Find a truck and inspect its operating context.</p></div><div className={s.layoutSwitch} role="group" aria-label="Vehicle view"><Button variant="secondary" size="compact" aria-label="Cards" aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}><LayoutGrid size={18}/></Button><Button variant="secondary" size="compact" aria-label="List" aria-pressed={layout==='list'} onClick={()=>setLayout('list')}><List size={18}/></Button></div></div>
      <div className={s.toolbar}><SearchField fieldClassName={s.search} label="Search truck, driver or location" value={search} onValueChange={setSearch} clearLabel="Clear search" placeholder="Truck code, plate or driver…" shortcut/><Select fieldClassName={s.sort} label="Sort by" value={sort} onChange={e=>setSort(e.target.value as FleetSort)}><option value="attention">Attention needed</option><option value="code">Vehicle code</option><option value="fuel">Lowest fuel</option></Select></div>
      <div className={s.filters} role="group" aria-label="Fleet filters">{filters.map(item=><Button variant="secondary" size="compact" key={item.id} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{filter===item.id?<Check size={14}/>:null}{item.label}<span>{vehicles.filter(v=>matchesFleetFilter(v,item.id,now)).length}</span></Button>)}</div>
      <p className={s.results} role="status" aria-live="polite">{visible.length} of {vehicles.length} vehicles · Read {new Date(current.readAt).toLocaleString('en-US')}{current.partial?' · Partial catalog':''}</p>
      {visible.length?<div className={layout==='grid'?s.vehicleGrid:s.vehicleList}>{visible.map(v=><VehicleCard key={v.id} vehicle={v} list={layout==='list'} open={()=>open(v.id)} openDriver={()=>setDriverId(v.driverId??null)} buttonRef={node=>{if(node)cardButtons.current.set(v.id,node);else cardButtons.current.delete(v.id);}}/>)}</div>:<section className={s.empty}><Search size={30}/><h3>{vehicles.length?'No matches':'No road vehicles in this read'}</h3><Button variant="secondary" onClick={()=>{setFilter('all');setSearch('');}}>Clear filters</Button></section>}
     </>}
   </ContentMotion>
   {!register&&!editing?<><p className={s.photoNote}>Reference photographs illustrate the truck type, not the registered vehicle.</p><PhotoCredits/></>:null}
  </>:null}
  <p className={c.pending}>Pending data sources: fuel, speed, condition score, GPS, trip history and driver performance. No sample data fills missing connected fields.</p>
  {inspection?<TruckInspection key={inspection.id} context={inspection} illustrative onClose={()=>setInspectionId(null)} onOpenDetail={()=>{setSelected(inspection.id);setInspectionId(null);}}/>:null}
 </div>;
}
