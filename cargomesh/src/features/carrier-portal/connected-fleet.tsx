"use client";
import { useEffect, useMemo, useState } from 'react';
import { Button, SearchField, Select } from '@/components/ui';
import type { CarrierPortalAccessV2 } from '@/shared/schemas/v2/carrier-portal';
import { readConnectedFleet, readFleetAccess, roadAssets } from './connected-fleet-client';
import {ConnectedCrew} from './connected-crew';
import { ConnectedVehicleForm } from './connected-vehicle-form';
import { portalErrorCopy } from './api';
import { recordData, recordName, type PortalRecord } from './records';
import s from './connected-fleet.module.css';

export function ConnectedFleet({register,section,onNavigate,carrierContext,demoAvailable=false}:{register:boolean;section:string;onNavigate:(view:'vehicles'|'register')=>void;carrierContext?:CarrierPortalAccessV2;demoAvailable?:boolean}) {
  const [access,setAccess]=useState<CarrierPortalAccessV2[]|null>(null),[carrierId,setCarrierId]=useState(''),[serviceId,setServiceId]=useState('');
  const [data,setData]=useState<Awaited<ReturnType<typeof readConnectedFleet>>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [refresh,setRefresh]=useState(0),[accessRefresh,setAccessRefresh]=useState(0),[search,setSearch]=useState(''),[directory,setDirectory]=useState<'vehicles'|'drivers'|'operations'>('vehicles');
  const [selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState<PortalRecord|null>(null),[message,setMessage]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setAccess(null);setCarrierId('');setData(null);setError('');setLoading(true);
    if(carrierContext){setAccess([carrierContext]);setCarrierId(carrierContext.carrierId);setLoading(false);return()=>controller.abort();}
    void readFleetAccess(controller.signal).then(rows=>{if(!controller.signal.aborted){setAccess(rows);setCarrierId(rows.length===1?rows[0].carrierId:'');}})
      .catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[accessRefresh,carrierContext]);
  const active=access?.find(row=>row.carrierId===carrierId);
  useEffect(()=>{
    const previousService=data?.carrierId===active?.carrierId?serviceId:"";
    const controller=new AbortController();setData(null);setSelected(null);setEditing(null);setError('');setServiceId('');
    if(!active){if(access)setLoading(false);return()=>controller.abort();}
    setLoading(true);
    void readConnectedFleet(active.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted){setData(result);const road=result.services.filter(row=>{const v=recordData(row);return v.mode==='ROAD'&&v.status==='ACTIVE';});setServiceId(road.some(row=>row.id===previousService)?previousService:road.length===1?road[0].id:'');}})
      .catch(e=>{if(!controller.signal.aborted){setData(null);setError(portalErrorCopy(e,false));}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[active?.carrierId,refresh]);
  const current=data?.carrierId===carrierId?data:null;
  const services=current?.services.filter(row=>recordData(row).mode==='ROAD')??[];
  const service=services.find(row=>row.id===serviceId);
  const canWrite=active?.role==='ADMIN'&&!!service&&recordData(service).status==='ACTIVE'&&!current?.partial;
  const vehicles=useMemo(()=>roadAssets(current?.assets??[],serviceId),[current,serviceId]);
  const drivers=current?.drivers.filter(row=>recordData(row).serviceId===serviceId)??[];
  const rows=(directory==='vehicles'?vehicles:drivers).filter(row=>JSON.stringify(recordData(row)).toLowerCase().includes(search.trim().toLowerCase()));
  const vehicle=vehicles.find(row=>row.id===selected);
  function changeService(id:string){setServiceId(id);setSelected(null);setEditing(null);setSearch('');setMessage('');}
  function saved(record:PortalRecord){setMessage(recordName(record)+' saved · version '+record.version);setEditing(null);setRefresh(v=>v+1);onNavigate('vehicles');}
  return <div className={s.workspace}>
    <div className={s.toolbar}><span>Connected catalog · authorized records · no GPS</span>{demoAvailable?<a href="/v2-workspace?demo=1#/fleet/demo/vehicles">View local demo</a>:null}</div>
    <div className={s.context}>
      {!carrierContext?<Select label="Authorized carrier" value={carrierId} disabled={!!carrierContext||!access||loading} onChange={e=>{setCarrierId(e.target.value);changeService('');setMessage('');}}><option value="">Select carrier</option>{access?.map(row=><option key={row.carrierId} value={row.carrierId}>{row.carrierName} · {row.role}</option>)}</Select>:null}
      <Select label="Road service" value={serviceId} disabled={!current||loading} onChange={e=>changeService(e.target.value)}><option value="">Select service</option>{services.map(row=>{const v=recordData(row);return <option key={row.id} value={row.id}>{String(v.mode)} · {String(v.serviceClass)} · {v.maxWeightKg==null?'Capacity not recorded':String(v.maxWeightKg)+' kg'} · {String(v.status)}</option>;})}</Select>
      <Button variant="secondary" disabled={loading} onClick={()=>access?setRefresh(v=>v+1):setAccessRefresh(v=>v+1)}>Refresh</Button>
    </div>
    {loading?<p role="status">Loading authorized fleet…</p>:null}
    {error?<div role="alert" className={s.error}>{error} <Button variant="secondary" onClick={()=>access?setRefresh(v=>v+1):setAccessRefresh(v=>v+1)}>Retry</Button></div>:null}
    {access?.length===0?<section className={s.panel}><h2>No authorized carrier</h2><p>Your account has no Carrier access. Contact your administrator.</p></section>:null}
    {current?.partial?<p className={s.notice} role="status">Partial catalog read. Counts apply to loaded records; editing is unavailable until references are complete.</p>:null}
    {message?<p role="status" className={s.notice}>{message}</p>:null}
    {current&&services.length===0?<section className={s.panel}><h2>No road service recorded</h2><p>A vehicle needs an existing road service. Service setup is pending connection in this screen.</p></section>:null}
    {current&&service&&!loading?<>
      <div className={s.summary}><div><strong>{vehicles.length}{current.partial?'+':''}</strong><span>Loaded road vehicles</span></div><div><strong>{drivers.length}{current.partial?'+':''}</strong><span>Loaded drivers</span></div><div><strong>{active?.role}</strong><span>Your carrier role</span></div></div>
      <p className={s.notice}>Operating state is a catalog record. Check the resource window in Agenda & assignments. Booking authorization and live telemetry are separate.</p>
      {section==='carriers'||section==='coverage'?<section className={s.panel}><h2>Recorded depots</h2>{current.depots.map(depot=>{const d=recordData(depot),location=d.location as Record<string,unknown>;return <article className={s.card} key={depot.id}><h3>{recordName(depot)}</h3><p>{String(location.city)} · {String(location.countryCode)}</p><p>{location.lat==null?'Coordinates not recorded':String(location.lat)+', '+String(location.lng)}</p></article>;})}<p>Service areas and directed lanes are pending connection. A depot does not establish service coverage.</p></section>:section==='assignment'?<ConnectedCrew carrierId={carrierId} serviceId={serviceId} references={current} canWrite={canWrite} initialSection="operations" onCatalogChanged={()=>setRefresh(n=>n+1)}/>:
      (register||editing)&&canWrite?<ConnectedVehicleForm key={carrierId+serviceId+(editing?.id??'new')} carrierId={carrierId} serviceId={serviceId} record={editing??undefined} depots={current.depots} partners={current.partners} onSaved={saved} onClose={()=>{setEditing(null);onNavigate('vehicles');}}/>:
       register?<section className={s.panel}><h2>Vehicle registration unavailable</h2><p>An active road service, complete references and the ADMIN role are required.</p></section>:
       vehicle?<VehicleRecord record={vehicle} canWrite={canWrite} depots={current.depots} onBack={()=>setSelected(null)} onEdit={()=>setEditing(vehicle)}/>:
       <>
        <div className={s.actions}><Button variant="secondary" aria-pressed={directory==='vehicles'} onClick={()=>{setDirectory('vehicles');setSearch('');}}>Vehicles</Button><Button variant="secondary" aria-pressed={directory==='drivers'} onClick={()=>{setDirectory('drivers');setSearch('');}}>Drivers</Button><Button variant="secondary" aria-pressed={directory==='operations'} onClick={()=>setDirectory('operations')}>Agenda & assignments</Button>{canWrite?<Button onClick={()=>{setEditing(null);onNavigate('register');}}>New vehicle</Button>:<span>Catalog editing requires ADMIN.</span>}</div>
        {directory!=='vehicles'?<ConnectedCrew key={serviceId+directory} carrierId={carrierId} serviceId={serviceId} references={current} canWrite={canWrite} initialSection={directory} onCatalogChanged={()=>setRefresh(n=>n+1)}/>:<>
        <div className={s.toolbar}><SearchField label={'Search vehicles'} value={search} onValueChange={setSearch}/><small>Read {new Date(current.readAt).toLocaleString('en-US')}</small></div>
        {rows.length?<div className={s.cards}>{rows.map(row=>{const v=recordData(row),road=v.roadVehicle as Record<string,unknown>|null;return <article className={s.card} key={row.id}><h3>{recordName(row)}</h3>{<><p>{String(road?.plate??'Plate not recorded')} · {String(road?.brand??'')} {String(road?.model??'')}</p><p>{String(v.operatingStatus).replaceAll('_',' ')} · {Number(v.usefulCapacityKg).toLocaleString('en-US')} kg</p><Button variant="secondary" onClick={()=>setSelected(row.id)}>View vehicle</Button></>}</article>;})}</div>:<section className={s.panel}><h2>{search?'No matching records':directory==='vehicles'?'No road vehicles recorded':'No drivers recorded'}</h2><p>{search?'Try another search.':'This connected service has no records in the loaded catalog.'}</p></section>}
       </>}
       </>}
    </>:null}
    <p className={s.pending}>Pending data sources: fuel, speed, condition score, GPS, trip history and driver performance. No local examples are substituted for missing connected data.</p>
  </div>;
}
function VehicleRecord({record,depots,canWrite,onBack,onEdit}:{record:PortalRecord;depots:PortalRecord[];canWrite:boolean;onBack:()=>void;onEdit:()=>void}) {
  const v=recordData(record),r=v.roadVehicle as Record<string,unknown>;
  const facts:Record<string,unknown>={'Plate':r.plate,'Brand / model':[r.brand,r.model].filter(Boolean).join(' ')||null,'Equipment':v.equipmentType,'Resource role':v.role,'Useful capacity (kg)':v.usefulCapacityKg,'Usable volume (m³)':v.usableVolumeM3,'Operating state':v.operatingStatus,'Odometer (km)':r.odometerKm,'Registered':r.registeredAt,'Home depot':depots.find(d=>d.id===v.homeDepotId)?recordName(depots.find(d=>d.id===v.homeDepotId)!):null,'Source':v.provenance,'State / condition note':r.conditionReason,'Updated':record.updatedAt,'Revision':record.version};
  return <section className={s.panel}><div className={s.toolbar}><Button variant="secondary" onClick={onBack}>Back to vehicles</Button>{canWrite?<Button onClick={onEdit}>Edit vehicle</Button>:null}</div><h2>{recordName(record)}</h2><dl className={s.facts}>{Object.entries(facts).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value==null?'Not recorded':String(value)}</dd></div>)}</dl><p>Dimensions and other recorded attributes remain preserved when editing. This record does not confirm route access or booking availability.</p></section>;
}
