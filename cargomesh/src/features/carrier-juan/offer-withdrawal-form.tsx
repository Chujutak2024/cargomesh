"use client";
import {useEffect,useRef,useState} from 'react';
import {WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/commercial';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import type {Offer} from '@/features/carrier-portal/commercial-model';
import {mutationReceipt,portalErrorCopy} from '@/features/carrier-portal/api';
import {DataValue} from '@/features/carrier-portal/contract-form';
import {blankEvidence,explicitInstant} from './offers-model';
import {withdrawCarrierOffer} from './offers-client';
import {PreparationEvidenceEditor} from './offer-preparation-editor';
import s from './operations.module.css';
export function OfferWithdrawalForm({carrier,row,allowed,onSaved,onClose,onBusyChange}:{carrier:CarrierPortalAccessV2;row:Offer;allowed:boolean;onSaved:(f:Offer)=>void;onClose:()=>void;onBusyChange:(v:boolean)=>void}){
 const [note,setNote]=useState(''),[evidence,setEvidence]=useState(()=>blankEvidence(carrier.carrierName)),[review,setReview]=useState<ReturnType<typeof WorkflowInputsV2['offers.withdraw']['parse']>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const receipt=useRef<ReturnType<typeof mutationReceipt>|null>(null),request=useRef<AbortController|null>(null),callback=useRef(onBusyChange);callback.current=onBusyChange;
 useEffect(()=>()=>{request.current?.abort();callback.current(false);},[]);
 const submit=async()=>{if(!review||!allowed||busy||review.expectedVersion!==row.version)return;const path=`/api/v2/carriers/${carrier.carrierId}/offers/${row.id}/withdrawals`;
  receipt.current=mutationReceipt(receipt.current,path,review,()=>crypto.randomUUID());request.current=new AbortController();setBusy(true);callback.current(true);setError('');
  try{const result=await withdrawCarrierOffer(carrier,row,review,receipt.current.key,request.current.signal);if(!request.current.signal.aborted)onSaved(result);}
  catch(failure){if(!request.current.signal.aborted)setError(portalErrorCopy(failure,false));}finally{if(!request.current.signal.aborted){setBusy(false);callback.current(false);}}
 };
 return <section className={`${s.root} ${s.form}`}><h3>Withdraw issued offer</h3>{error?<p role="alert" className={s.error}>{error}</p>:null}
 {review?<><p>Confirm withdrawal of {row.data.carrierReference} at record revision {row.version}. The server checks current commitments and version.</p><DataValue value={review} es={false}/><div className={s.row}><button disabled={busy} onClick={()=>setReview(null)}>Back to withdrawal reason</button><button className={s.danger} disabled={!allowed||busy||review.expectedVersion!==row.version} onClick={()=>void submit()}>{busy?'Sending…':'Confirm withdrawal'}</button></div></>:<fieldset disabled={busy}><label>Withdrawal reason<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><PreparationEvidenceEditor label="Withdrawal evidence" value={evidence} onChange={setEvidence}/><button disabled={!allowed} onClick={()=>{try{const ev=CommercialEvidenceV2Schema.parse({...evidence,observedAt:explicitInstant(evidence.observedAt),validUntil:evidence.validUntil.trim()?explicitInstant(evidence.validUntil):null});setReview(WorkflowInputsV2['offers.withdraw'].parse({schemaVersion:'2.0',expectedVersion:row.version,note,evidence:ev}));setError('');}catch{setError('Complete the reason, evidence and explicit date offsets before confirming.');}}}>Review withdrawal</button></fieldset>}
 <button disabled={busy} onClick={onClose}>Close withdrawal</button></section>;
}
