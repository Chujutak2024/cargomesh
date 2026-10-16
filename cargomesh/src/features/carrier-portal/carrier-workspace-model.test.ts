import test from 'node:test';
import assert from 'node:assert/strict';
import {carrierDemoMode,carrierResourceKeys,carrierWorkspaceView} from './carrier-workspace-model';
import {carrierNavigation} from '@/features/carrier-navigation/navigation-model';
import {readFleetResource} from './fleet-client';

const carrier='10000000-0000-4000-8000-000000000001',service='20000000-0000-4000-8000-000000000002',id='30000000-0000-4000-8000-000000000003';
const area={id,carrierId:carrier,serviceId:service,organizationId:null,version:1,createdAt:'2026-10-15T00:00:00Z',updatedAt:'2026-10-15T00:00:00Z',value:{schemaVersion:'2.0',role:'PICKUP',inclusion:'INCLUDE',geography:{granularity:'CITY',countryCode:'PE',region:null,city:'Lima',postalCode:null},source:'OWN',partnerId:null,evidence:'Synthetic coverage test',verifiedAt:null,validFrom:'2026-10-01T00:00:00Z',validUntil:'2026-11-01T00:00:00Z',active:true}};
const envelope=(data:unknown,nextOffset:number|null=null)=>Response.json({schemaVersion:'2.0',data,meta:{nextOffset}});

test('old edit links resolve to the Carrier inbox and no view requests customer drafts',()=>{
  assert.equal(carrierWorkspaceView('#/request/route'),'shipments');
  assert.equal(carrierWorkspaceView('#/tracking'),'orders');
  assert.equal(carrierWorkspaceView('#/orders'),'orders');
  assert.equal(carrierWorkspaceView('#/pipeline'),'pipeline');
  assert.equal(carrierWorkspaceView('#/fleet/service/carriers'),'sites');
  assert.deepEqual(carrierResourceKeys('shipments'),['opportunities']);
  assert.deepEqual(carrierResourceKeys('desk'),['offers']);
  assert.deepEqual(carrierResourceKeys('tracking'),['executions']);
});
test('demo requires an explicit exact query value and the server capability',()=>{
  for(const enabled of [true,false])for(const requested of [undefined,'true','0',['1'],'1'])assert.equal(carrierDemoMode(requested,enabled),enabled&&requested==='1');
});
test('connected menu has no customer editor or duplicate vehicle registration; demo retains both',()=>{
  const items=(demoMode:boolean)=>carrierNavigation({locale:'en',workspaceHref:'/v2-workspace',towerHref:'/v2-workspace#/tower',editRequest:true,demoMode}).flatMap(group=>group.items);
  assert.ok(!items(false).some(item=>item.id==='request'||item.id==='register'));
  assert.equal(items(false).find(item=>item.id==='desk')?.label,'Offers');
  assert.equal(items(false).find(item=>item.id==='orders')?.href,'/v2-workspace#/orders');
  assert.ok(items(false).some(item=>item.id==='pipeline'));
  assert.ok(!items(true).some(item=>item.id==='orders'||item.id==='pipeline'));
  assert.ok(items(true).some(item=>item.id==='request'));
});
test('service coverage is read using the authorized Carrier facade and checks scope',async()=>{
  const fetcher:typeof fetch=async url=>{assert.equal(String(url),`/api/v2/carrier-portal/carriers/${carrier}/services/${service}/areas?limit=100&offset=0`);return envelope([area]);};
  const signal=new AbortController().signal;
  assert.equal((await readFleetResource(carrier,'areas',signal,fetcher,service)).records.length,1);
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>envelope([{...area,serviceId:id}]),service),/INVALID_RESPONSE/);
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>envelope([{...area,carrierId:id}]),service),/INVALID_RESPONSE/);
});
test('missing parent scope never sends a request; failures cannot become an empty successful catalog',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>{assert.fail('must not fetch');}),/INVALID_API_PATH/);
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>Response.json({error:{code:'FORBIDDEN'}},{status:403}),service),/FORBIDDEN/);
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>envelope([{...area,value:{...area.value,geography:{countryCode:'PE'}}}]),service),/INVALID_RESPONSE/);
});
test('coverage pagination cannot repeat pages or duplicate records and marks bounded reads partial',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>envelope([area],0),service),/INVALID_RESPONSE/);
  let page=0;
  await assert.rejects(readFleetResource(carrier,'areas',signal,async()=>envelope([area],++page===1?100:null),service),/INVALID_RESPONSE/);
  let offset=0;
  const result=await readFleetResource(carrier,'areas',signal,async()=>envelope([],++offset*100),service);
  assert.equal(result.truncated,true);assert.equal(offset,10);
});
