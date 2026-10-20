import assert from "node:assert/strict";
import test from "node:test";
import { bookingResources } from "./booking-resources-model";
import { commercialHistory } from "./commercial-history-model";
import { commercialFixture, id, at } from "./commercial-context.test-fixtures";
import type { WorkflowRecordV2 } from "./shipper-model";
const context = commercialFixture(), meta = {id:id(91),organizationId:context.request.organizationId,requestId:context.request.id,carrierId:context.offers[0].carrierId,version:1,createdAt:at,updatedAt:at};
const booking = {...meta,kind:"bookings",status:"AUTHORIZED",data:{decisionId:id(92),offerId:context.offers[0].id,authorizedAt:at,carrierConfirmationStatus:"PENDING"}} as Extract<WorkflowRecordV2,{kind:"bookings"}>;
const execution = {...meta,id:id(93),kind:"executions",status:"PLANNED",data:{bookingId:booking.id}} as WorkflowRecordV2;
test("booking resource reads remain scoped; empty or failed data cannot manufacture committed capacity",()=>{
  const pending=bookingResources(booking,[],true);assert.deepEqual(pending.holds,[]);assert.deepEqual(pending.executions,[]);
  assert.equal(bookingResources(booking,[],false).complete,false);
  assert.equal(bookingResources(booking,[execution],true).executions[0].status,"PLANNED");
  assert.equal(bookingResources(booking,[{...execution,organizationId:id(99)}],true).complete,false);
  assert.deepEqual(bookingResources(booking,[{...execution,carrierId:id(99)}],true).executions,[]);
  const rejected={...booking,status:"REJECTED",data:{...booking.data,carrierConfirmationStatus:"REJECTED" as const}};
  assert.deepEqual(bookingResources(rejected,[],true).holds,[]);
});
test("commercial history contains native decisions and booking audit times, not physical events or foreign requests",()=>{
  const decision={...meta,id:id(92),kind:"decisions",status:"SELECTED",data:{selectedAt:at}} as WorkflowRecordV2;
  const confirmed={...booking,status:"CONFIRMED",updatedAt:"2026-10-18T00:00:00Z"};
  const events=commercialHistory([context.request],[decision,confirmed,execution,{...booking,organizationId:id(99)}]);
  assert.equal(events.length,3);assert.equal(events[0].type,"response");
  assert.deepEqual(commercialHistory([], [booking]),[]);
  assert.equal(events.some(event=>event.row.kind===("executions" as string)),false);
});
