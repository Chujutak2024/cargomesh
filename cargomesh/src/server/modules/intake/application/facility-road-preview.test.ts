import test from 'node:test';
import assert from 'node:assert/strict';
import {createFacilityRoadPreview} from './facility-road-preview';
import type {FacilityRecord} from './get-intake-options';
import type {RoadCalculation} from '@/features/road-route-lab/contract';
const actor={memberId:'11000000-0000-4000-8000-000000000001',organizationId:'22000000-0000-4000-8000-000000000001'};
const a='33000000-0000-4000-8000-000000000001',b='33000000-0000-4000-8000-000000000002';
function facilities():FacilityRecord[]{return [
 {id:a,organization_id:actor.organizationId,code:'SYDNEY',name:'Sydney',country_code:'AU',region_code:null,city:'Sydney',latitude:-33.87,longitude:151.21,active:true},
 {id:b,organization_id:actor.organizationId,code:'MELBOURNE',name:'Melbourne',country_code:'AU',region_code:null,city:'Melbourne',latitude:-37.81,longitude:144.96,active:true},
];}
const query={originId:a,destinationId:b};
function estimate():RoadCalculation{return {status:'estimated',source:'GOOGLE_ROUTES_API',calculatedAt:'2026-10-23T12:00:00Z',policyVersion:'returned-road-alternatives/v1',scope:'RETURNED_ALTERNATIVES_ONLY',truckAccess:'UNVERIFIED',objective:'FASTEST',traffic:'TRAFFIC_UNAWARE',selectedId:'google-0',rejected:[],alternatives:[{id:'google-0',providerIndex:0,distanceMeters:1000000,durationSeconds:36000,points:[{lat:-33.87,lng:151.21},{lat:-37.81,lng:144.96}],warnings:[]}]};}
test('Sydney/Buenos Aires is blocked in both directions without any paid provider request',async()=>{
 let paid=0;const rows=facilities();Object.assign(rows[1],{country_code:'AR',latitude:-34.6,longitude:-58.38,city:'Buenos Aires'});
 const read=createFacilityRoadPreview({provider:async()=>{paid++;return estimate();}}),repository={listActiveFacilities:async()=>rows};
 for(const raw of [query,{originId:b,destinationId:a}])assert.deepEqual((await read(actor,repository,raw)).data.result,{status:'blocked',reason:'DISCONNECTED_NETWORKS'});
 assert.equal(paid,0);
});
test('authorization and coordinates are checked before routing; no client organization or points accepted',async()=>{
 let paid=0;const read=createFacilityRoadPreview({provider:async()=>{paid++;return estimate();}}),rows=facilities(),repo={listActiveFacilities:async()=>rows};
 await assert.rejects(read(actor,repo,{...query,organizationId:actor.organizationId}));
 await assert.rejects(read(actor,repo,{...query,origin:{lat:0,lng:0}}));
 await assert.rejects(read(actor,{listActiveFacilities:async()=>[rows[0]]},query),/authorized facilities/);
 await assert.rejects(read(actor,{listActiveFacilities:async()=>[{...rows[0],organization_id:'other'}]},query),/scope mismatch/);
 rows[0].latitude=null;assert.equal((await read(actor,repo,query)).data.result.status,'unavailable');assert.equal(paid,0);
});
test('same-direction calls deduplicate and cache, while reverse and edited coordinates recalculate',async()=>{
 let paid=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),rows=facilities(),repository={listActiveFacilities:async()=>rows};
 const read=createFacilityRoadPreview({provider:async()=>{paid++;await gate;return estimate();}});
 const first=read(actor,repository,query),second=read(actor,repository,query);release();
 await Promise.all([first,second]);assert.equal(paid,1);
 assert.equal((await read(actor,repository,query)).data.result.status,'estimated');assert.equal(paid,1);
 await read(actor,repository,{originId:b,destinationId:a});assert.equal(paid,2);
 rows[0].latitude=-33.86;await read(actor,repository,query);assert.equal(paid,3);
 await assert.rejects(read(actor,{listActiveFacilities:async()=>[]},query),/authorized facilities/);assert.equal(paid,3);
});
test('cache expires and another organization never inherits its geometry',async()=>{
 let paid=0,now=0;const rows=facilities(),read=createFacilityRoadPreview({now:()=>now,provider:async()=>{paid++;return estimate();}}),repository={listActiveFacilities:async()=>rows};
 await read(actor,repository,query);now=300001;await read(actor,repository,query);assert.equal(paid,2);
 const other={...actor,organizationId:'22000000-0000-4000-8000-000000000002'};
 await read(other,{listActiveFacilities:async()=>rows.map(row=>({...row,organization_id:other.organizationId}))},query);assert.equal(paid,3);
});
test('provider no-route has no invented geometry and transient failures are not cached',async()=>{
 let paid=0;const read=createFacilityRoadPreview({provider:async()=>{paid++;return {status:'unavailable',reason:paid===1?'NO_ROUTE':'PROVIDER_UNAVAILABLE',alternatives:[]};}}),repository={listActiveFacilities:async()=>facilities()};
 assert.deepEqual((await read(actor,repository,query)).data.result,{status:'blocked',reason:'NO_ROUTE'});
 assert.deepEqual((await read(actor,repository,query)).data.result,{status:'unavailable',reason:'PROVIDER_UNAVAILABLE'});
 assert.equal(paid,2);
});
