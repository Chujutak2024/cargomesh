import test from 'node:test';import assert from 'node:assert/strict';
import {prepareAuthorizedBooking} from './booking-preparation';
import {commercialFixture,id,org,service,at} from '@/features/shipper-portal/commercial-context.test-fixtures';
import {booking,execution} from '@/features/carrier-portal/commercial-test-fixtures';
import {WorkflowServiceV2,type WorkflowRepositoryV2} from '../../workflow/application/workflow-service';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import {WorkflowRecordV2Schema} from '@/shared/schemas/v2/workflow';
const actor={organizationId:org,memberId:id(98)},now=Date.parse(at)+60_000,input={expectedVersion:1,consent:'PREPARE_AUTHORIZED_CAPACITY'};
function setup(two=false){
 const f=commercialFixture(),b=booking(),plan=f.plans[0];const executions:unknown[]=[],holds:unknown[]=[],calls:string[]=[];
 if(two){const resource=structuredClone(plan.data.legAssignments[0].resources[0]);resource.bindingId=id(74);resource.resourceId=id(75);resource.resource.assetId=id(76);resource.resource.calendarId=id(77);plan.data.legAssignments[0].resources.push(resource);}
 const repository:WorkflowRepositoryV2={async read(_actor,kind,scope){if(kind==='bookings')return [b];if(kind==='offers')return f.offers;if(kind==='plans')return [plan];if(kind==='executions')return executions;if(kind==='holds')return holds;throw Error(kind);},async command(_actor,action,_scope,key,value){calls.push(action);if(action==='executions.create'){const record=execution();executions.push(record);return {record,replay:false};}
  if(action==='holds.create'&&'bookingId' in value&&'assignmentId' in value){const resource=plan.data.legAssignments[0].resources.find(r=>r.resourceId===value.planResourceId)!;
   const record=WorkflowRecordV2Schema.parse({...b,id:id(100+holds.length),kind:'holds',status:'HELD',data:{bookingId:b.id,assignmentId:value.assignmentId,planResourceId:resource.resourceId,calendarId:resource.resource.calendarId,window:resource.resource.window,expiresAt:value.expiresAt,active:true,consolidationId:null,parentReservationId:null,capacityCommitted:{weightKg:1000,volumeM3:2},evidence:{reference:value.evidence.reference,verifiedAt:value.evidence.observedAt,validUntil:value.evidence.validUntil,provenanceStatus:value.evidence.provenanceStatus}}});holds.push(record);return {record,replay:false};}
  throw Error(action);}};
 const run=(raw:unknown=input,key=id(90))=>prepareAuthorizedBooking(actor,b.id,raw,key,new WorkflowServiceV2(repository),async()=>null,now);
 return {b,f,plan,executions,holds,calls,run};
}
test('authorization prepares every quoted truck without confirming Carrier capacity or departure',async()=>{const s=setup(true),r=await s.run();assert.equal(r.data.holdIds.length,2);assert.equal(r.data.executionIds.length,1);assert.deepEqual(s.calls,['executions.create','holds.create','holds.create']);assert.equal(s.b.status,'AUTHORIZED');assert.ok(s.holds.every(h=>(h as {status:string}).status==='HELD'));});
test('new retry intent reuses stored operations and reservations instead of duplicating them',async()=>{const s=setup();await s.run();const again=await s.run(input,id(91));assert.equal(again.data.holdIds.length,1);assert.equal(s.calls.length,2);});
test('foreign booking and stale version fail before any capacity write',async()=>{const s=setup();s.b.organizationId=id(80);await assert.rejects(s.run(),(e:unknown)=>e instanceof V2DraftError&&e.httpStatus===403);assert.equal(s.calls.length,0);const q=setup();await assert.rejects(q.run({...input,expectedVersion:2}),(e:unknown)=>e instanceof V2DraftError&&e.code==='STALE_DRAFT');assert.equal(q.calls.length,0);});
test('incomplete resource evidence is not replaced by client consent or a fabricated proof',async()=>{const s=setup();s.plan.data.legAssignments[0].evidence=[];await assert.rejects(s.run());assert.equal(s.calls.length,0);});
test('expired holds require explicit revalidation and cannot become ready on retry',async()=>{const s=setup();await s.run();const hold=s.holds[0] as {data:{expiresAt:string}};hold.data.expiresAt=at;await assert.rejects(s.run(),(e:unknown)=>e instanceof V2DraftError&&e.code==='RESOURCE_REVALIDATION_REQUIRED');assert.equal(s.calls.length,2);});
