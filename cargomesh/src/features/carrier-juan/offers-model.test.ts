import test from 'node:test';import assert from 'node:assert/strict';
import {opportunity,offer,fixture,id,at} from '@/features/carrier-portal/commercial-test-fixtures';
import {emptyPreparation,prepareFromOffer,buildOffer,usdCents,quotedSummary,explicitInstant,canPrepareOffer,canChangeOffer,preparationKey,validateIssuedOffer} from './offers-model';
import {readOffersWorkspace,issueCarrierOffer,withdrawCarrierOffer,readPreparations,savePreparation} from './offers-client';
import {mutationReceipt} from '@/features/carrier-portal/api';
const signal=()=>new AbortController().signal;
const response=(data:unknown,meta:object={nextOffset:null})=>Response.json({schemaVersion:'2.0',data,meta});
const carrier={carrierId:id(1),operatorId:id(99),role:'ADMIN' as const,carrierName:'Test carrier',displayName:'Test operator'};
test('USD arithmetic uses cents; included and uncertain costs never inflate the quoted total',()=>{
 assert.equal(usdCents('0.10')+usdCents('0.20'),30);for(const raw of ['1.001','-1','1e3','NaN','1,000',''])assert.throws(()=>usdCents(raw));
 const f=prepareFromOffer(offer()),cost=f.breakdown[0];f.price='90.00';f.breakdown.push({...cost,kind:'DISCOUNT',amount:'10.00'},{...cost,treatment:'INCLUDED',amount:'25.00'},{...cost,treatment:'ESTIMATED',amount:'2.00'},{...cost,treatment:'UNKNOWN',amount:''});
 assert.equal(quotedSummary(f)?.quoted,9000);assert.equal(buildOffer(opportunity(),[id(6)],null,f,at).price.amount,90);
 f.price='115.00';assert.throws(()=>buildOffer(opportunity(),[id(6)],null,f,at));
});
test('empty preparations remain incomplete and issuance validates evidence and explicit offsets',()=>{
 const f=emptyPreparation('Test carrier');assert.equal(f.price,'');assert.equal(f.validFrom,'');assert.equal(f.capacityWeight,'');assert.throws(()=>buildOffer(opportunity(),[id(6)],null,f,at));
 assert.throws(()=>explicitInstant('2026-10-15T12:00:00'));assert.equal(Date.parse(explicitInstant('2026-10-15T07:00:00-05:00')),Date.parse(at));
 const complete=prepareFromOffer(offer());complete.validUntil=complete.validFrom;assert.throws(()=>buildOffer(opportunity(),[id(6)],null,complete,at));
 complete.validUntil='2026-10-20T00:00:00Z';complete.estimatedPickupAt='2026-10-19T00:00:00Z';complete.estimatedDeliveryAt='2026-10-18T00:00:00Z';assert.throws(()=>buildOffer(opportunity(),[id(6)],null,complete,at));
});
test('partial leg mapping, manual provenance and exact opportunity correlation are enforced',()=>{
 const f=prepareFromOffer(offer()),body=buildOffer(opportunity(),[id(6)],null,f,at);
 assert.equal(body.source.channel,'MANUAL');assert.equal(body.reservableCapacity,null);assert.equal(body.planCandidateId,id(4));assert.deepEqual(body.coveredServiceIds,[id(5)]);
 assert.throws(()=>buildOffer(opportunity(),[id(8)],null,f,at));assert.throws(()=>validateIssuedOffer({...offer(),organizationId:id(55)},opportunity(),body));
});
test('roles, deadlines, partial reads and existing commitments restrict actions',()=>{
 const o=opportunity(),f=offer(),snap=fixture();assert.equal(canPrepareOffer(o,'ADMIN',Date.parse(at)),true);assert.equal(canPrepareOffer(o,'OPERATOR',Date.parse(at)),true);assert.equal(canPrepareOffer(o,'DISPATCHER',Date.parse(at)),false);
 assert.equal(canPrepareOffer(o,'ADMIN',Date.parse('2030-01-01')),false);
 assert.equal(canChangeOffer(f,o,snap,'ADMIN',Date.parse(at),true),true);assert.equal(canChangeOffer(f,o,{...snap,partial:true},'ADMIN',Date.parse(at)),false);
 const committed={...snap,bookings:[{...snap.opportunities[0],kind:'bookings',data:{offerId:f.id}}]} as never;assert.equal(canChangeOffer(f,o,committed,'ADMIN',Date.parse(at),true),false);
});
test('preparation memory keys are isolated by operator, Carrier, opportunity and replaced offer',()=>{
 const key=preparationKey(id(1),id(2),id(3),null);for(const next of [preparationKey(id(5),id(2),id(3),null),preparationKey(id(1),id(5),id(3),null),preparationKey(id(1),id(2),id(5),null),preparationKey(id(1),id(2),id(3),id(5))])assert.notEqual(next,key);
});
test('workspace reads only native Carrier endpoints; empty, partial and denied reads never use examples',async()=>{
 const empty=await readOffersWorkspace(id(1),signal(),async path=>{assert.match(String(path),/^\/api\/v2\/carriers\//);assert.ok(!String(path).includes('/freight/'));return response([]);});assert.equal(empty.offers.length,0);
 const partial=await readOffersWorkspace(id(1),signal(),async()=>response([],{partial:true,nextOffset:null}));assert.equal(partial.partial,true);
 await assert.rejects(readOffersWorkspace(id(1),signal(),async()=>Response.json({error:{code:'FORBIDDEN'}},{status:403})),{status:403});
});
test('late aborted read is discarded even when transport ignores cancellation',async()=>{
 const c=new AbortController();c.abort();await assert.rejects(readOffersWorkspace(id(1),c.signal,async()=>response([])),error=>(error as Error).name==='AbortError');
});
test('stable issuance key permits identical retry; changed commercial input receives a new key',async()=>{
 const body=buildOffer(opportunity(),[id(6)],null,prepareFromOffer(offer()),at),path='/issue';const a=mutationReceipt(null,path,body,()=>id(90));assert.equal(mutationReceipt(a,path,body,()=>id(91)).key,id(90));assert.equal(mutationReceipt(a,path,{...body,carrierReference:'Changed'},()=>id(91)).key,id(91));
 let calls=0;const fake:typeof fetch=async(url,init)=>{calls++;assert.ok(String(url).endsWith('/opportunities/'+id(10)+'/offers'));assert.equal(new Headers(init?.headers).get('Idempotency-Key'),id(90));assert.deepEqual(JSON.parse(String(init?.body)),body);return response(offer());};
 assert.equal((await issueCarrierOffer(carrier,opportunity(),body,id(90),signal(),fake)).id,id(11));assert.equal((await issueCarrierOffer(carrier,opportunity(),body,id(90),signal(),fake)).id,id(11));assert.equal(calls,2);
});
test('wrong scope and adapter impersonation are rejected before issuance',async()=>{
 const body=buildOffer(opportunity(),[id(6)],null,prepareFromOffer(offer()),at),noFetch:typeof fetch=async()=>{assert.fail('must not send');};
 await assert.rejects(issueCarrierOffer({...carrier,role:'DISPATCHER'},opportunity(),body,id(90),signal(),noFetch));
 await assert.rejects(issueCarrierOffer(carrier,opportunity(),{...body,planCandidateId:id(80)},id(90),signal(),noFetch));
 await assert.rejects(issueCarrierOffer(carrier,opportunity(),{...body,source:{...body.source,channel:'API'}},id(90),signal(),noFetch));
 await assert.rejects(issueCarrierOffer(carrier,opportunity(),body,id(90),signal(),async()=>response({...offer(),data:{...offer().data,source:{...offer().data.source,issuerId:id(80)}}})),/INVALID_OFFER_ISSUER/);
});
test('withdrawal sends the exact version and handles stale conflicts without emitting or replacing',async()=>{
 const row=offer(),body={schemaVersion:'2.0',expectedVersion:row.version,note:'Withdraw quote',evidence:row.data.source.evidence};
 await assert.rejects(withdrawCarrierOffer(carrier,row,body,id(90),signal(),async(path,init)=>{assert.ok(String(path).endsWith('/offers/'+row.id+'/withdrawals'));assert.deepEqual(JSON.parse(String(init?.body)),body);return Response.json({error:{code:'STALE_DRAFT'}},{status:409});}),/STALE_DRAFT/);
 const saved=await withdrawCarrierOffer(carrier,row,body,id(90),signal(),async()=>response({...row,status:'WITHDRAWN',version:2,data:{...row.data,status:'WITHDRAWN'}}));assert.equal(saved.status,'WITHDRAWN');
});
test('replacement is one issue call and preserves the chain, never withdrawal then creation',async()=>{
 const old=offer(),o=opportunity(),body=buildOffer(o,[id(6)],old,prepareFromOffer(old),at);let calls=0;
 const saved=await issueCarrierOffer(carrier,o,body,id(90),signal(),async(path,init)=>{calls++;assert.ok(!String(path).includes('withdrawals'));assert.equal(JSON.parse(String(init?.body)).supersedesOfferId,old.id);return response({...old,id:id(12),data:{...old.data,id:id(12),supersedesOfferId:old.id,offerVersion:2}});});assert.equal(calls,1);assert.equal(saved.data.offerVersion,2);
});
test('preparation is saved through a separate API with expected version; missing persistence is explicit',async()=>{
 const value={schemaVersion:'2.0' as const,opportunityId:id(10),assignmentIds:[id(6)],supersedesOfferId:null,fields:emptyPreparation()},record={id:id(40),carrierId:id(1),operatorId:id(99),userId:id(98),organizationId:id(2),requestId:id(3),version:1,updatedAt:at,value};
 const saved=await savePreparation(carrier,value,0,id(90),signal(),async(path,init)=>{assert.ok(String(path).endsWith('/offer-preparations'));assert.equal(JSON.parse(String(init?.body)).expectedVersion,0);assert.equal(JSON.parse(String(init?.body)).value.fields.price,'');return response(record);});assert.equal(saved.version,1);
 await assert.rejects(readPreparations(carrier,signal(),async()=>Response.json({error:{code:'OFFER_PREPARATIONS_NOT_INSTALLED'}},{status:503})),/OFFER_PREPARATIONS_NOT_INSTALLED/);
 await assert.rejects(readPreparations(carrier,signal(),async()=>response([{...record,operatorId:id(80)}])),/INVALID_PREPARATION_SCOPE/);
});
