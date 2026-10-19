import test from 'node:test';import assert from 'node:assert/strict';
import {RegularDriverService} from './regular-driver-service';
const id=(n:number)=>'a6000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actor={carrierId:id(1),operatorId:id(2)},assetId=id(3),serviceId=id(4),driverId=id(5),key=id(6);
const record={carrierId:actor.carrierId,assetId,serviceId,driverId,version:1,updatedAt:'2026-10-18T12:00:00Z'};
test('regular link reads validate carrier scope and bounded pagination',async()=>{
 let offset=-1;const service=new RegularDriverService({async run(a,i,v,k,o){offset=o;return {data:[record]};}});
 assert.equal((await service.execute(actor,null,undefined,undefined,100)).data instanceof Array,true);assert.equal(offset,100);
 await assert.rejects(()=>service.execute(actor,null,undefined,undefined,-1));
});
test('create/replace/clear carry expected version and idempotency identity',async()=>{
 const calls:unknown[]=[];const service=new RegularDriverService({async run(a,i,v,k){calls.push({a,i,v,k});return {data:{...record,driverId:(v as {driverId:string|null}).driverId},replay:true};}});
 const value={schemaVersion:'2.0',serviceId,driverId,expectedVersion:0};
 assert.equal((await service.execute(actor,assetId,value,key)).meta.idempotentReplay,true);
 await service.execute(actor,assetId,{...value,driverId:null,expectedVersion:1},key);
 assert.equal(calls.length,2);await assert.rejects(()=>service.execute(actor,assetId,{...value,expectedVersion:-1},key));
});
test('foreign or mismatched RPC response is rejected',async()=>{
 const service=new RegularDriverService({async run(){return {data:{...record,carrierId:id(99)}};}});
 await assert.rejects(()=>service.execute(actor,assetId,{schemaVersion:'2.0',serviceId,driverId,expectedVersion:0},key),/scope mismatch/);
});
