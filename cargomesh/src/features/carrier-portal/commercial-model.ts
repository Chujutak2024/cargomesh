import {locationDisplayLabel} from "@/shared/lib/display-identity";
import {z} from 'zod';
import {WorkflowRecordV2Schema,WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {CarrierOfferV2Schema} from '@/shared/schemas/v2/commercial';
type WorkflowRecordV2=z.infer<typeof WorkflowRecordV2Schema>;
export type Opportunity=Extract<WorkflowRecordV2,{kind:'opportunities'}>;
export type Offer=Extract<WorkflowRecordV2,{kind:'offers'}>;
export type Booking=Extract<WorkflowRecordV2,{kind:'bookings'}>;
export type Execution=Extract<WorkflowRecordV2,{kind:'executions'}>;
export type CommercialSnapshot={opportunities:Opportunity[];offers:Offer[];bookings:Booking[];executions:Execution[];partial:boolean;readAt:string};
export const stages=['New','Preparing offer','Customer review','Booking review','Scheduled','In progress','Completed','Closed','Needs review'] as const;
export type PipelineStage=typeof stages[number];
export function parseCommercialRecord<K extends WorkflowRecordV2['kind']>(kind:K,raw:unknown,carrierId:string,id?:string):Extract<WorkflowRecordV2,{kind:K}>{
 const row=WorkflowRecordV2Schema.parse(raw);
 if(row.kind!==kind||row.carrierId!==carrierId||id&&row.id!==id)throw new Error('INVALID_COMMERCIAL_SCOPE');
 if(row.kind==='offers'){const checked=CarrierOfferV2Schema.parse(Object.fromEntries(Object.keys(CarrierOfferV2Schema.innerType().shape).map(key=>[key,row.data[key]])));if(checked.id!==row.id||checked.carrierId!==carrierId||checked.requestId!==row.requestId)throw new Error('INVALID_COMMERCIAL_SCOPE');}
 return row as Extract<WorkflowRecordV2,{kind:K}>;
}
const sameRequest=(a:WorkflowRecordV2,b:WorkflowRecordV2)=>a.carrierId===b.carrierId&&a.requestId===b.requestId&&a.organizationId===b.organizationId;
export const opportunityOffers=(o:Opportunity,s:CommercialSnapshot)=>s.offers.filter(f=>f.data.opportunityId===o.id&&f.data.planCandidateId===o.data.planId&&sameRequest(o,f));
export function pendingCarrierOpportunities(s:CommercialSnapshot,now:number){
 if(s.partial)return [];
 return s.opportunities.filter(o=>(o.status==='SENT'||o.status==='ACCEPTED')
  &&Date.parse(o.data.responseDeadline)>now&&!opportunityOffers(o,s).length);
}
export function offerState(f:Offer,now:number){return f.status!=='RECEIVED'?f.status:Date.parse(f.data.validity.endsAt)<=now?'EXPIRED':Date.parse(f.data.validity.startsAt)>now?'NOT_STARTED':'CURRENT';}
export function bookingOffer(b:Booking,s:CommercialSnapshot){const id=z.string().uuid().safeParse(b.data.offerId);return id.success?s.offers.find(f=>f.id===id.data&&sameRequest(b,f))??null:null;}
export function bookingExecutions(b:Booking,s:CommercialSnapshot){return s.executions.filter(e=>e.data.bookingId===b.id&&sameRequest(b,e));}
export function orderStage(b:Booking,s:CommercialSnapshot):PipelineStage{
 const es=bookingExecutions(b,s),confirmation=b.data.carrierConfirmationStatus;
 if(es.some(e=>e.status==='IN_PROGRESS'))return confirmation==='CANCELLED'||confirmation==='REJECTED'||b.data.authorizationStatus==='REVOKED'?'Needs review':'In progress';
 if(confirmation==='CANCELLED'||confirmation==='REJECTED'||b.data.authorizationStatus==='REVOKED')return 'Closed';
 if(confirmation==='PENDING')return 'Booking review';
 if(confirmation!=='CONFIRMED')return 'Needs review';
 // A truncated execution list cannot establish that all work has finished.
 const offer=bookingOffer(b,s);
 if(es.length&&!s.partial&&es.every(e=>e.status==='COMPLETED'))return offer&&offer.data.coveredServiceIds.every(id=>es.some(e=>e.data.serviceId===id))?'Completed':'Needs review';
 if(es.length&&es.every(e=>e.status==='CANCELLED'))return 'Needs review';
 return 'Scheduled';
}
export function pipelineItems(s:CommercialSnapshot,now:number){return s.opportunities.map(o=>{
 const offers=opportunityOffers(o,s),ids=new Set(offers.map(f=>f.id));
 const bookings=s.bookings.filter(b=>typeof b.data.offerId==='string'&&ids.has(b.data.offerId)&&sameRequest(b,o));
 const orders=bookings.map(b=>orderStage(b,s));let stage:PipelineStage;
 if(orders.includes('In progress'))stage='In progress';
 else if(orders.includes('Booking review'))stage='Booking review';
 else if(orders.includes('Scheduled'))stage='Scheduled';
 else if(orders.length&&!s.partial&&orders.every(v=>v==='Completed'))stage='Completed';
 else if(orders.length&&orders.every(v=>v==='Closed'))stage='Closed';
 else if(orders.length)stage='Needs review';
 else if(s.partial||s.bookings.some(b=>sameRequest(b,o)&&!bookingOffer(b,s)))stage='Needs review';
 else if(offers.some(f=>offerState(f,now)==='CURRENT'||offerState(f,now)==='NOT_STARTED'))stage='Customer review';
 else if(o.status==='DECLINED'||o.status==='CANCELLED'||o.status==='EXPIRED')stage='Closed';
 else if(s.partial||s.bookings.some(b=>sameRequest(b,o)&&!bookingOffer(b,s))||offers.length||Date.parse(o.data.responseDeadline)<=now||o.status==='OFFERED')stage='Needs review';
 else stage=o.status==='ACCEPTED'?'Preparing offer':o.status==='SENT'?'New':'Needs review';
 return {opportunity:o,offers,bookings,stage};
});}
export function offerContext(o:Opportunity,assignmentIds:string[],supersedes:Offer|null,issuedAt:string){
 const ids=z.array(z.string().uuid()).min(1).refine(v=>new Set(v).size===v.length).parse(assignmentIds);
 if(ids.some(id=>!o.data.assignmentIds.includes(id)))throw new Error('OFFER_ASSIGNMENT_MISMATCH');
 // Native snapshots represent resource bindings; public assignmentIds represent grouped legs.
 // Full-opportunity quotes can use all recorded services without guessing a per-leg mapping.
 const full=ids.length===o.data.assignmentIds.length;
 const snapshots=full?o.data.assignmentSnapshots:o.data.assignmentSnapshots.filter(s=>ids.includes(typeof s.legAssignmentId==='string'?s.legAssignmentId:s.id));
 if(!snapshots.length||!full&&ids.some(id=>!snapshots.some(s=>(s.legAssignmentId??s.id)===id)))throw new Error('ASSIGNMENT_CONTEXT_INCOMPLETE');
 if(supersedes&&(!sameRequest(o,supersedes)||supersedes.data.opportunityId!==o.id||supersedes.status!=='RECEIVED'))throw new Error('OFFER_CONTEXT_MISMATCH');
 return {schemaVersion:'2.0',planCandidateId:o.data.planId,coveredAssignmentIds:ids,coveredServiceIds:[...new Set(snapshots.map(s=>s!.serviceId))],supersedesOfferId:supersedes?.id??null,issuedAt};
}
export function responseValue(o:Opportunity,response:'ACCEPTED'|'DECLINED',note:string,evidence:unknown){return WorkflowInputsV2['opportunities.respond'].parse({schemaVersion:'2.0',expectedVersion:o.version,response,note,evidence});}
export function routeLabel(o:Opportunity){return `${locationDisplayLabel(o.data.origin.city??o.data.origin.label)} → ${locationDisplayLabel(o.data.destination.city??o.data.destination.label)}`;}
