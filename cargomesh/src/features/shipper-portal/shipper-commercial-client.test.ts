import {it} from 'node:test';import assert from 'node:assert/strict';
import {refreshRequestCommercial} from './shipper-commercial-client';
import {demoRequests} from '@/features/shipper-demo-preview/demo-data';
import {catalogRecord,commercialFixture,carrier,service,id} from './commercial-context.test-fixtures';
const row=demoRequests[0],signal=new AbortController().signal;
it('refresh reads the exact customer request and correlated collections without writes',async()=>{const paths:string[]=[];const mock=(async(url,init)=>{paths.push(String(url));assert.equal(init?.cache,'no-store');assert.equal(init?.credentials,'same-origin');assert.ok(!init?.method||init.method==='GET');return Response.json({schemaVersion:'2.0',data:String(url).includes('?')?[]:row,meta:String(url).includes('?')?{nextOffset:null}:{idempotentReplay:false,environmentProfile:'v2-clean'}});}) as typeof fetch;const fresh=await refreshRequestCommercial(row.id,row.organizationId,signal,mock);assert.equal(fresh.request.id,row.id);assert.deepEqual(Object.keys(fresh.workflow).sort(),['bookings','decisions','executions','holds','offers','opportunities','plans','ranking','routes']);assert.equal(paths.length,8);assert.ok(paths.every(p=>p.startsWith('/api/v2/freight/requests/'+row.id)));assert.deepEqual(fresh.catalog,{carriers:{},services:{}});});
it('scope mismatch in the refreshed request prevents commercial queries',async()=>{let reads=0;await assert.rejects(refreshRequestCommercial(row.id,'aa500000-0000-4000-8000-000000000099',signal,(async()=>{reads++;return Response.json({schemaVersion:'2.0',data:row,meta:{idempotentReplay:false,environmentProfile:'v2-clean'}});}) as typeof fetch),{code:'INVALID_SCOPE'});assert.equal(reads,1);});
it('repeated pagination and a denied session cannot become an empty success',async()=>{const mock=(async(url)=>Response.json({schemaVersion:'2.0',data:String(url).includes('?')?[]:row,meta:String(url).includes('?')?{nextOffset:0}:{idempotentReplay:false,environmentProfile:'v2-clean'}})) as typeof fetch;await assert.rejects(refreshRequestCommercial(row.id,row.organizationId,signal,mock),{code:'INVALID_RESPONSE'});await assert.rejects(refreshRequestCommercial(row.id,row.organizationId,signal,(async()=>Response.json({error:{code:'UNAUTHORIZED'}},{status:401})) as typeof fetch),{status:401});});
it('aborted requests stay cancelled and do not replace the current view',async()=>{await assert.rejects(refreshRequestCommercial(row.id,row.organizationId,signal,(async()=>{throw new DOMException('Cancelled','AbortError');}) as typeof fetch),{name:'AbortError'});});
it('hydrates actual Carrier identity and service through authorized native reads',async()=>{
 const context=commercialFixture(),paths:string[]=[];
 const mock=(async(url,init)=>{const path=String(url);paths.push(path);assert.equal(init?.credentials,'same-origin');
  if(path.startsWith('/api/v2/carriers/'))return Response.json({schemaVersion:'2.0',data:catalogRecord(path.includes('/services/')?'services':'carriers')});
  const kind=path.split('?')[0].split('/').at(-1)!;
  const workflow:Record<string,unknown[]>={plans:context.plans,opportunities:context.opportunities,offers:context.offers,ranking:[context.ranking!]};
  return Response.json({schemaVersion:'2.0',data:path.includes('?')?workflow[kind]??[]:context.request,meta:path.includes('?')?{nextOffset:null}:{idempotentReplay:false,environmentProfile:'v2-clean'}});
 }) as typeof fetch;
 const fresh=await refreshRequestCommercial(context.request.id,context.request.organizationId,signal,mock);
 assert.equal(fresh.catalog.carriers[carrier].name,'Contract-test logistics');assert.equal(fresh.catalog.services[service].serviceClass,'FTL');
 assert.ok(paths.includes(`/api/v2/carriers/${carrier}`));assert.ok(paths.includes(`/api/v2/carriers/${carrier}/services/${service}`));assert.equal(paths.length,10);
});
it('missing pagination metadata, non-JSON failure and wrong collection scope stay failures',async()=>{
 for(const mode of ['missing-meta','wrong-scope','non-json'] as const){
  const mock=(async(url)=>{if(!String(url).includes('?'))return Response.json({schemaVersion:'2.0',data:row,meta:{idempotentReplay:false,environmentProfile:'v2-clean'}});
   if(mode==='non-json')return new Response('temporarily unavailable',{status:503});
   const offer=commercialFixture().offers[0];offer.requestId=id(90);
   return Response.json({schemaVersion:'2.0',data:mode==='wrong-scope'?[offer]:[],meta:mode==='missing-meta'?{}:{nextOffset:null}});
  }) as typeof fetch;
  await assert.rejects(refreshRequestCommercial(row.id,row.organizationId,signal,mock));
 }
});
it('reads all native pages but rejects duplicate records across pages',async()=>{
 const context=commercialFixture();
 for(const duplicate of [false,true]){
  const mock=(async(url)=>{const path=String(url);if(path.startsWith('/api/v2/carriers/'))return Response.json({schemaVersion:'2.0',data:catalogRecord('carriers')});
   if(!path.includes('?'))return Response.json({schemaVersion:'2.0',data:context.request,meta:{idempotentReplay:false,environmentProfile:'v2-clean'}});
   const isOffer=path.includes('/offers?'),second=path.includes('offset=100');
   const offers=isOffer?Array.from({length:second?1:100},(_,n)=>{const f=structuredClone(context.offers[0]);f.id=id(second?(duplicate?100:200):100+n);f.data.id=f.id;return f;}):[];
   return Response.json({schemaVersion:'2.0',data:offers,meta:{nextOffset:isOffer&&!second?100:null}});
  }) as typeof fetch;
  if(duplicate)await assert.rejects(refreshRequestCommercial(context.request.id,context.request.organizationId,signal,mock),{code:'INVALID_SCOPE'});
  else assert.equal((await refreshRequestCommercial(context.request.id,context.request.organizationId,signal,mock)).workflow.offers.length,101);
 }
});
