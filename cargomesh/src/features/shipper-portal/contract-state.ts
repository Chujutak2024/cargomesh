import type { FreightRequestV2Data } from '@/features/v2-intake/contracts';
import type { WorkflowRecordV2 } from './shipper-model';
type Booking=Extract<WorkflowRecordV2,{kind:'bookings'}>;
type Execution=Extract<WorkflowRecordV2,{kind:'executions'}>;
/** Offer validity controls new contracts; it never expires an existing confirmed booking. */
export function requestContractState(request:Pick<FreightRequestV2Data,'id'|'organizationId'>,bookings:Booking[],executions:Execution[]=[]){
 const active=bookings.filter(b=>b.organizationId===request.organizationId&&b.requestId===request.id
  &&['AUTHORIZED','CONFIRMED'].includes(b.status)&&b.data.authorizationStatus==='AUTHORIZED'
  &&['PENDING','CONFIRMED'].includes(b.data.carrierConfirmationStatus));
 const confirmed=active.filter(b=>b.status==='CONFIRMED'&&b.data.carrierConfirmationStatus==='CONFIRMED');
 const linked=executions.filter(e=>e.organizationId===request.organizationId&&e.requestId===request.id
  &&confirmed.some(b=>b.id===e.data.bookingId&&b.carrierId===e.carrierId));
 const phase:'IN_PROGRESS'|'COMPLETED'|'CONFIRMED'|'PARTIAL'|'AWAITING_CARRIER'|null=linked.some(e=>e.status==='IN_PROGRESS')?'IN_PROGRESS'
  :linked.length>0&&linked.every(e=>e.status==='COMPLETED')&&new Set(linked.map(e=>e.data.bookingId)).size===active.length?'COMPLETED'
  :confirmed.length===active.length&&active.length>0?'CONFIRMED':confirmed.length>0?'PARTIAL':active.length>0?'AWAITING_CARRIER':null;
 return {active,confirmed,phase,canRequestQuotes:active.length===0};
}
