import {z} from 'zod';
import {WorkflowRecordV2Schema} from '@/shared/schemas/v2/workflow';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import {bookingOffer,bookingExecutions,opportunityOffers,orderStage,type CommercialSnapshot,type Booking,type Execution} from '@/features/carrier-portal/commercial-model';
import {canCarrierAction,type CarrierPortalRole} from '@/features/carrier-portal/permissions';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';
type RecordV2=z.infer<typeof WorkflowRecordV2Schema>;
export type Hold=Extract<RecordV2,{kind:'holds'}>;
export type ExecutionEvent=Extract<RecordV2,{kind:'execution-events'}>;
export type OrdersSnapshot=CommercialSnapshot&{carrierId:string;holds:Hold[];resources:Record<string,PortalRecord[]>;issues:string[]};
export type OrderAction='bookings.confirm'|'bookings.cancel'|'holds.confirm'|'holds.release'|'executions.start'|'executions.complete'|'executions.cancel';
export type ActionTarget=Booking|Hold|Execution;
export const orderDates=(value:string|null)=>value?new Date(value).toLocaleString('en-US',{timeZone:'UTC'})+' UTC':'Unknown';
export const sameOrderScope=(a:{carrierId:string|null;organizationId:string|null;requestId:string|null},b:{carrierId:string|null;organizationId:string|null;requestId:string|null})=>!!a.carrierId&&!!a.organizationId&&!!a.requestId&&a.carrierId===b.carrierId&&a.organizationId===b.organizationId&&a.requestId===b.requestId;
const id=(value:unknown)=>{const r=z.string().uuid().safeParse(value);return r.success?r.data:null;};
const selectedOffer=(b:Booking,s:OrdersSnapshot)=>{const offer=bookingOffer(b,s);return offer&&sameOrderScope(b,offer)?offer:null;};
export function bookingFromExecution(e:Execution,s:OrdersSnapshot){return s.bookings.find(b=>b.id===e.data.bookingId&&sameOrderScope(b,e))??null;}
export function bookingFromHold(h:Hold,s:OrdersSnapshot){return s.bookings.find(b=>b.id===h.data.bookingId&&sameOrderScope(b,h))??null;}
export function orderRelationships(b:Booking,s:OrdersSnapshot){
 const offer=selectedOffer(b,s),opportunity=offer?s.opportunities.find(o=>sameOrderScope(o,offer)&&opportunityOffers(o,s).some(f=>f.id===offer.id))??null:null;
 const linkedExecutions=bookingExecutions(b,s).filter(e=>sameOrderScope(b,e)),executions=offer?linkedExecutions.filter(e=>offer.data.coveredServiceIds.includes(e.data.serviceId)):[];
 const referencedHolds=s.holds.filter(h=>h.data.bookingId===b.id&&sameOrderScope(h,b));
 const holds=offer?referencedHolds.filter(h=>offer.data.coveredAssignmentIds.includes(h.data.assignmentId)):[];
 const issues:string[]=[];if(!offer)issues.push(b.data.offerId?'Selected offer is unavailable or does not match the loaded Carrier, organization and request; price, services and plan are not inferred.':'The booking projection does not include a selected offer reference. Price, services and plan cannot be correlated.');
 if(offer&&!opportunity)issues.push('Source opportunity is unavailable or does not match the offer, organization and request.');
 if(linkedExecutions.length!==executions.length)issues.push('Some operations reference this booking but their service is not proven by the selected offer.');
 if(referencedHolds.length!==holds.length)issues.push('Some reservations reference this booking but their plan assignment is unverified.');
 if(s.partial)issues.push('Partial read: missing reservations, operations or resource references cannot be treated as absent.');
 const inconsistentActive=linkedExecutions.some(e=>e.status==='IN_PROGRESS')&&(b.data.authorizationStatus==='REVOKED'||['CANCELLED','REJECTED'].includes(b.data.carrierConfirmationStatus));
 const derived=inconsistentActive?'Needs review':orderStage(b,{...s,executions,partial:s.partial||issues.length>0});
 return {offer,opportunity,executions,holds,referencedHolds,linkedExecutions,issues,stage:issues.length&&!['Closed','In progress'].includes(derived)?'Needs review' as const:derived};
}
export function executionResources(e:Execution,s:OrdersSnapshot){
 const b=bookingFromExecution(e,s),offer=b?selectedOffer(b,s):null,serviceValid=!!offer&&offer.data.coveredServiceIds.includes(e.data.serviceId),issues:string[]=[];
 const scoped=(key:string)=>s.resources[key]?.filter(r=>r.carrierId===e.carrierId&&recordData(r).serviceId===e.data.serviceId)??[];
 const vehicleAssignments=scoped('vehicle-assignments').filter(r=>recordData(r).executionId===e.id),driverAssignments=scoped('driver-assignments').filter(r=>recordData(r).executionId===e.id);
 if(!b)issues.push('Booking scope is unavailable.');if(!serviceValid)issues.push('Execution service is not proven by the selected offer.');
 const vehicles=vehicleAssignments.map(assignment=>{const v=recordData(assignment),asset=scoped('assets').find(a=>a.id===v.assetId)??null;
  const combination=v.combinationId?scoped('vehicle-combinations').find(c=>c.id===v.combinationId)??null:null;
  const reservation=v.reservationId?s.holds.find(h=>h.id===v.reservationId&&!!b&&sameOrderScope(h,b)&&h.data.bookingId===b.id&&!!offer&&offer.data.coveredAssignmentIds.includes(h.data.assignmentId))??null:null;
  if(!asset||v.combinationId&&(!combination||(!Array.isArray(recordData(combination).assetIds)||!(recordData(combination).assetIds as string[]).includes(String(v.assetId))))||v.reservationId&&!reservation)issues.push('A vehicle assignment has missing or incompatible asset, combination or reservation references.');
  return {assignment,asset,combination,reservation};
 });
 const drivers=driverAssignments.map(assignment=>{const driver=scoped('drivers').find(d=>d.id===recordData(assignment).driverId)??null;if(!driver)issues.push('An assigned driver is unavailable in the same service catalog.');return {assignment,driver};});
 return {booking:b,offer,serviceValid,vehicles,drivers,issues};
}
export function holdResources(h:Hold,s:OrdersSnapshot){
 const booking=bookingFromHold(h,s),offer=booking?selectedOffer(booking,s):null;
 const calendar=s.resources.calendars?.find(c=>c.id===h.data.calendarId&&c.carrierId===h.carrierId&&!!offer&&offer.data.coveredAssignmentIds.includes(h.data.assignmentId)&&offer.data.coveredServiceIds.includes(String(recordData(c).serviceId)))??null;
 const value=calendar?recordData(calendar):null,serviceId=value?.serviceId;
 const resolve=(key:string,reference:unknown)=>s.resources[key]?.find(r=>r.id===reference&&r.carrierId===h.carrierId&&recordData(r).serviceId===serviceId)??null;
 return {booking,offer,calendar,asset:value?.assetId?resolve('assets',value.assetId):null,pool:value?.capacityPoolId?resolve('capacity-pools',value.capacityPoolId):null};
}
/** Full capacity is not asserted from a booking flag or a single hold per service. */
export function capacitySummary(b:Booking,s:OrdersSnapshot,now:number){
 const relations=orderRelationships(b,s),confirmed=relations.holds.filter(h=>h.status==='CONFIRMED'&&h.data.active);
 if(s.partial||!relations.offer)return {label:'Unknown: incomplete capacity context',confirmed:confirmed.length,ready:false};
 const assignments=relations.offer.data.coveredAssignmentIds;
 const snapshots=relations.opportunity?.data.assignmentSnapshots??[];
 let proven=assignments.length>0;
 for(const assignment of assignments){
  const bindings=snapshots.filter(a=>(a.legAssignmentId??a.id)===assignment);
  if(!bindings.length){proven=false;continue;}
  for(const binding of bindings){const resource=binding.resource as Record<string,unknown>|undefined,resourceId=id(binding.resourceId),window=TimeWindowV2Schema.safeParse(binding.window??resource?.window);
   const needed=z.object({weightKg:z.number().nonnegative(),volumeM3:z.number().nonnegative()}).safeParse(binding.capacityNeeded);
   if(!resourceId||!window.success||!needed.success||!relations.offer.data.coveredServiceIds.includes(binding.serviceId)||!confirmed.some(h=>h.data.assignmentId===assignment&&h.data.planResourceId===resourceId&&h.data.calendarId===resource?.calendarId&&h.data.capacityCommitted.weightKg>=needed.data.weightKg&&h.data.capacityCommitted.volumeM3>=needed.data.volumeM3&&Date.parse(h.data.window.startsAt)<=Date.parse(window.data.startsAt)&&Date.parse(h.data.window.endsAt)>=Date.parse(window.data.endsAt)&&['VERIFIED','SIMULATED'].includes(h.data.evidence.provenanceStatus)&&Date.parse(h.data.evidence.verifiedAt)<=now&&h.data.evidence.validUntil!==null&&Date.parse(h.data.evidence.validUntil)>=Math.max(now,Date.parse(window.data.endsAt))&&holdResources(h,s).calendar))proven=false;
  }
 }
 return {label:proven?(confirmed.some(h=>h.data.evidence.provenanceStatus==='SIMULATED')?'Simulated recorded commitments cover the quoted resource windows':'Verified recorded commitments cover the quoted resource windows'):'Full capacity unverified · '+confirmed.length+' recorded confirmed reservation(s)',confirmed:confirmed.length,ready:proven};
}
export function orderActionAllowed(action:OrderAction,row:ActionTarget,s:OrdersSnapshot,role:CarrierPortalRole,now:number,confirmation?:'CONFIRMED'|'REJECTED'){
 if(s.partial||row.carrierId!==s.carrierId||!action.startsWith(row.kind+'.')||!canCarrierAction(role,action,row.status))return false;
 const recorded=(row.kind==='bookings'?s.bookings:row.kind==='holds'?s.holds:s.executions).find(r=>r.id===row.id&&r.version===row.version&&sameOrderScope(r,row));if(!recorded)return false;
 if(row.kind==='bookings'){
  if(!s.bookings.some(b=>b.id===row.id&&sameOrderScope(b,row)))return false;
  if(action==='bookings.confirm')return row.data.authorizationStatus==='AUTHORIZED'&&row.data.carrierConfirmationStatus==='PENDING'&&(confirmation==='REJECTED'||!!selectedOffer(row,s)&&capacitySummary(row,s,now).ready);
  return action==='bookings.cancel';
 }
 if(row.kind==='holds'){
  const context=holdResources(row,s),b=context.booking;if(!b||!context.offer||!context.calendar||row.data.parentReservationId!==null)return false;
  if(action==='holds.confirm')return row.status==='HELD'&&row.data.active&&row.data.expiresAt!==null&&Date.parse(row.data.expiresAt)>now&&['AUTHORIZED','CONFIRMED'].includes(b.status);
  if(action==='holds.release')return ['HELD','CONFIRMED'].includes(row.status)&&b.status!=='CONFIRMED'&&!bookingExecutions(b,s).some(e=>e.status==='IN_PROGRESS')&&!(s.resources['vehicle-assignments']??[]).some(a=>recordData(a).reservationId===row.id&&recordData(a).status==='CONFIRMED');
  return false;
 }
 const context=executionResources(row,s);if(!context.booking||!context.serviceValid)return false;
 if(action==='executions.start')return context.booking.status==='CONFIRMED'&&context.booking.data.authorizationStatus==='AUTHORIZED'&&context.booking.data.carrierConfirmationStatus==='CONFIRMED'&&Date.parse(row.data.plannedWindow.startsAt)<=now&&now<Date.parse(row.data.plannedWindow.endsAt)&&context.issues.length===0&&context.drivers.some(d=>recordData(d.assignment).status==='CONFIRMED'&&recordData(d.assignment).role==='PRIMARY'&&d.driver)&&context.vehicles.length>0&&context.vehicles.every(v=>recordData(v.assignment).status==='CONFIRMED'&&v.asset&&v.reservation?.status==='CONFIRMED');
 return action==='executions.complete'||action==='executions.cancel';
}
export function orderSelectionFromHash(hash:string){
 const raw=hash.match(/^#\/(?:tracking|orders)\/details\/([^/?#]+)/)?.[1];if(!raw)return null;try{return id(decodeURIComponent(raw));}catch{return null;}
}
export function linkedCommercialId(hash:string,kind:'offers'|'opportunities'){
 const raw=hash.match(new RegExp('^#/'+(kind==='offers'?'desk':'shipments')+'/details/([^/?#]+)'))?.[1];if(!raw)return null;try{return id(decodeURIComponent(raw));}catch{return null;}
}
