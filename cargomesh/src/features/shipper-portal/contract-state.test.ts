import assert from 'node:assert/strict';
import test from 'node:test';
import {requestContractState} from './contract-state';
import {formatDateTime,type WorkflowRecordV2} from './shipper-model';
type Booking=Extract<WorkflowRecordV2,{kind:'bookings'}>;
const request={id:'request',organizationId:'organization'};
const booking={id:'booking',kind:'bookings',organizationId:request.organizationId,requestId:request.id,carrierId:'carrier',status:'CONFIRMED',data:{authorizationStatus:'AUTHORIZED',carrierConfirmationStatus:'CONFIRMED'}} as Booking;
test('a confirmed contract survives the quote expiry and blocks new quotation',()=>{
 const state=requestContractState(request,[booking]);
 assert.equal(state.phase,'CONFIRMED');assert.equal(state.canRequestQuotes,false);
 assert.equal(requestContractState(request,[{...booking,status:'CANCELLED',data:{...booking.data,carrierConfirmationStatus:'CANCELLED'}}]).canRequestQuotes,true);
});
test('foreign bookings cannot change the request phase; partial confirmation stays partial',()=>{
 assert.equal(requestContractState(request,[{...booking,organizationId:'foreign'}]).phase,null);
 assert.equal(requestContractState(request,[{...booking,requestId:'foreign'}]).phase,null);
 const pending={...booking,id:'other',status:'AUTHORIZED',data:{...booking.data,carrierConfirmationStatus:'PENDING' as const}};
 assert.equal(requestContractState(request,[booking,pending]).phase,'PARTIAL');
});
test('displayed instants use explicit Lima time independently of the host zone',()=>{
 const value=formatDateTime('2026-11-02T13:00:00Z','en-US');
 assert.match(value,/8:00/);assert.match(value,/PET \(UTC−05:00\)/);
 assert.equal(formatDateTime('invalid','en-US'),'Unknown');
});
