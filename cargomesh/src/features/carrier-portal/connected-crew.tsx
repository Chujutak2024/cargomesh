"use client";
import {displayReference} from '@/shared/lib/display-identity';
import {useEffect,useState} from 'react';
import {Button,Select} from '@/components/ui';
import {DataValue,fieldLabel} from './contract-form';
import {CatalogOperationalForm} from './operational-form';
import {portalErrorCopy} from './api';
import {readFleetResource} from './fleet-client';
import {recordData,recordName,recordStatus,type PortalRecord} from './records';
import {ResourceAvailability} from './resource-availability';
import s from './connected-fleet.module.css';
type References={assets:PortalRecord[];drivers:PortalRecord[];depots:PortalRecord[];services?:PortalRecord[];partial:boolean};
type Kind='drivers'|'calendars'|'maintenances'|'driver-assignments'|'vehicle-assignments';
type Editing={record?:PortalRecord;fixed:Record<string,unknown>;serviceId:string};
const names:Record<Kind,string>={drivers:'Drivers',calendars:'Vehicle calendars',maintenances:'Maintenance','driver-assignments':'Driver assignments','vehicle-assignments':'Vehicle assignments'};
export function ConnectedCrew({carrierId,serviceId,references,canWrite,initialSection,onCatalogChanged,allServices=false}:{carrierId:string;serviceId:string;references:References;canWrite:boolean;initialSection:'drivers'|'operations';onCatalogChanged:()=>void;allServices?:boolean}){
 const [data,setData]=useState<Record<string,PortalRecord[]>|null>(null),[partial,setPartial]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [kind,setKind]=useState<Kind>('drivers'),[availability,setAvailability]=useState(false),[editing,setEditing]=useState<Editing|null>(null);
 const [resourceId,setResourceId]=useState(''),[executionId,setExecutionId]=useState(''),[reservationId,setReservationId]=useState('');
 const [choosingService,setChoosingService]=useState(false),[newDriverService,setNewDriverService]=useState('');
 useEffect(()=>{setKind(initialSection==='drivers'?'drivers':'calendars');setEditing(null);setAvailability(false);setChoosingService(false);setResourceId('');setExecutionId('');setReservationId('');},[initialSection,carrierId,serviceId,allServices]);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setEditing(null);setChoosingService(false);
  const keys=['calendars','maintenances','repositioning-blocks','driver-assignments','vehicle-assignments','vehicle-combinations','executions','holds'];
  void Promise.all(keys.map(async key=>({key,...await readFleetResource(carrierId,key,controller.signal)}))).then(rows=>{if(!controller.signal.aborted){setData(Object.fromEntries(rows.map(r=>[r.key,r.records])));setPartial(rows.some(r=>r.truncated));}}).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});return()=>controller.abort();
 },[carrierId,refresh]);
 const services=(references.services??[]).filter(row=>row.carrierId===carrierId&&recordData(row).mode==='ROAD');
 const allowedServices=new Set(services.map(row=>row.id));
 const inScope=(row:PortalRecord)=>row.carrierId===carrierId&&(allServices?allowedServices.has(String(recordData(row).serviceId)):recordData(row).serviceId===serviceId);
 const assets=references.assets.filter(row=>inScope(row)&&recordData(row).mode==='ROAD'),drivers=references.drivers.filter(inScope);
 const resources=kind==='driver-assignments'?drivers:assets;
 const selectedResource=resources.find(row=>row.id===resourceId);
 const resourceService=selectedResource?String(recordData(selectedResource).serviceId):'';
 const executions=data?.executions.filter(row=>inScope(row)&&(!resourceService||recordData(row).serviceId===resourceService)&&['PLANNED','IN_PROGRESS'].includes(recordStatus(row)))??[];
 const calendars=data?.calendars.filter(inScope)??[];
 const calendarIds=calendars.filter(row=>recordData(row).assetId===resourceId&&recordData(row).serviceId===resourceService).map(row=>row.id);
 const holds=data?.holds.filter(row=>row.carrierId===carrierId&&calendarIds.includes(String(recordData(row).calendarId))&&recordData(row).active&&['HELD','CONFIRMED'].includes(recordStatus(row)))??[];
 const list=kind==='drivers'?drivers:(data?.[kind]??[]).filter(inScope);
 const writable=canWrite&&!references.partial&&!partial&&!!data;
 const canWriteService=(id:string)=>writable&&(allServices?services.some(row=>row.id===id&&recordData(row).status==='ACTIVE'):id===serviceId);
 const creatableServices=services.filter(row=>recordData(row).status==='ACTIVE');
 function changeKind(next:Kind){setKind(next);setAvailability(false);setEditing(null);setChoosingService(false);setResourceId('');setExecutionId('');setReservationId('');}
 function edit(record?:PortalRecord,chosenService?:string){
  const v=record?recordData(record):{};
  const targetService=record?String(v.serviceId):kind==='drivers'?chosenService??serviceId:resourceService;
  if(record&&!inScope(record)||!canWriteService(targetService))return;
  const fixed:Record<string,unknown>=kind==='drivers'?{portalAccountId:v.portalAccountId??null}:kind==='calendars'?{assetId:v.assetId??resourceId,capacityPoolId:v.capacityPoolId??null,readyPickupAreaId:v.readyPickupAreaId??null}:kind==='maintenances'?{assetId:v.assetId??resourceId}:kind==='driver-assignments'?{driverId:v.driverId??resourceId,executionId:v.executionId??executionId}:{assetId:v.assetId??resourceId,executionId:v.executionId??executionId,combinationId:v.combinationId??null,reservationId:record?v.reservationId:reservationId||null};
  setChoosingService(false);setEditing({record,fixed,serviceId:targetService});
 }
 const canCreate=kind==='drivers'?writable&&(allServices?creatableServices.length>0:canWriteService(serviceId)):!!selectedResource&&canWriteService(resourceService)&&(!kind.endsWith('assignments')||!!executions.find(row=>row.id===executionId&&recordData(row).serviceId===resourceService));
 return <section className={s.panel}><h2>{initialSection==='drivers'?'Driver management':'Agenda & assignments'}</h2>
 <p>Recorded schedules and assignments · times include their time zone.</p>
 <div className={s.actions}>{(Object.keys(names) as Kind[]).map(key=><Button key={key} variant="secondary" aria-pressed={kind===key&&!availability} onClick={()=>changeKind(key)}>{names[key]}</Button>)}<Button variant="secondary" aria-pressed={availability} onClick={()=>{setEditing(null);setChoosingService(false);setAvailability(true);}}>Check availability</Button><Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh agenda</Button></div>
 {error?<p role="alert">{error}</p>:!data?<p role="status">Loading authorized calendars, assignments and reservations…</p>:<>
 {partial||references.partial?<p className={s.notice}>Partial catalog read. Editing is disabled.</p>:null}
 {availability?<ResourceAvailability carrierId={carrierId} serviceId={allServices?'':serviceId} assets={assets} drivers={drivers}/>:editing?<CatalogOperationalForm key={kind+editing.serviceId+(editing.record?.id??'new')} kind={kind} carrierId={carrierId} serviceId={editing.serviceId} record={editing.record} fixed={editing.fixed} title={(editing.record?'Revise ':'Register ')+names[kind].toLowerCase()} onSaved={()=>{setRefresh(n=>n+1);onCatalogChanged();}} onClose={()=>setEditing(null)}/>:choosingService?<div className={s.context}>
 <Select label="Service for the new driver" value={newDriverService} onChange={e=>setNewDriverService(e.target.value)}><option value="">Select service</option>{creatableServices.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
 <Button disabled={!canWriteService(newDriverService)} onClick={()=>edit(undefined,newDriverService)}>Continue</Button><Button variant="secondary" onClick={()=>setChoosingService(false)}>Cancel</Button>
 </div>:<>
 <h3>{names[kind]} · {list.length}</h3>
 {kind!=='drivers'?<div className={s.context}><Select label={kind==='driver-assignments'?'Driver':'Vehicle'} value={resourceId} onChange={e=>{setResourceId(e.target.value);setExecutionId('');setReservationId('');}}><option value="">Select resource</option>{resources.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
 {kind.endsWith('assignments')?<Select label="Transport execution" value={executionId} onChange={e=>{setExecutionId(e.target.value);setReservationId('');}} disabled={!selectedResource}><option value="">Select active execution</option>{executions.map(row=><option key={row.id} value={row.id}>{recordName(row)} · {recordStatus(row)}</option>)}</Select>:null}
 {kind==='vehicle-assignments'?<Select label="Existing capacity reservation" value={reservationId} onChange={e=>setReservationId(e.target.value)}><option value="">No reservation — proposed assignment only</option>{holds.map(row=><option key={row.id} value={row.id}>{recordName(row)} · {recordStatus(row)}</option>)}</Select>:null}</div>:null}
 <Button disabled={!canCreate} onClick={()=>{if(kind==='drivers'&&allServices){setNewDriverService('');setChoosingService(true);}else edit();}}>Register {kind==='drivers'?'driver':kind==='calendars'?'calendar':kind==='maintenances'?'maintenance':'assignment'}</Button>
 {!canWrite?<p>Read only.</p>:null}
 {kind==='vehicle-assignments'?<p className={s.notice}>Confirmation requires a matching existing reservation.</p>:null}
 <div className={s.cards}>{list.map(row=>{const v=recordData(row);return <article key={row.id} className={s.card}><h3>{kind==='drivers'?recordName(row):recordName([...assets,...drivers].find(resource=>resource.id===(v.assetId??v.driverId)&&recordData(resource).serviceId===v.serviceId)??row)}</h3><p>{String(v.dutyStatus??v.status??v.freshness??recordStatus(row))} · revision {row.version}</p>{v.executionId?<p>Execution: <span title={String(v.executionId)}>{displayReference(String(v.executionId),'OP')}</span></p>:null}{kind==='vehicle-assignments'?<p>Reservation: {typeof v.reservationId==='string'?<><code title={v.reservationId}>{displayReference(v.reservationId,'RES')}</code> · {data.holds.find(hold=>hold.id===v.reservationId)?recordStatus(data.holds.find(hold=>hold.id===v.reservationId)!):'Details not loaded'}</>:'None · proposed assignment only'}</p>:null}<details><summary>Schedule & recorded details</summary>
 <dl>{Object.entries(v).filter(([key])=>['fullName','licenseClass','licenseValidUntil','licenseTimezone','qualifications','experienceYears','dutyStatus','availableWindows','dutyWindow','maximumDutySeconds','usedDutySeconds','horizon','timezone','source','freshness','validUntil','complete','window','blockedWindow','capacityCommitted','role','evidence','kind','reason'].includes(key)).map(([key,value])=><div key={key}><dt>{fieldLabel(key,false)}</dt><dd><DataValue value={value} es={false}/></dd></div>)}</dl></details>
 {canWriteService(String(v.serviceId))?<Button variant="secondary" onClick={()=>edit(row)}>Edit record</Button>:null}</article>;})}</div>
 {!list.length?<p>No records in this {allServices?'Carrier':'service'}.</p>:null}
 </>}
 </>}
 </section>;
}
