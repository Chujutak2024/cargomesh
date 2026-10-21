import assert from "node:assert/strict";
import test from "node:test";
import {commercialFixture,id,at} from "@/features/shipper-portal/commercial-context.test-fixtures";
import {booking as bookingFixture,ev} from "@/features/carrier-portal/commercial-test-fixtures";
import {WorkflowRecordV2Schema} from "@/shared/schemas/v2/workflow";
import {commercialChatIntent,prepareCommercialAction,confirmCommercialAction,type CommercialChatState} from "./chat-commercial-action";
const now=()=>Date.parse(at);
function fixture():CommercialChatState{return {context:commercialFixture(),decisions:[],bookings:[]};}
function decision(state:CommercialChatState){
 const c=state.context, option=c.ranking!.data.options[0];
 const row=WorkflowRecordV2Schema.parse({id:id(20),kind:"decisions",organizationId:c.request.organizationId,carrierId:null,requestId:c.request.id,version:1,status:"SELECTED",createdAt:at,updatedAt:at,data:{planId:option.planId,selectedPlanId:option.planId,selectedOfferIds:option.offerIds,rationale:"Explicit test consent",policyId:c.ranking!.data.policyId,policyVersion:c.ranking!.data.policyVersion,consideredOfferIds:option.offerIds,evidence:[ev],selectedAt:at,selectedBy:id(98),status:"SELECTED"}});
 if(row.kind!=="decisions")throw new Error("Invalid test fixture");return row;
}
test("chat commands only propose; yes never selects or authorizes booking",()=>{
 assert.deepEqual(commercialChatIntent("elige la primera"),{kind:"SELECT",index:0});
 assert.deepEqual(commercialChatIntent("autoriza la reserva"),{kind:"BOOK",index:0});
 assert.equal(commercialChatIntent("sí"),null);assert.equal(commercialChatIntent("10 pallets"),null);
 const state=fixture();assert.equal(prepareCommercialAction(state,"SELECT",0,now()).totalCents,10000);
 assert.deepEqual(state.decisions,[]);assert.throws(()=>prepareCommercialAction(state,"BOOK",0,now()),/SELECT_FIRST/);
});
test("consent is required before any network read and review expires",async()=>{
 const prepared=prepareCommercialAction(fixture(),"SELECT",0,now());let reads=0;
 const read=async()=>{reads++;return fixture();};
 await assert.rejects(()=>confirmCommercialAction(prepared,false,new Map(),{read,now}),/CONSENT_REQUIRED/);
 await assert.rejects(()=>confirmCommercialAction(prepared,true,new Map(),{read,now:()=>prepared.expiresAt}),/REVIEW_EXPIRED/);
 assert.equal(reads,0);
});
test("tenant, version, price and ranking changes invalidate a proposal before writes",async()=>{
 const prepared=prepareCommercialAction(fixture(),"SELECT",0,now());
 for(const mutate of [(s:CommercialChatState)=>s.context.request.organizationId=id(999),(s:CommercialChatState)=>s.context.request.draftVersion++,(s:CommercialChatState)=>s.context.offers[0].data.price.amount++,(s:CommercialChatState)=>s.context.ranking!.version++]){
  const state=fixture();mutate(state);
  await assert.rejects(()=>confirmCommercialAction(prepared,true,new Map(),{read:async()=>state,now,select:async()=>{throw new Error("WRITE_MUST_NOT_RUN");}}),/INVALID_SCOPE|STALE_DRAFT|REVIEW_CHANGED|OFFER_UNAVAILABLE/);
 }
});
test("selection is persisted then reread, and repeat confirmation reuses the existing receipt",async()=>{
 const state=fixture(),prepared=prepareCommercialAction(state,"SELECT",0,now());let writes=0,reads=0;
 const deps={now,read:async()=>{reads++;return state;},select:async()=>{writes++;const receipt=decision(state);state.decisions.push(receipt);return receipt;}};
 const keys=new Map();assert.equal((await confirmCommercialAction(prepared,true,keys,deps)).receipts[0].id,id(20));
 await confirmCommercialAction(prepared,true,keys,deps);assert.equal(writes,1);assert.equal(reads,3);
});
test("a response not present in the authoritative reread is not success",async()=>{
 const state=fixture(),prepared=prepareCommercialAction(state,"SELECT",0,now());
 await assert.rejects(()=>confirmCommercialAction(prepared,true,new Map(),{now,read:async()=>state,select:async()=>decision(state)}),/RECEIPT_NOT_VERIFIED/);
});
test("network retries reuse selection idempotency key",async()=>{
 const state=fixture(),prepared=prepareCommercialAction(state,"SELECT",0,now()),keys=new Map(),seen:string[]=[];let attempts=0;
 const deps={now,read:async()=>state,newKey:()=>id(90),select:async(input:{intent?:{idempotencyKey:string}})=>{seen.push(input.intent!.idempotencyKey);if(attempts++===0)throw new Error("NETWORK");const receipt=decision(state);state.decisions.push(receipt);return receipt;}};
 await assert.rejects(()=>confirmCommercialAction(prepared,true,keys,deps),/NETWORK/);await confirmCommercialAction(prepared,true,keys,deps);
 assert.deepEqual(seen,[id(90),id(90)]);
});
test("booking requires a current selected decision and is separate from carrier confirmation",async()=>{
 const state=fixture();state.decisions=[decision(state)];const prepared=prepareCommercialAction(state,"BOOK",0,now());
 let bookings=0,preparations=0;
 const deps={now,read:async()=>state,book:async()=>{bookings++;const row=bookingFixture();state.bookings.push(row);return row;},capacity:async()=>{preparations++;throw new Error("CAPACITY_RETRY");}};
 await assert.rejects(()=>confirmCommercialAction(prepared,true,new Map(),deps),/CAPACITY_RETRY/);
 assert.equal(bookings,1);assert.equal(state.bookings[0].data.carrierConfirmationStatus,"PENDING");
 await assert.rejects(()=>confirmCommercialAction(prepared,true,new Map(),deps),/CAPACITY_RETRY/);
 assert.equal(bookings,1);assert.equal(preparations,2);
 state.decisions[0].data.policyVersion="obsolete";assert.throws(()=>prepareCommercialAction(state,"BOOK",0,now()),/SELECT_FIRST/);
});
test("unsubmitted drafts and invalid option indices are never selectable",()=>{
 const state=fixture();assert.throws(()=>prepareCommercialAction(state,"SELECT",1,now()),/OFFER_UNAVAILABLE/);
 state.context.request.status="DRAFT";assert.throws(()=>prepareCommercialAction(state,"SELECT",0,now()),/REQUEST_NOT_SUBMITTED/);
});

test('retrying authorization after delegated confirmation does not prepare capacity again',async()=>{
 const state=fixture();state.decisions=[decision(state)];const confirmed=bookingFixture();confirmed.status='CONFIRMED';confirmed.data.carrierConfirmationStatus='CONFIRMED';state.bookings=[confirmed];
 const proposal=prepareCommercialAction(state,'BOOK',0,now());let writes=0;const result=await confirmCommercialAction(proposal,true,new Map(),{now,read:async()=>state,capacity:async()=>{writes++;throw new Error('MUST_NOT_PREPARE_AGAIN');}});assert.equal(result.receipts[0].id,confirmed.id);assert.equal(writes,0);
});
