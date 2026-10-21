import {z} from 'zod';
import {createHash} from 'node:crypto';
import {WorkflowRecordV2Schema,type WorkflowContextV2} from '@/shared/schemas/v2/workflow';
import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/commercial';
import {BookingPreparationInputSchema,BookingPreparationResponseSchema} from '@/shared/schemas/v2/booking-preparation';
import {V2DraftError,type V2Actor} from '../../freight-requests/application/draft-service';
import type {WorkflowServiceV2} from '../../workflow/application/workflow-service';
type Port=Pick<WorkflowServiceV2,'read'|'command'>;
const context=(id:string|null=null,parentId:string|null=null):WorkflowContextV2=>({id,parentId,carrierId:null,requestId:null});
function key(bookingId:string,label:string){const h=createHash('sha256').update('booking-preparation:'+bookingId+':'+label).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
/** Resumable native commands after explicit authorization; never confirms Carrier capacity or departure. */
export async function prepareAuthorizedBooking(actor:V2Actor,id:string,raw:unknown,rawKey:string|undefined,workflow:Port,readDeadline:()=>Promise<string|null>,now=Date.now()){
 z.string().uuid().parse(id);const rootKey=z.string().uuid().parse(rawKey);const input=BookingPreparationInputSchema.parse(raw);
 async function one(kind:string,recordId:string){const r=await workflow.read(actor,kind,context(recordId),{});return WorkflowRecordV2Schema.parse(r.data);}
 const booking=await one('bookings',id);
 if(booking.kind!=='bookings'||booking.id!==id||booking.organizationId!==actor.organizationId)throw new V2DraftError('FORBIDDEN_WORKFLOW','Booking scope mismatch.',403);
 if(booking.version!==input.expectedVersion)throw new V2DraftError('STALE_DRAFT','Booking changed. Refresh before continuing.',409);
 if(booking.status!=='AUTHORIZED'||booking.data.authorizationStatus!=='AUTHORIZED'||booking.data.carrierConfirmationStatus!=='PENDING')throw new V2DraftError('BOOKING_NOT_AUTHORIZED','Booking is not awaiting Carrier confirmation.',409);
 if(!booking.data.offerId)throw new V2DraftError('OFFER_REFERENCE_REQUIRED','Selected offer is unavailable.',409);
 const offer=await one('offers',booking.data.offerId);
 if(offer.kind!=='offers'||offer.requestId!==booking.requestId||offer.organizationId!==booking.organizationId||offer.carrierId!==booking.carrierId||offer.status!=='RECEIVED')throw new V2DraftError('INVALID_BOOKING_SCOPE','Selected offer scope mismatch.',409);
 const plan=await one('plans',offer.data.planCandidateId);
 if(plan.kind!=='plans'||plan.organizationId!==booking.organizationId||plan.requestId!==booking.requestId||plan.data.eligibility!=='eligible')throw new V2DraftError('PLAN_NOT_ELIGIBLE','Plan must be revalidated.',409);
 const deadline=await readDeadline();
 const expiry=Math.min(Date.parse(offer.data.validity.endsAt),deadline?Date.parse(deadline):Date.parse(booking.data.authorizedAt)+30*60_000);
 if(!Number.isFinite(expiry)||expiry<=now||Date.parse(offer.data.validity.startsAt)>now)throw new V2DraftError('BOOKING_CONFIRMATION_EXPIRED','Request a current offer before reserving capacity.',409);
 const legs=plan.data.legAssignments.filter(a=>offer.data.coveredAssignmentIds.includes(a.id));
 if(legs.length!==offer.data.coveredAssignmentIds.length||legs.some(a=>a.carrierId!==booking.carrierId||!offer.data.coveredServiceIds.includes(a.serviceId)))throw new V2DraftError('INVALID_BOOKING_SCOPE','Quoted assignments do not match the plan.',409);
 const bindings=legs.flatMap(leg=>leg.resources.map(resource=>({leg,...resource})));
 if(!bindings.length||bindings.length>32||new Set(bindings.map(b=>b.bindingId)).size!==bindings.length)throw new V2DraftError('RESOURCE_ASSIGNMENT_MISMATCH','Resource references are incomplete.',409);
 // Validate every source before starting any compound operation. Copy evidence, never fabricate it.
 const targets=bindings.map(b=>{const evidence=CommercialEvidenceV2Schema.parse(b.resource.verificationSource?.source??b.leg.evidence[0]);
  if(!['VERIFIED','SIMULATED'].includes(evidence.provenanceStatus)||Date.parse(evidence.observedAt)>Math.min(now,Date.parse(b.resource.window.startsAt))||!evidence.validUntil||Date.parse(evidence.validUntil)<Date.parse(b.resource.window.endsAt))throw new V2DraftError('CAPACITY_EVIDENCE_REQUIRED','Current resource evidence is required.',409);
  return {...b,evidence,expiresAt:new Date(Math.min(expiry,Date.parse(b.resource.window.endsAt))).toISOString()};});
 async function list(kind:string){const r=await workflow.read(actor,kind,context(null,id),{limit:100,offset:0});const rows=z.array(WorkflowRecordV2Schema).parse(r.data);
  if('meta' in r&&r.meta?.nextOffset!==null)throw new V2DraftError('PARTIAL_COMMERCIAL_READ','Complete resource context is required.',503);
  if(rows.some(row=>row.organizationId!==booking.organizationId||row.requestId!==booking.requestId||row.carrierId!==booking.carrierId||!('bookingId' in row.data)||row.data.bookingId!==id))throw new V2DraftError('FORBIDDEN_WORKFLOW','Resource scope mismatch.',403);
  return rows;
 }
 let executions=await list('executions'),holds=await list('holds');
 const serviceIds=[...new Set(legs.map(a=>a.serviceId))];
 for(const serviceId of serviceIds){
  const existing=executions.filter(e=>e.kind==='executions'&&e.data.serviceId===serviceId);
  if(existing.length>1||existing.some(e=>e.status!=='PLANNED'))throw new V2DraftError('EXECUTION_NOT_READY','Operation requires review.',409);
  if(!existing.length){try{await workflow.command(actor,'executions.create',context(),{schemaVersion:'2.0',bookingId:id,serviceId},key(rootKey,'execution:'+serviceId));}
   catch(e){if(!(e instanceof V2DraftError)||e.httpStatus!==409)throw e;const current=await list('executions');if(!current.some(r=>r.kind==='executions'&&r.data.serviceId===serviceId&&r.status==='PLANNED'))throw e;}
   executions=await list('executions');
  }
 }
 for(const target of targets){
  const match=()=>holds.filter(h=>h.kind==='holds'&&h.data.assignmentId===target.leg.id&&h.data.planResourceId===target.resourceId&&h.data.parentReservationId===null);
  const valid=(h:ReturnType<typeof match>[number])=>h.kind==='holds'&&h.data.active&&h.data.calendarId===target.resource.calendarId&&Date.parse(h.data.window.startsAt)===Date.parse(target.resource.window.startsAt)&&Date.parse(h.data.window.endsAt)===Date.parse(target.resource.window.endsAt)&&(h.status==='CONFIRMED'||h.status==='HELD'&&!!h.data.expiresAt&&Date.parse(h.data.expiresAt)>now);
  if(match().length){if(match().length!==1||!match().every(valid))throw new V2DraftError('RESOURCE_REVALIDATION_REQUIRED','Recorded capacity must be revalidated.',409);continue;}
  try{await workflow.command(actor,'holds.create',context(),{schemaVersion:'2.0',bookingId:id,assignmentId:target.leg.id,planResourceId:target.resourceId,expiresAt:target.expiresAt,consolidationId:null,evidence:target.evidence},key(rootKey,'hold:'+target.leg.id+':'+target.resourceId));}
  catch(e){if(!(e instanceof V2DraftError)||e.httpStatus!==409)throw e;holds=await list('holds');if(match().length!==1||!match().every(valid))throw e;}
  holds=await list('holds');
  if(match().length!==1||!match().every(valid))throw new V2DraftError('RESOURCE_REVALIDATION_REQUIRED','Capacity preparation is incomplete.',409);
 }
 return BookingPreparationResponseSchema.parse({schemaVersion:'2.0',data:{bookingId:id,status:'PREPARED_AWAITING_CARRIER',executionIds:executions.filter(e=>e.kind==='executions'&&serviceIds.includes(e.data.serviceId)).map(e=>e.id),holdIds:holds.filter(h=>h.kind==='holds'&&h.data.parentReservationId===null&&targets.some(t=>t.leg.id===h.data.assignmentId&&t.resourceId===h.data.planResourceId)).map(h=>h.id)}});
}
