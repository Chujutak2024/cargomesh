import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunity,carrier,at,ev,id} from '@/features/carrier-portal/commercial-test-fixtures';
import {readOpportunities,respondOpportunity} from './opportunity-client';
import {mutationReceipt} from '@/features/carrier-portal/api';
const ok=(data:unknown)=>Response.json({schemaVersion:'2.0',data,meta:{nextOffset:null}});
const options=()=>({carrierId:carrier,role:'ADMIN' as const,row:opportunity(),response:'ACCEPTED' as const,note:'Review only, not a booking',evidence:ev,key:id(90),signal:new AbortController().signal});
test('inbox reads only scoped Carrier opportunities, including a valid empty inbox',async()=>{
 const rows=await readOpportunities(carrier,new AbortController().signal,async(path)=>{assert.match(String(path),/^\/api\/v2\/carriers\/.+\/opportunities\?/);assert.ok(!String(path).includes('/freight/requests'));return ok([opportunity()]);});assert.equal(rows.rows[0].id,id(10));
 assert.deepEqual((await readOpportunities(carrier,new AbortController().signal,async()=>ok([]))).rows,[]);
});
test('foreign records and denied reads fail instead of falling back to local requests',async()=>{
 await assert.rejects(readOpportunities(carrier,new AbortController().signal,async()=>ok([{...opportunity(),carrierId:id(99)}])));
 await assert.rejects(readOpportunities(carrier,new AbortController().signal,async()=>Response.json({error:{code:'FORBIDDEN'}},{status:403})),/FORBIDDEN/);
});
test('an explicit response preserves expectedVersion and audit evidence and never edits customer data',async()=>{
 const input=options();input.row.version=7;
 const saved=await respondOpportunity(input,async(path,init)=>{
  assert.equal(path,`/api/v2/carriers/${carrier}/opportunities/${input.row.id}/responses`);assert.equal(init?.method,'POST');assert.equal(new Headers(init?.headers).get('Idempotency-Key'),input.key);
  assert.deepEqual(JSON.parse(String(init?.body)),{schemaVersion:'2.0',expectedVersion:7,note:input.note,evidence:ev,response:'ACCEPTED'});
  return ok({...input.row,status:'ACCEPTED',version:8});
 },Date.parse(at));assert.equal(saved.version,8);assert.equal(saved.status,'ACCEPTED');
});
test('decline is an opportunity response, not a booking cancellation',async()=>{
 const input={...options(),response:'DECLINED' as const};
 const saved=await respondOpportunity(input,async(path)=>{assert.ok(String(path).endsWith('/responses'));return ok({...input.row,status:'DECLINED',version:2});},Date.parse(at));assert.equal(saved.status,'DECLINED');
});
test('expired, forbidden-role and cross-Carrier actions cannot send a request',async()=>{
 const noFetch:typeof fetch=async()=>{assert.fail('must not send');};
 await assert.rejects(respondOpportunity(options(),noFetch,Date.parse('2026-10-20T00:00:00Z')));
 await assert.rejects(respondOpportunity({...options(),role:'DISPATCHER'},noFetch,Date.parse(at)));
 await assert.rejects(respondOpportunity({...options(),carrierId:id(91)},noFetch,Date.parse(at)));
});
test('stale or foreign response results remain errors and identical retry receipts keep their key',async()=>{
 await assert.rejects(respondOpportunity(options(),async()=>Response.json({error:{code:'STALE_DRAFT'}},{status:409}),Date.parse(at)),/STALE_DRAFT/);
 await assert.rejects(respondOpportunity(options(),async()=>ok({...opportunity(),organizationId:id(92),status:'ACCEPTED'}),Date.parse(at)),/INVALID_COMMERCIAL_SCOPE/);
 const body={expectedVersion:1,response:'ACCEPTED'};const first=mutationReceipt(null,'response',body,()=>id(90));assert.equal(mutationReceipt(first,'response',body,()=>id(91)).key,first.key);assert.notEqual(mutationReceipt(first,'response',{...body,response:'DECLINED'},()=>id(91)).key,first.key);
});
