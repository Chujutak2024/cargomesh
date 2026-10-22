"use client";
import {displayReference} from '@/shared/lib/display-identity';
import {useEffect,useState} from 'react';
import {useLocale} from '@/features/i18n/locale-provider';
import page from './record-page.module.css';
import {DataValue} from '@/features/carrier-portal/contract-form';
import {portalErrorCopy} from '@/features/carrier-portal/api';
import {recordData,recordName} from '@/features/carrier-portal/records';
import type {Execution} from '@/features/carrier-portal/commercial-model';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {readExecutionEvents} from './orders-client';
import {executionResources,holdResources,orderDates,type OrdersSnapshot,type Hold,type OrderAction,type ActionTarget} from './orders-model';
import p from './portal.module.css';
import s from './operations.module.css';
type Commands={can:(action:OrderAction,row:ActionTarget)=>boolean;begin:(action:OrderAction,row:ActionTarget)=>void;busy:boolean};
export function ReservationRecord({row,snapshot,commands}:{row:Hold;snapshot:OrdersSnapshot;commands:Commands}){
 const {t}=useLocale(),resource=holdResources(row,snapshot),name=resource.asset?recordName(resource.asset):resource.pool?recordName(resource.pool):t('Recurso pendiente','Resource pending');
 return <article className={page.resource}><h4>{displayReference(row.id,'RES')} · {name}<span className={page.state}>{row.status}</span></h4>
 <p>{orderDates(row.data.window.startsAt)} — {orderDates(row.data.window.endsAt)}</p>
 {row.data.capacityCommitted?<p>{row.data.capacityCommitted.weightKg.toLocaleString()} kg · {row.data.capacityCommitted.volumeM3.toLocaleString()} m³</p>:null}
 {row.status==='HELD'?<p>{t('Vence','Expires')}: {orderDates(row.data.expiresAt)}</p>:null}
 {!resource.booking||!resource.offer||!resource.calendar?<p role="status">{t('Falta completar las referencias de esta reserva.','Reservation references are incomplete.')}</p>:null}
 <details><summary>{t('Detalles técnicos','Technical details')}</summary><DataValue value={{reservationId:row.id,version:row.version,calendarId:row.data.calendarId,assignmentId:row.data.assignmentId,planResourceId:row.data.planResourceId,evidence:row.data.evidence,parentReservationId:row.data.parentReservationId}} es={false}/></details>
 <div className={s.row}>{row.status==='HELD'?<button disabled={!commands.can('holds.confirm',row)||commands.busy} onClick={()=>commands.begin('holds.confirm',row)}>{t('Confirmar reserva','Confirm reservation')}</button>:null}{commands.can('holds.release',row)?<button disabled={commands.busy} onClick={()=>commands.begin('holds.release',row)}>{t('Liberar reserva','Release reservation')}</button>:null}</div></article>;
}

export function ExecutionRecord({row,snapshot,commands,revision,onDenied}:{row:Execution;snapshot:OrdersSnapshot;commands:Commands;revision:number;onDenied:()=>void}){
 const [eventsOpen,setEventsOpen]=useState(false),[events,setEvents]=useState<Awaited<ReturnType<typeof readExecutionEvents>>|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const {t}=useLocale(),resources=executionResources(row,snapshot);
 useEffect(()=>{const controller=new AbortController();setEvents(null);setError('');if(!eventsOpen)return()=>controller.abort();
  void readExecutionEvents(snapshot.carrierId,row,controller.signal).then(result=>{if(!controller.signal.aborted)setEvents(result);}).catch(failure=>{if(!controller.signal.aborted){setError(portalErrorCopy(failure,false));if(failure&&typeof failure==='object'&&'status' in failure&&[401,403].includes(Number(failure.status)))onDenied();}});return()=>controller.abort();
 },[snapshot.carrierId,row.id,row.version,eventsOpen,revision,retry]);
 return <article className={page.resource}><h4>{t('Operación','Operation')} {displayReference(row.id,'OP')}<span className={page.state}>{row.status}</span></h4><p>Planned resource window: {orderDates(row.data.plannedWindow.startsAt)} — {orderDates(row.data.plannedWindow.endsAt)}</p>{row.data.actualStartedAt?<p>{t('Inicio real','Actual start')}: {orderDates(row.data.actualStartedAt)}</p>:null}{row.data.actualCompletedAt?<p>{t('Entrega real','Actual completion')}: {orderDates(row.data.actualCompletedAt)}</p>:null}
 {resources.issues.map(issue=><p key={issue} role="status">{issue}</p>)}
 <h4>{t('Vehículos','Vehicles')}</h4>{resources.vehicles.map(({assignment,asset,combination,reservation})=><div key={assignment.id}><p>{asset?recordName(asset):'Vehicle reference unavailable'} · {String(recordData(assignment).status)} · assignment revision {assignment.version}</p><p>Combination: {combination?recordName(combination):recordData(assignment).combinationId?'Unverified reference':'None recorded'} · Reservation: {reservation?displayReference(reservation.id,'RES')+' · '+reservation.status:'Not verified'}</p><details><summary>Assignment window, capacity and evidence</summary><DataValue value={recordData(assignment)} es={false}/></details></div>)}{!resources.vehicles.length?<p>{t('Asignación de vehículos pendiente.','Vehicle assignment pending.')}</p>:null}
 <h4>{t('Conductores','Drivers')}</h4>{resources.drivers.map(({assignment,driver})=><div key={assignment.id}><p>{driver?recordName(driver):'Driver reference unavailable'} · {String(recordData(assignment).role)} · {String(recordData(assignment).status)}</p><details><summary>Driver assignment window and evidence</summary><DataValue value={recordData(assignment)} es={false}/></details></div>)}{!resources.drivers.length?<p>{t('Asignación de conductores pendiente.','Driver assignment pending.')}</p>:null}
 <CarrierLink href={'/carriers/fleet/assignment?carrier='+encodeURIComponent(snapshot.carrierId)+'&service='+encodeURIComponent(row.data.serviceId)+'&execution='+encodeURIComponent(row.id)}>{t('Asignar recursos','Assign resources')}</CarrierLink><div className={s.row}>{(['executions.start','executions.complete','executions.cancel'] as const).map(action=><button key={action} disabled={commands.busy||!commands.can(action,row)} onClick={()=>commands.begin(action,row)}>{action==='executions.start'?'Start operation':action==='executions.complete'?'Complete operation':'Cancel operation'}</button>)}<button disabled={commands.busy} onClick={()=>setEventsOpen(v=>!v)}>{eventsOpen?'Hide event history':'Read event history'}</button></div>
 {eventsOpen?<section aria-label="Operation event history">{error?<p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry events</button></p>:!events?<p role="status">Reading recorded execution events…</p>:<>{events.partial?<p>Partial event history. Other events may exist.</p>:null}{events.records.map(event=><article key={event.id}><p>{event.data.action} · {orderDates(event.data.at)} · actor {displayReference(event.data.actorId,'USR')}</p><DataValue value={{reason:event.data.note,evidence:event.data.evidence,expectedVersion:event.data.expectedVersion}} es={false}/></article>)}{!events.records.length?<p>No events in this read.</p>:null}</>}</section>:null}</article>;
}
