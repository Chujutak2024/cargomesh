import test from 'node:test';
import assert from 'node:assert/strict';
import {readFleetAccess,readConnectedFleet,roadAssets,saveConnectedVehicle} from './connected-fleet-client';
import {readFleetResource} from './fleet-client';
const carrier='10000000-0000-4000-8000-000000000001',service='20000000-0000-4000-8000-000000000002',id='30000000-0000-4000-8000-000000000003',key='40000000-0000-4000-8000-000000000004';
const value={schemaVersion:'2.0',serviceId:service,code:'TEST_UNIT',mode:'ROAD',equipmentType:'BOX_TRUCK',role:'LOAD_BEARING',usefulCapacityKg:1000,usableVolumeM3:null,operatingStatus:'OUT_OF_SERVICE',homeDepotId:null,provenance:'OWN',partnerId:null,evidence:'SIMULATED test',roadVehicle:{plate:'SYN-050',registrationCode:null,registeredAt:null,brand:null,model:null,variant:null,bodyType:'Box',usableDimensions:null,grossWeightLimitKg:null,odometerKm:null,conditionReason:null,axleConfig:null}};
const record={id,carrierId:carrier,organizationId:null,serviceId:service,version:2,createdAt:'2026-10-14T00:00:00Z',updatedAt:'2026-10-14T00:00:00Z',value};
const response=(data:unknown,status=200)=>Response.json(status===200?{schemaVersion:'2.0',data,meta:{nextOffset:null}}:data,{status});
test('fleet catalog reads use Carrier endpoints, never the shipper tenant routes',async()=>{
 const fetcher:typeof fetch=async(url)=>{assert.match(String(url),/^\/api\/v2\/carrier-portal\/carriers\//);return response([record]);};
 assert.equal((await readFleetResource(carrier,'assets',new AbortController().signal,fetcher)).records.length,1);
});
test('access is read from session and validates the complete grant list',async()=>{
 const fetcher:typeof fetch=async(url)=>{assert.equal(url,'/api/v2/carrier-portal/access');return response([{carrierId:carrier,operatorId:id,role:'ADMIN',carrierName:'Test',displayName:'Test operator'}]);};
 assert.equal((await readFleetAccess(new AbortController().signal,fetcher))[0].carrierId,carrier);
 await assert.rejects(readFleetAccess(new AbortController().signal,async()=>response([{carrierId:'wrong'}])),/INVALID_RESPONSE/);
});
test('a dependent denial fails the connected catalog without fixtures',async()=>{
 const fetcher:typeof fetch=async()=>response({error:{code:'FORBIDDEN'}},403);
 await assert.rejects(readConnectedFleet(carrier,new AbortController().signal,fetcher),/FORBIDDEN/);
});
test('vehicle projection is restricted to ROAD and the selected service',()=>{
 assert.deepEqual(roadAssets([record,{...record,id:key,value:{...value,mode:'RAIL'}},{...record,id:key,value:{...value,serviceId:id}}],service).map(r=>r.id),[id]);
 assert.deepEqual(roadAssets([],service),[]);
});
test('creation sends the canonical payload and supplied retry key',async()=>{
 const fetcher:typeof fetch=async(url,init)=>{assert.equal(url,'/api/v2/carrier-portal/carriers/'+carrier+'/assets');assert.equal(init?.method,'POST');assert.equal(new Headers(init?.headers).get('Idempotency-Key'),key);assert.deepEqual(JSON.parse(String(init?.body)),value);return response(record);};
 assert.equal((await saveConnectedVehicle({carrierId:carrier,serviceId:service,value,key,signal:new AbortController().signal},fetcher)).id,id);
});
test('revision preserves expectedVersion and every existing optional attribute',async()=>{
 const original={...value,roadVehicle:{...value.roadVehicle,usableDimensions:{length:100,width:200,height:300},axleConfig:'Recorded axle config'}};
 const fetcher:typeof fetch=async(url,init)=>{assert.ok(String(url).endsWith('/'+id+'/revisions'));assert.deepEqual(JSON.parse(String(init?.body)),{expectedVersion:2,value:original});return response({...record,version:3,value:original});};
 assert.equal((await saveConnectedVehicle({carrierId:carrier,serviceId:service,value:original,key,record:{...record,value:original},signal:new AbortController().signal},fetcher)).version,3);
});
test('mismatched carrier, service or non-road payload cannot send a mutation',async()=>{
 const noFetch:typeof fetch=async()=>{assert.fail('must not fetch');};
 for(const patch of [{serviceId:id},{record:{...record,carrierId:id}},{value:{...value,mode:'RAIL',roadVehicle:null}}])await assert.rejects(saveConnectedVehicle({carrierId:carrier,serviceId:service,value,key,signal:new AbortController().signal,...patch},noFetch));
});
test('foreign responses and stale server conflicts remain errors',async()=>{
 await assert.rejects(saveConnectedVehicle({carrierId:carrier,serviceId:service,value,key,signal:new AbortController().signal},async()=>response({...record,carrierId:id})),/INVALID_RESPONSE/);
 await assert.rejects(saveConnectedVehicle({carrierId:carrier,serviceId:service,value,key,record,signal:new AbortController().signal},async()=>response({error:{code:'STALE_DRAFT'}},409)),/STALE_DRAFT/);
});
