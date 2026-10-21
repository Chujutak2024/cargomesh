import assert from "node:assert/strict";
import test from "node:test";
import { confirmChatQuoteAction, quoteActionInput, type QuoteRequestSnapshot } from "./chat-quote-action";
const id="11111111-1111-4111-8111-111111111111", org="22222222-2222-4222-8222-222222222222";
const request:QuoteRequestSnapshot={id,organizationId:org,draftVersion:2,status:"PENDING",pickupWindow:{startsAt:"2030-01-03T10:00:00Z"}};
const deadline="2030-01-02T10:00:00Z", now=()=>Date.parse("2030-01-01T10:00:00Z");
const receipt={requestId:id,requestVersion:2,outcomes:[],evaluatedServices:0,eligibleServices:0,unresolvedServices:0,rankingId:null,rankingNotice:null,presentationLimit:3 as const};

test("quote action never submits a draft and requires explicit consent before any read",async()=>{
 assert.throws(()=>quoteActionInput({...request,status:"DRAFT"},deadline,now()),/REQUEST_NOT_SUBMITTED/);
 let reads=0;
 await assert.rejects(()=>confirmChatQuoteAction(request,deadline,false,new Map(),{read:async()=>{reads++;return request;},now}),/CONSENT_REQUIRED/);
 assert.equal(reads,0);
});
test("deadline must be future and within the pickup window",()=>{
 assert.throws(()=>quoteActionInput(request,"2029-01-01T00:00:00Z",now()),/INVALID_RESPONSE_DEADLINE/);
 assert.throws(()=>quoteActionInput(request,"2030-01-04T00:00:00Z",now()),/INVALID_RESPONSE_DEADLINE/);
});
test("version or tenant change invalidates the reviewed quote action before mutation",async()=>{
 let writes=0;
 const search=async()=>{writes++;return receipt;};
 await assert.rejects(()=>confirmChatQuoteAction(request,deadline,true,new Map(),{read:async()=>({...request,draftVersion:3}),search,now}),/STALE_DRAFT/);
 await assert.rejects(()=>confirmChatQuoteAction(request,deadline,true,new Map(),{read:async()=>({...request,organizationId:id}),search,now}),/INVALID_REQUEST_SCOPE/);
 assert.equal(writes,0);
});
test("network retry and repeated consent reuse the original idempotency key",async()=>{
 const keys=new Map<string,string>(),seen:string[]=[];let attempt=0,generated=0;
 const deps={read:async()=>request,now,newKey:()=>{generated++;return id;},search:async(requestId:string,input:unknown,key:string)=>{
  assert.equal(requestId,id);assert.equal((input as {consent:string}).consent,"REQUEST_QUOTES");seen.push(key);
  if(attempt++===0)throw new Error("NETWORK");return receipt;
 }};
 await assert.rejects(()=>confirmChatQuoteAction(request,deadline,true,keys,deps),/NETWORK/);
 assert.deepEqual(await confirmChatQuoteAction(request,deadline,true,keys,deps),receipt);
 await confirmChatQuoteAction(request,deadline,true,keys,deps);
 assert.equal(generated,1);assert.deepEqual(seen,[id,id,id]);
});
test("a receipt for another request is never displayed as success",async()=>{
 await assert.rejects(()=>confirmChatQuoteAction(request,deadline,true,new Map(),{read:async()=>request,search:async()=>({...receipt,requestId:org}),now}),/INVALID_QUOTE_RECEIPT/);
});

test("voice/text quote requests only prepare UI; selection or mixed cargo is not consent",async()=>{
 const {wantsQuoteSearch}=await import("./chat-quote-action");
 assert.equal(wantsQuoteSearch("por favor busca cotizaciones"),true);
 assert.equal(wantsQuoteSearch("request quotes"),true);
 assert.equal(wantsQuoteSearch("elige la primera"),false);
 assert.equal(wantsQuoteSearch("busca cotizaciones para 10 pallets"),false);
});
