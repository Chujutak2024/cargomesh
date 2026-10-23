import test from 'node:test';
import assert from 'node:assert/strict';
import {carrierVoiceTime} from './carrier-voice-time';
import {opportunity,carrier,org,request,id} from '@/features/carrier-portal/commercial-test-fixtures';
function row(){const value=opportunity();return {...value,data:{...value.data,requestBrief:{requestId:request,customerRef:org,requestVersion:2,currentRequestVersion:2,isCurrent:true,canReview:true,requestStatus:'PENDING'}}};}
const now=Date.parse('2026-10-16T23:59:00Z');
const read=(value:unknown,at=now,role:'ADMIN'|'DISPATCHER'='ADMIN')=>carrierVoiceTime(value,carrier,opportunity().id,role,at);
test('open snapshot uses server UTC time and Peru timezone, capped at the deadline',()=>{
 const value=read(row());assert.equal(value.deadlineState,'OPEN');assert.equal(value.mayPrepareOffer,true);
 assert.equal(value.mayRespond,true);assert.equal(value.timeZone,'America/Lima');assert.equal(value.asOf,'2026-10-16T23:59:00.000Z');
 assert.equal(value.validUntil,'2026-10-17T00:00:00.000Z');
});
test('at and after the deadline all new commercial guidance is blocked',()=>{
 for(const at of [Date.parse(opportunity().data.responseDeadline),Date.parse('2026-10-23T07:00:00Z')]){
 const value=read(row(),at);assert.equal(value.deadlineState,'EXPIRED');assert.equal(value.reason,'DEADLINE_PASSED');
 assert.equal(value.mayRespond,false);assert.equal(value.mayPrepareOffer,false);}
});
test('closed states, dispatcher role and missing or stale projections fail closed',()=>{
 for(const status of ['DECLINED','CANCELLED','EXPIRED'])assert.equal(read({...row(),status}).mayPrepareOffer,false);
 assert.equal(read(row(),now,'DISPATCHER').mayPrepareOffer,false);
 assert.equal(read(opportunity()).mayPrepareOffer,false);
 for(const change of [{currentRequestVersion:3},{isCurrent:false},{canReview:false},{requestStatus:'CONFIRMED'},{requestId:id(91)},{customerRef:id(92)}]){
 const value=row();assert.equal(read({...value,data:{...value.data,requestBrief:{...value.data.requestBrief,...change}}}).mayPrepareOffer,false);}
});
test('cross-carrier, wrong opportunity and invalid clocks are rejected',()=>{
 assert.throws(()=>carrierVoiceTime(row(),id(91),opportunity().id,'ADMIN',now));
 assert.throws(()=>carrierVoiceTime(row(),carrier,id(91),'ADMIN',now));
 for(const at of [NaN,Infinity,1e20])assert.throws(()=>read(row(),at));
});
