"use client";
import {useEffect,useState} from 'react';
import {Button,Select} from '@/components/ui';
import {DataValue,fieldLabel} from './contract-form';
import {CatalogOperationalForm} from './operational-form';
import {portalErrorCopy} from './api';
import {readFleetResource} from './fleet-client';
import {recordData,recordName,recordStatus,type PortalRecord} from './records';
import {ResourceAvailability} from './resource-availability';
import s from './connected-fleet.module.css';
type References={assets:PortalRecord[];drivers:PortalRecord[];depots:PortalRecord[];partial:boolean};
type Kind='drivers'|'calendars'|'maintenances'|'driver-assignments'|'vehicle-assignments';
const names:Record<Kind,string>={drivers:'Drivers',calendars:'Vehicle calendars',maintenances:'Maintenance','driver-assignments':'Driver assignments','vehicle-assignments':'Vehicle assignments'};
export function ConnectedCrew({carrierId,serviceId,references,canWrite,initialSection,onCatalogChanged}:{carrierId:string;serviceId:string;references:References;canWrite:boolean;initialSection:'drivers'|'operations';onCatalogChanged:()=>void}){
 const [data,setData]=useState<Record<string,PortalRecord[]>|null>(null),[partial,setPartial]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [kind,setKind]=useState<Kind>('drivers'),[availability,setAvailability]=useState(false),[editing,setEditing]=useState<{record?:PortalRecord;fixed:Record<string,unknown>}|null>(null);
 const [resourceId,setResourceId]=useState(''),[executionId,setExecutionId]=useState(''),[reservationId,setReservationId]=useState('');
 useEffect(()=>{setKind(initialSection==='drivers'?'drivers':'calendars');setEditing(null);setAvailability(false);},[initialSection]);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setEditing(null);
  const keys=['calendars','maintenances','repositioning-blocks','driver-assignments','vehicle-assignments','vehicle-combinations','executions','holds'];
  void Promise.all(keys.map(async key=>({key,...await readFleetResource(carrierId,key,controller.signal)}))).then(rows=>{if(!controller.signal.aborted){setData(Object.fromEntries(rows.map(r=>[r.key,r.records])));setPartial(rows.some(r=>r.truncated));}}).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});return()=>controller.abort();
 },[carrierId,serviceId,refresh]);
 const assets=references.assets.filter(r=>recordData(r).serviceId===serviceId&&recordData(r).mode==='ROAD'),drivers=references.drivers.filter(r=>recordData(r).serviceId===serviceId);
 const resources=kind==='driver-assignments'?drivers:assets;
 const executions=data?.executions.filter(r=>recordData(r).serviceId===serviceId&&['PLANNED','IN_PROGRESS'].includes(recordStatus(r)))??[];
 const calendars=data?.calendars.filter(r=>recordData(r).serviceId===serviceId)??[];
 const calendarIds=calendars.filter(r=>recordData(r).assetId===resourceId).map(r=>r.id);
 const holds=data?.holds.filter(r=>calendarIds.includes(String(recordData(r).calendarId))&&recordData(r).active&&['HELD','CONFIRMED'].includes(recordStatus(r)))??[];
 const list=kind==='drivers'?drivers:(data?.[kind]??[]).filter(r=>recordData(r).serviceId===serviceId);
 const writable=canWrite&&!references.partial&&!partial&&!!data;
 function changeKind(next:Kind){setKind(next);setAvailability(false);setEditing(null);setResourceId('');setExecutionId('');setReservationId('');}
 function edit(record?:PortalRecord){
  const v=record?recordData(record):{};
  const fixed:Record<string,unknown>=kind==='drivers'?{portalAccountId:v.portalAccountId??null}:kind==='calendars'?{assetId:v.assetId??resourceId,capacityPoolId:v.capacityPoolId??null,readyPickupAreaId:v.readyPickupAreaId??null}:kind==='maintenances'?{assetId:v.assetId??resourceId}:kind==='driver-assignments'?{driverId:v.driverId??resourceId,executionId:v.executionId??executionId}:{assetId:v.assetId??resourceId,executionId:v.executionId??executionId,combinationId:v.combinationId??null,reservationId:record?v.reservationId:reservationId||null};
  setEditing({record,fixed});
 }
 const canCreate=writable&&(kind==='drivers'||!!resources.find(r=>r.id===resourceId))&&(!kind.endsWith('assignments')||!!executions.find(r=>r.id===executionId));
 return <section className={s.panel}><h2>{initialSection==='drivers'?'Driver management':'Agenda & assignments'}</h2>
 <p>Times include their offset and are stored as instants. Resource availability is checked for a period; it does not confirm cargo compatibility, road access or a booking.</p>
 <div className={s.actions}>{(Object.keys(names) as Kind[]).map(key=><Button key={key} variant="secondary" aria-pressed={kind===key&&!availability} onClick={()=>changeKind(key)}>{names[key]}</Button>)}<Button variant="secondary" aria-pressed={availability} onClick={()=>{setEditing(null);setAvailability(true);}}>Check availability</Button><Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh agenda</Button></div>
 {error?<p role="alert">{error}</p>:!data?<p role="status">Loading authorized calendars, assignments and reservations…</p>:<>
 {partial||references.partial?<p className={s.notice}>Partial catalog read. Editing is disabled and absence of a record is not availability evidence.</p>:null}
 {availability?<ResourceAvailability carrierId={carrierId} serviceId={serviceId} assets={assets} drivers={drivers}/>:editing?<CatalogOperationalForm key={kind+(editing.record?.id??'new')} kind={kind} carrierId={carrierId} serviceId={serviceId} record={editing.record} fixed={editing.fixed} title={(editing.record?'Revise ':'Register ')+names[kind].toLowerCase()} onSaved={()=>{setRefresh(n=>n+1);onCatalogChanged();}} onClose={()=>setEditing(null)}/>:<>
 <h3>{names[kind]}</h3>
 {kind!=='drivers'?<div className={s.context}><Select label={kind==='driver-assignments'?'Driver':'Vehicle'} value={resourceId} onChange={e=>{setResourceId(e.target.value);setReservationId('');}}><option value="">Select resource</option>{resources.map(r=><option key={r.id} value={r.id}>{recordName(r)}</option>)}</Select>
 {kind.endsWith('assignments')?<Select label="Transport execution" value={executionId} onChange={e=>setExecutionId(e.target.value)}><option value="">Select active execution</option>{executions.map(r=><option key={r.id} value={r.id}>{recordName(r)} · {recordStatus(r)}</option>)}</Select>:null}
 {kind==='vehicle-assignments'?<Select label="Existing capacity reservation" value={reservationId} onChange={e=>setReservationId(e.target.value)}><option value="">No reservation — proposed assignment only</option>{holds.map(r=><option key={r.id} value={r.id}>{recordName(r)} · {recordStatus(r)}</option>)}</Select>:null}</div>:null}
 <Button disabled={!canCreate} onClick={()=>edit()}>Register {kind==='drivers'?'driver':kind==='calendars'?'calendar':kind==='maintenances'?'maintenance':'assignment'}</Button>
 {!writable?<p>Writing requires ADMIN, an active service and complete references.</p>:null}
 {kind==='vehicle-assignments'?<p className={s.notice}>Confirmation requires a matching existing reservation. The backend validates asset, execution, window, capacity and conflicts. This screen does not create a commercial reservation.</p>:null}
 <div className={s.cards}>{list.map(row=>{const v=recordData(row);return <article key={row.id} className={s.card}><h3>{kind==='drivers'?recordName(row):recordName([...assets,...drivers].find(r=>r.id===(v.assetId??v.driverId))??row)}</h3><p>{String(v.dutyStatus??v.status??v.freshness??recordStatus(row))} · revision {row.version}</p>{v.executionId?<p>Execution: <span title={String(v.executionId)}>{String(v.executionId).slice(0,8).toUpperCase()}</span></p>:null}{kind==='vehicle-assignments'?<p>Reservation: {typeof v.reservationId==='string'?<><code title={v.reservationId}>{v.reservationId.slice(0,8).toUpperCase()}</code> · {data.holds.find(hold=>hold.id===v.reservationId)?recordStatus(data.holds.find(hold=>hold.id===v.reservationId)!):'Details not loaded'}</>:'None · proposed assignment only'}</p>:null}<details><summary>Schedule & recorded details</summary>
 <dl>{Object.entries(v).filter(([key])=>['fullName','licenseClass','licenseValidUntil','licenseTimezone','qualifications','experienceYears','dutyStatus','availableWindows','dutyWindow','maximumDutySeconds','usedDutySeconds','horizon','timezone','source','freshness','validUntil','complete','window','blockedWindow','capacityCommitted','role','evidence','source','kind','reason'].includes(key)).map(([key,value])=><div key={key}><dt>{fieldLabel(key,false)}</dt><dd><DataValue value={value} es={false}/></dd></div>)}</dl></details>
 {writable?<Button variant="secondary" onClick={()=>edit(row)}>Edit record</Button>:null}</article>;})}</div>
 {!list.length?<p>No records in the loaded service catalog.</p>:null}
 </>}
 </>}
 </section>;
}
