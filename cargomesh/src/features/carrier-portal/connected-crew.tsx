"use client";
import {useLocale} from '@/features/i18n/locale-provider';
import type {RegularDriverRecordV2} from '@/shared/schemas/v2/regular-driver';
import {CrewAgenda} from './crew-agenda';
import {carrierStatusLabel} from '@/features/carrier-navigation/carrier-status';
import {CarrierSkeleton,CarrierUpdating} from '@/features/carrier-navigation/carrier-loading';
import {useCarrierMemoryState} from "@/features/carrier-navigation/carrier-continuity";
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
type References={assets:PortalRecord[];drivers:PortalRecord[];depots:PortalRecord[];services?:PortalRecord[];regularDrivers?:RegularDriverRecordV2[];regularDriversUnavailable?:boolean;readAt?:string;partial:boolean};
type Kind='drivers'|'calendars'|'maintenances'|'driver-assignments'|'vehicle-assignments';
type Editing={record?:PortalRecord;fixed:Record<string,unknown>;serviceId:string};
const names:Record<Kind,string>={drivers:'Drivers',calendars:'Vehicle calendars',maintenances:'Maintenance','driver-assignments':'Driver assignments','vehicle-assignments':'Vehicle assignments'};
export function ConnectedCrew({carrierId,serviceId,references,canWrite,initialSection,onCatalogChanged,allServices=false}:{carrierId:string;serviceId:string;references:References;canWrite:boolean;initialSection:'drivers'|'operations';onCatalogChanged:()=>void;allServices?:boolean}){
 const {t,locale}=useLocale();
 const [managing,setManaging]=useState(initialSection==='drivers');
 useEffect(()=>setManaging(initialSection==='drivers'),[carrierId,initialSection]);
 const [snapshot,setSnapshot]=useCarrierMemoryState<{records:Record<string,PortalRecord[]>;partial:boolean}|null>('crew:read:'+carrierId,null),[reading,setReading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const data=snapshot?.records??null,partial=snapshot?.partial??false;
 const [kind,setKind]=useCarrierMemoryState<Kind>('crew:kind-v2:'+carrierId+':'+initialSection,initialSection==='drivers'?'drivers':'calendars'),[availability,setAvailability]=useState(false),[editing,setEditing]=useState<Editing|null>(null);
 const [resourceId,setResourceId]=useState(''),[executionId,setExecutionId]=useState(''),[reservationId,setReservationId]=useState('');
 const [choosingService,setChoosingService]=useState(false),[newDriverService,setNewDriverService]=useState('');
 useEffect(()=>{setEditing(null);setAvailability(false);setChoosingService(false);setResourceId('');setExecutionId('');setReservationId('');},[initialSection,carrierId,serviceId,allServices]);
 useEffect(()=>{const controller=new AbortController();setReading(true);setError('');setEditing(null);setChoosingService(false);
  const keys=['calendars','maintenances','repositioning-blocks','driver-assignments','vehicle-assignments','vehicle-combinations','executions','holds'];
  void Promise.all(keys.map(async key=>({key,...await readFleetResource(carrierId,key,controller.signal)}))).then(rows=>{if(!controller.signal.aborted){setSnapshot({records:Object.fromEntries(rows.map(r=>[r.key,r.records])),partial:rows.some(r=>r.truncated)});}}).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));}).finally(()=>{if(!controller.signal.aborted)setReading(false);});return()=>controller.abort();
 },[carrierId,refresh,references.readAt]);
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
 const writable=canWrite&&!reading&&!error&&!references.partial&&!partial&&!!data;
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
 return <section className={s.panel}>
 <header className={s.toolbar}><div><h2>{initialSection==='drivers'?t('Gestionar conductores','Manage drivers'):availability?t('Disponibilidad de recursos','Resource availability'):managing?t('Asignar recursos','Assign resources'):t('Programación','Schedule')}</h2><p>{initialSection==='drivers'?t('Datos y acceso de tus conductores.','Your driver records.'):availability?t('Consulta un recurso y su ventana de atención.','Check a resource for a time window.'):managing?t('Vincula camiones y conductores con una orden.','Assign trucks and drivers to an order.'):t('Órdenes y recursos por horario.','Orders and resources by time.')}</p></div><div className={s.actions}>
 {initialSection==='operations'&&(managing||availability)?<Button variant="secondary" onClick={()=>{setManaging(false);setAvailability(false);setEditing(null);setChoosingService(false);}}>{t('Volver a la agenda','Back to schedule')}</Button>:null}
 {initialSection==='operations'&&!managing&&!availability?<><Button onClick={()=>{changeKind('vehicle-assignments');setManaging(true);}}>{t('Asignar recursos','Assign resources')}</Button><Button variant="secondary" onClick={()=>setAvailability(true)}>{t('Ver disponibilidad','Check availability')}</Button></>:null}
 
 </div></header>
 {managing&&initialSection==='operations'?<div className={s.context}><Select label={t('Qué necesitas organizar','What do you need to plan')} value={kind} onChange={event=>changeKind(event.target.value as Kind)}>
 <option value="vehicle-assignments">{t('Camiones por orden','Trucks per order')}</option><option value="driver-assignments">{t('Conductores por orden','Drivers per order')}</option><option value="calendars">{t('Calendarios de camiones','Truck calendars')}</option><option value="maintenances">{t('Mantenimiento','Maintenance')}</option>
 </Select></div>:null}
 {error?<p role="alert">{error}</p>:null}
 {!data?(error?null:<CarrierSkeleton shape="agenda"/>):<>
 {reading?<CarrierUpdating/>:null}
 {partial||references.partial?<p className={s.notice}>{t('Información incompleta. Actualiza antes de editar.','Incomplete information. Refresh before editing.')}</p>:null}
 {!managing&&!availability?<CrewAgenda executions={(data.executions??[]).filter(inScope)} vehicleAssignments={(data['vehicle-assignments']??[]).filter(inScope)} driverAssignments={(data['driver-assignments']??[]).filter(inScope)} holds={data.holds??[]} assets={assets} drivers={drivers} regularDrivers={references.regularDrivers??[]} regularDriversUnavailable={references.regularDriversUnavailable!==false} partial={partial||references.partial}/>:availability?<ResourceAvailability carrierId={carrierId} serviceId={allServices?'':serviceId} assets={assets} drivers={drivers}/>:editing?<CatalogOperationalForm key={kind+editing.serviceId+(editing.record?.id??'new')} kind={kind} carrierId={carrierId} serviceId={editing.serviceId} record={editing.record} fixed={editing.fixed} title={(editing.record?'Revise ':'Register ')+names[kind].toLowerCase()} onSaved={()=>{setRefresh(n=>n+1);onCatalogChanged();}} onClose={()=>setEditing(null)}/>:choosingService?<div className={s.context}>
 <Select label="Service for the new driver" value={newDriverService} onChange={e=>setNewDriverService(e.target.value)}><option value="">Select service</option>{creatableServices.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
 <Button disabled={!canWriteService(newDriverService)} onClick={()=>edit(undefined,newDriverService)}>Continue</Button><Button variant="secondary" onClick={()=>setChoosingService(false)}>Cancel</Button>
 </div>:<>
 <h3>{t(...({drivers:['Conductores','Drivers'],calendars:['Calendarios','Calendars'],maintenances:['Mantenimiento','Maintenance'],'driver-assignments':['Asignaciones de conductor','Driver assignments'],'vehicle-assignments':['Asignaciones de camión','Truck assignments']} as Record<Kind,[string,string]>)[kind])} · {list.length}</h3>
 {kind!=='drivers'?<div className={s.context}><Select label={kind==='driver-assignments'?'Driver':'Vehicle'} value={resourceId} onChange={e=>{setResourceId(e.target.value);setExecutionId('');setReservationId('');}}><option value="">Select resource</option>{resources.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
 {kind.endsWith('assignments')?<Select label="Transport execution" value={executionId} onChange={e=>{setExecutionId(e.target.value);setReservationId('');}} disabled={!selectedResource}><option value="">Select active execution</option>{executions.map(row=><option key={row.id} value={row.id}>{recordName(row)} · {recordStatus(row)}</option>)}</Select>:null}
 {kind==='vehicle-assignments'?<Select label="Existing capacity reservation" value={reservationId} onChange={e=>setReservationId(e.target.value)}><option value="">No reservation — proposed assignment only</option>{holds.map(row=><option key={row.id} value={row.id}>{recordName(row)} · {recordStatus(row)}</option>)}</Select>:null}</div>:null}
 <Button disabled={!canCreate} onClick={()=>{if(kind==='drivers'&&allServices){setNewDriverService('');setChoosingService(true);}else edit();}}>{t('Agregar','Add')} {t(...({drivers:['conductor','driver'],calendars:['calendario','calendar'],maintenances:['mantenimiento','maintenance'],'driver-assignments':['asignación','assignment'],'vehicle-assignments':['asignación','assignment']} as Record<Kind,[string,string]>)[kind])}</Button>
 {!canWrite?<p>{t('Solo lectura.','Read only.')}</p>:null}
 {kind==='vehicle-assignments'?<p className={s.notice}>{t('Para confirmar, vincula la reserva de capacidad.','Link the capacity reservation before confirming.')}</p>:null}
 <div className={s.cards}>{list.map(row=>{const v=recordData(row);return <article key={row.id} className={s.card}><h3>{kind==='drivers'?recordName(row):recordName([...assets,...drivers].find(resource=>resource.id===(v.assetId??v.driverId)&&recordData(resource).serviceId===v.serviceId)??row)}</h3><p>{carrierStatusLabel(String(v.dutyStatus??v.status??v.freshness??recordStatus(row)),locale==='es')}<small> · v{row.version}</small></p>{v.executionId?<p>Execution: <span title={String(v.executionId)}>{displayReference(String(v.executionId),'OP')}</span></p>:null}{kind==='vehicle-assignments'?<p>Reservation: {typeof v.reservationId==='string'?<><code title={v.reservationId}>{displayReference(v.reservationId,'RES')}</code> · {data.holds.find(hold=>hold.id===v.reservationId)?recordStatus(data.holds.find(hold=>hold.id===v.reservationId)!):'Details not loaded'}</>:'None · proposed assignment only'}</p>:null}<details><summary>{t('Horarios y detalles','Schedule & details')}</summary>
 <dl>{Object.entries(v).filter(([key])=>['fullName','licenseClass','licenseValidUntil','licenseTimezone','qualifications','experienceYears','dutyStatus','availableWindows','dutyWindow','maximumDutySeconds','usedDutySeconds','horizon','timezone','source','freshness','validUntil','complete','window','blockedWindow','capacityCommitted','role','evidence','kind','reason'].includes(key)).map(([key,value])=><div key={key}><dt>{fieldLabel(key,false)}</dt><dd><DataValue value={value} es={false}/></dd></div>)}</dl></details>
 {canWriteService(String(v.serviceId))?<Button variant="secondary" onClick={()=>edit(row)}>{t('Editar','Edit')}</Button>:null}</article>;})}</div>
 {!list.length?<p>No records in this {allServices?'Carrier':'service'}.</p>:null}
 </>}
 </>}
 </section>;
}
