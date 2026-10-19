import test from 'node:test';
import assert from 'node:assert/strict';
import {execution,booking,id,at,ev} from '@/features/carrier-portal/commercial-test-fixtures';
import {readIncidents,readIncidentCollection,readIncidentHistory,incidentPath,incidentFormSchema,validateIncidentSaved,ordersTab} from './incidents-client';
const e=execution();
const raw=(n=70)=>({id:id(n),carrierId:e.carrierId,organizationId:e.organizationId,requestId:e.requestId,version:1,kind:'incidents' as const,status:'OPEN',createdAt:at,updatedAt:at,data:{schemaVersion:'2.0',kind:'Delay',severity:'WARNING',occurredAt:at,location:null,description:'Controlled test incident',evidence:[ev],reportedBy:id(99),status:'OPEN'}});
const response=(data:unknown,meta:unknown={nextOffset:null})=>new Response(JSON.stringify({schemaVersion:'2.0',data,meta}),{status:200});
test('Orders and Incidents routes retain canonical and legacy names',()=>{
 assert.equal(ordersTab('#/tracking/incidents'),'incidents');assert.equal(ordersTab('#/orders/incidents'),'incidents');assert.equal(ordersTab('#/tracking/details/'+id(12)),'orders');
});
test('incident collections paginate within the operation and preserve partial reads',async()=>{
 const paths:string[]=[];const fetcher:typeof fetch=async path=>{paths.push(String(path));return paths.length===1?response([raw()],{nextOffset:100}):response([raw(71)],{nextOffset:null,partial:true});};
 const result=await readIncidentCollection(id(1),e,new AbortController().signal,fetcher);
 assert.equal(result.records.length,2);assert.equal(result.partial,true);assert.ok(paths[1].endsWith('offset=100'));assert.ok(paths[0].includes('/executions/'+e.id+'/incidents'));
});
test('cross-Carrier, organization, request and conflicting incident state responses fail closed',async()=>{
 for(const patch of [{carrierId:id(80)},{organizationId:id(80)},{requestId:id(80)},{status:'RESOLVED'}]){
  await assert.rejects(()=>readIncidentCollection(id(1),e,new AbortController().signal,async()=>response([{...raw(),...patch}])),/INVALID_INCIDENT_SCOPE/);
 }
 assert.throws(()=>incidentPath(id(80),e),/INVALID_INCIDENT_SCOPE/);
});
test('duplicate records and repeated pagination offsets are rejected',async()=>{
 await assert.rejects(()=>readIncidentCollection(id(1),e,new AbortController().signal,async()=>response([raw(),raw()])),/INVALID_RESPONSE/);
 await assert.rejects(()=>readIncidentCollection(id(1),e,new AbortController().signal,async()=>response([],{nextOffset:0})),/INVALID_RESPONSE/);
});
test('incident commands use a flat expected version and validate returned identity/state',async()=>{
 const record=validateIncidentSaved(raw(),e),entry={record,execution:e,booking:null};
 const value=incidentFormSchema(entry,'RESOLVE').parse({schemaVersion:'2.0',note:'Controlled resolution',evidence:ev});
 assert.equal('expectedVersion' in value&&value.expectedVersion,1);assert.equal('action' in value&&value.action,'RESOLVE');assert.equal('value' in value,false);
 const resolved={...raw(),version:2,status:'RESOLVED',data:{...raw().data,status:'RESOLVED'}};
 assert.equal(validateIncidentSaved(resolved,e,record,'RESOLVE').status,'RESOLVED');
 for(const invalid of [{...resolved,version:1},{...resolved,id:id(72)},raw()])assert.throws(()=>validateIncidentSaved(invalid,e,record,'RESOLVE'));
 const history=await readIncidentHistory(id(1),entry,new AbortController().signal,async()=>response([]));assert.equal(history.records.length,0);
});

test('aggregate incidents are linked through the actual operation booking, not just the request',async()=>{
 const fetcher:typeof fetch=async path=>{const url=String(path);if(url.includes('/incidents?'))return response([raw()]);if(url.includes('/executions?'))return response([e]);if(url.includes('/bookings?'))return response([booking()]);return response([]);};
 const snapshot=await readIncidents(id(1),new AbortController().signal,fetcher);
 assert.equal(snapshot.entries.length,1);assert.equal(snapshot.entries[0].booking?.id,booking().id);assert.equal(snapshot.partial,false);
});
test('a failed incident source is a partial read and a revoked grant rejects the whole index',async()=>{
 for(const status of [500,403]){
  const fetcher:typeof fetch=async path=>{const url=String(path);if(url.includes('/incidents?'))return new Response(JSON.stringify({error:{code:status===403?'FORBIDDEN':'UNAVAILABLE'}}),{status});if(url.includes('/executions?'))return response([e]);return response([]);};
  if(status===403)await assert.rejects(()=>readIncidents(id(1),new AbortController().signal,fetcher));
  else{const snapshot=await readIncidents(id(1),new AbortController().signal,fetcher);assert.equal(snapshot.partial,true);assert.equal(snapshot.entries.length,0);assert.equal(snapshot.issues.length,1);}
 }
});
test('history rejects foreign incident updates and response parent mismatches',async()=>{
 const record=validateIncidentSaved(raw(),e),entry={record,execution:e,booking:null};
 const update={...raw(),kind:'incident-updates',status:'RECORDED',organizationId:id(88),data:{schemaVersion:'2.0',expectedVersion:1,note:'Controlled note',evidence:ev,action:'NOTE',at,actorId:id(99)}};
 await assert.rejects(()=>readIncidentHistory(id(1),entry,new AbortController().signal,async()=>response([update])),/INVALID_INCIDENT_SCOPE/);
 await assert.rejects(()=>readIncidentCollection(id(1),e,new AbortController().signal,async()=>response([{...raw(),data:{...raw().data,executionId:id(88)}}])),/INVALID_INCIDENT_SCOPE/);
});
