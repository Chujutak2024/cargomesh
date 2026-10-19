import test from 'node:test';
import assert from 'node:assert/strict';
import {fleetContext} from './connected-fleet-state';
import type {ConnectedFleetSnapshot} from '@/features/carrier-portal/connected-fleet-presentation';
const carrierId='10000000-0000-4000-8000-000000000001',serviceId='20000000-0000-4000-8000-000000000002';
const grant={carrierId,operatorId:serviceId,carrierName:'Authorized Carrier',displayName:'Operator',role:'ADMIN' as const};
function snapshot():ConnectedFleetSnapshot{return {carrierId,services:[{id:serviceId,carrierId,version:1,updatedAt:'2026-10-17T00:00:00Z',value:{mode:'ROAD',status:'ACTIVE'}}],assets:[],drivers:[],depots:[],partners:[],partial:false,visualGaps:[],operational:{'vehicle-assignments':[],'driver-assignments':[],executions:[],maintenances:[]},readAt:'2026-10-17T00:00:00Z'};}
test('a complete active service and ADMIN grant permit additions',()=>assert.equal(fleetContext([grant],carrierId,serviceId,snapshot()).canWrite,true));
test('no grant or a previous Carrier snapshot cannot expose a writable catalog',()=>{
 for(const args of [[[],carrierId,serviceId,snapshot()],[[grant],serviceId,serviceId,snapshot()]] as const){const state=fleetContext([...args[0]],args[1],args[2],args[3]);assert.equal(state.current,null);assert.equal(state.canWrite,false);}
 const old=snapshot();old.carrierId=serviceId;assert.equal(fleetContext([grant],carrierId,serviceId,old).current,null);
});
test('partial catalogs, non-admin grants, missing services and inactive services cannot write',()=>{
 const partial=snapshot();partial.partial=true;assert.equal(fleetContext([grant],carrierId,serviceId,partial).canWrite,false);
 assert.equal(fleetContext([{...grant,role:'OPERATOR'}],carrierId,serviceId,snapshot()).canWrite,false);
 assert.equal(fleetContext([grant],carrierId,carrierId,snapshot()).canWrite,false);
 const inactive=snapshot();inactive.services[0].value={mode:'ROAD',status:'INACTIVE'};assert.equal(fleetContext([grant],carrierId,serviceId,inactive).canWrite,false);
});
