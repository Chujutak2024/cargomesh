"use client";
import {z} from 'zod';
import {WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/commercial';
import {ContractForm} from './contract-form';
import {operationalSchema} from './operational-form';
import {offerContext,parseCommercialRecord,type Opportunity,type Offer,type Booking} from './commercial-model';
import {carrierSpokenOfferSeed} from './carrier-voice-price';
export type CommercialAction={kind:'respond';row:Opportunity;response:'ACCEPTED'|'DECLINED'}|{kind:'offer';row:Opportunity;assignmentIds:string[];supersedes:Offer|null;issuedAt:string;voicePrice?:number}|{kind:'withdraw';row:Offer}|{kind:'confirm-booking';row:Booking};
export function CommercialActionForm({carrierId,action,onSaved,onClose,onBusyChange}:{carrierId:string;action:CommercialAction;onSaved:()=>void;onClose:()=>void;onBusyChange:(busy:boolean)=>void}){
 const native=action.kind==='respond'?WorkflowInputsV2['opportunities.respond']:action.kind==='offer'?WorkflowInputsV2['offers.create']:action.kind==='withdraw'?WorkflowInputsV2['offers.withdraw']:WorkflowInputsV2['bookings.confirm'];
 const fixed=action.kind==='offer'?offerContext(action.row,action.assignmentIds,action.supersedes,action.issuedAt):{schemaVersion:'2.0',expectedVersion:action.row.version,...(action.kind==='respond'?{response:action.response}:{})};
 // Ordinary Carrier users issue manual offers. External adapters keep their own authentication.
 const schema=action.kind==='offer'?z.object({...WorkflowInputsV2['offers.create'].innerType().shape,source:z.object({channel:z.literal('MANUAL'),evidence:CommercialEvidenceV2Schema}).strict()}).superRefine((v,ctx)=>{const checked=native.safeParse(v);if(!checked.success)for(const issue of checked.error.issues)ctx.addIssue(issue);}):native;
 const suffix=action.kind==='offer'?`opportunities/${action.row.id}/offers`:action.kind==='respond'?`opportunities/${action.row.id}/responses`:action.kind==='withdraw'?`offers/${action.row.id}/withdrawals`:`bookings/${action.row.id}/confirmations`;
 const title=action.kind==='offer'?(action.supersedes?'Issue replacement offer':'Issue carrier offer'):action.kind==='respond'?(action.response==='ACCEPTED'?'Accept opportunity for review':'Decline opportunity'):action.kind==='withdraw'?'Withdraw offer':'Respond to customer booking';
 const spokenAmount=action.kind==='offer'?action.voicePrice:undefined;
 const voiceInitial=spokenAmount===undefined?undefined:carrierSpokenOfferSeed(spokenAmount);
 const initial=action.kind==='offer'?action.supersedes?.data??voiceInitial:undefined;
 return <ContractForm schema={operationalSchema(schema,fixed)} initial={initial} path={`/api/v2/carriers/${carrierId}/${suffix}`} title={title} hiddenReviewFields={Object.keys(fixed)} onSaved={onSaved} onClose={onClose} onBusyChange={onBusyChange} validateSaved={raw=>{
  const kind=action.kind==='offer'||action.kind==='withdraw'?'offers':action.kind==='respond'?'opportunities':'bookings';
  const row=parseCommercialRecord(kind,raw,carrierId,action.kind==='offer'?undefined:action.row.id);
  if(row.requestId!==action.row.requestId||row.organizationId!==action.row.organizationId||row.kind==='offers'&&action.kind==='offer'&&row.data.opportunityId!==action.row.id)throw new Error('INVALID_COMMERCIAL_SCOPE');
 }}/>
}
