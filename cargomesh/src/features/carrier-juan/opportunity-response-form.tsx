"use client";
import {carrierDisplayName} from '@/shared/lib/display-identity';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {mutationReceipt,portalErrorCopy} from '@/features/carrier-portal/api';
import {responseValue,type Opportunity} from '@/features/carrier-portal/commercial-model';
import {respondOpportunity} from './opportunity-client';
import {canRespondOpportunity} from './opportunity-model';
import p from './portal.module.css';

export function OpportunityResponseForm({carrier,row,response,allowed,onSaved,onClose,onBusyChange}:{carrier:CarrierPortalAccessV2;row:Opportunity;response:'ACCEPTED'|'DECLINED';allowed:boolean;onSaved:(row:Opportunity)=>void;onClose:()=>void;onBusyChange:(value:boolean)=>void}){
 const [note,setNote]=useState(''),[reference,setReference]=useState(`manual-response:${row.id}:v${row.version}`),[provenance,setProvenance]=useState<'UNKNOWN'|'SIMULATED'|'ESTIMATED'|'VERIFIED'>('UNKNOWN');
 const [observedAt]=useState(()=>new Date().toISOString()),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null),receipt=useRef<ReturnType<typeof mutationReceipt>|null>(null);
 useEffect(()=>()=>{request.current?.abort();onBusyChange(false);},[onBusyChange]);
 async function submit(event:FormEvent){
  event.preventDefault();if(busy||!allowed||!canRespondOpportunity(row,carrier.role,Date.now()))return;
  const evidence={reference,provider:carrier.carrierName,observedAt,validUntil:null,provenanceStatus:provenance};
  let body;try{body=responseValue(row,response,note,evidence);}catch{setError('Provide a response note and valid source reference.');return;}
  const path=`/api/v2/carriers/${carrier.carrierId}/opportunities/${row.id}/responses`;
  receipt.current=mutationReceipt(receipt.current,path,body,()=>crypto.randomUUID());
  const controller=new AbortController();request.current=controller;setBusy(true);onBusyChange(true);setError('');
  try{const saved=await respondOpportunity({carrierId:carrier.carrierId,role:carrier.role,row,response,note,evidence,key:receipt.current.key,signal:controller.signal});if(!controller.signal.aborted)onSaved(saved);}
  catch(failure){if(!controller.signal.aborted)setError(portalErrorCopy(failure,false));}
  finally{if(!controller.signal.aborted){setBusy(false);onBusyChange(false);}}
 }
 return <form onSubmit={submit} aria-label="Confirm opportunity response">
  <h3>{response==='ACCEPTED'?'Accept for review':'Decline opportunity'}</h3>
  <p>Responding to this opportunity does not edit the customer request, issue a quote, reserve capacity or confirm a booking.</p>
  <fieldset disabled={busy||!allowed} className={p.fields}>
   <label>Response note<textarea required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
   <label>Source reference<input required maxLength={500} value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <label>Evidence provenance<select value={provenance} onChange={e=>setProvenance(e.target.value as typeof provenance)}><option value="UNKNOWN">Unknown</option><option value="SIMULATED">Simulated</option><option value="ESTIMATED">Estimated</option><option value="VERIFIED">Verified — supporting evidence required</option></select></label>
  </fieldset>
  <small>Attributed to your account by the backend. Current opportunity revision: {row.version}. Source provider: {carrierDisplayName(carrier.carrierName,carrier.carrierId)}.</small>
  {error?<p role="alert" className={p.error}>{error} Refresh the opportunity if its version or state changed.</p>:null}
  <div className={p.toolbar}><button type="submit" disabled={busy||!allowed}>{busy?'Sending…':'Send response'}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
 </form>;
}
