"use client";
import {useEffect,useRef,useState} from 'react';
import {WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/commercial';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {DataValue} from '@/features/carrier-portal/contract-form';
import {mutationReceipt,portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import {PreparationEvidenceEditor} from './offer-preparation-editor';
import {blankEvidence,explicitInstant} from './offers-model';
import {sendOrderCommand,orderCommandPath} from './orders-client';
import {orderActionAllowed,type OrdersSnapshot,type OrderAction,type ActionTarget} from './orders-model';
import s from './operations.module.css';
export type SelectedOrderAction={action:OrderAction;row:ActionTarget;confirmation?:'CONFIRMED'|'REJECTED'};
export function OrderActionForm({carrier,selected,snapshot,enabled,onSaved,onDenied,onClose,onBusyChange}:{carrier:CarrierPortalAccessV2;selected:SelectedOrderAction;snapshot:OrdersSnapshot;enabled:boolean;onSaved:()=>void;onDenied?:()=>void;onClose:()=>void;onBusyChange:(busy:boolean)=>void}){
 const [note,setNote]=useState(''),[reference,setReference]=useState(''),[evidence,setEvidence]=useState(()=>blankEvidence(carrier.carrierName)),[review,setReview]=useState<unknown|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const receipt=useRef<ReturnType<typeof mutationReceipt>|null>(null),controller=useRef<AbortController|null>(null),callback=useRef(onBusyChange);callback.current=onBusyChange;
 useEffect(()=>()=>{controller.current?.abort();callback.current(false);},[]);
 const {action,row,confirmation}=selected;
 const allowed=enabled&&orderActionAllowed(action,row,snapshot,carrier.role,Date.now(),confirmation);
 const submit=async()=>{if(!allowed||!review||busy)return;const path=orderCommandPath(carrier.carrierId,action,row);receipt.current=mutationReceipt(receipt.current,path,review,()=>crypto.randomUUID());controller.current=new AbortController();setBusy(true);callback.current(true);setError('');
  try{await sendOrderCommand({carrierId:carrier.carrierId,role:carrier.role,action,row,snapshot,value:review,key:receipt.current.key,signal:controller.current.signal});if(!controller.current.signal.aborted)onSaved();}
  catch(failure){if(!controller.current.signal.aborted){setError(portalErrorCopy(failure,false)+' No success is assumed. Your reason and evidence are retained; reread current records after a conflict.');if(failure instanceof PortalApiError&&[401,403].includes(failure.status))onDenied?.();}}
  finally{if(!controller.current.signal.aborted){setBusy(false);callback.current(false);}}
 };
 return <section className={`${s.root} ${s.form}`} aria-label="Review operational command"><h3>{action.replace('.', ' · ')}{confirmation?' · '+confirmation:''}</h3><p>Record revision {row.version}. The server validates state, role, capacity, evidence and concurrent changes.</p>{error?<p role="alert" className={s.error}>{error}</p>:null}
 {review?<><p>Confirm this audited action. No extra release, allocation or booking command is sent automatically by this screen. Refresh will show the server's actual related-record changes.</p><DataValue value={review} es={false}/><div className={s.row}><button disabled={busy} onClick={()=>setReview(null)}>Back to reason and evidence</button><button className={s.primary} disabled={!allowed||busy} onClick={()=>void submit()}>{busy?'Sending…':'Confirm action'}</button></div></>:<fieldset disabled={busy}><label>Action reason<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>{action==='bookings.confirm'?<label>Carrier booking reference<input maxLength={2000} value={reference} onChange={e=>setReference(e.target.value)}/></label>:null}<PreparationEvidenceEditor label="Auditable evidence (explicit date offset)" value={evidence} onChange={setEvidence}/><button disabled={!allowed} onClick={()=>{try{const source=CommercialEvidenceV2Schema.parse({...evidence,observedAt:explicitInstant(evidence.observedAt),validUntil:evidence.validUntil.trim()?explicitInstant(evidence.validUntil):null});setReview(WorkflowInputsV2[action].parse({schemaVersion:'2.0',expectedVersion:row.version,note,evidence:source,...(action==='bookings.confirm'?{carrierReference:reference,confirmation}:{})}));setError('');}catch{setError('Complete the reason, reference where required, and evidence with explicit date offsets.');}}}>Review action</button></fieldset>}
 {!allowed?<p>The current role, state, window or complete relationship evidence does not permit this action. Refresh before continuing.</p>:null}<button disabled={busy} onClick={onClose}>Close action</button></section>;
}
