import test from 'node:test';
import assert from 'node:assert/strict';
import type { FacilityV2 } from '@/shared/schemas/v2/facilities';
import { resolveFacilityVisual, createFacilityVisualCoordinator, createFacilityEndpointState, facilityVisualController, type FacilityVisualBinding } from './facility-visual';
import { depotTemplates } from './depot-templates';

const organizationId='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001';
const facility:FacilityV2={id,organizationId,version:1,createdAt:'2026-10-19T00:00:00Z',updatedAt:'2026-10-19T00:00:00Z',value:{schemaVersion:'2.0',code:'TEST',name:'Contract fixture',facilityType:'SHIPPER_SITE',active:false,accessRestrictions:[],operatingHours:null,location:{label:'Public place',countryCode:'PE',city:'Lima',region:null,lat:null,lng:null}}};
const input={organizationId,location:{...facility.value.location,facilityId:id,lat:-12.1,lng:-77.1},usage:'PICKUP' as const,facilities:[facility],references:[{organizationId,facilityId:id,templateId:'industrial-plant'}] as FacilityVisualBinding[]};

test('organization, recorded function, endpoint usage and architecture are independent; the pin never moves',()=>{
  const before=JSON.stringify(input);
  for(const template of depotTemplates)for(const usage of ['PICKUP','DELIVERY',null] as const){
    const result=resolveFacilityVisual({...input,usage,references:[{...input.references[0],templateId:template.id}]});
    assert.ok(result);assert.equal(result.organizationId,organizationId);assert.equal(result.function,'SHIPPER_SITE');assert.equal(result.usage,usage);assert.equal(result.templateId,template.id);
    assert.deepEqual(result.location,input.location);assert.equal('active' in result,false);assert.equal('capacity' in result,false);
  }
  assert.equal(JSON.stringify(input),before);
});
test('missing, foreign, duplicate, invalid and unimplemented visual bindings fail closed without inferring from facility type',()=>{
  for(const values of [
    {...input,references:[]},{...input,facilities:[]},{...input,organizationId:'30000000-0000-4000-8000-000000000001'},
    {...input,location:{...input.location,facilityId:null}}, {...input,references:[...input.references,...input.references]},
    {...input,facilities:[facility,facility]}, {...input,references:[{...input.references[0],templateId:'new-unknown'}] as unknown as FacilityVisualBinding[]},
    {...input,references:[{...input.references[0],capacity:8000}]}, {...input,facilities:[{...facility,version:0}]},
  ]) assert.equal(resolveFacilityVisual(values),null);
});
test('facility references have no simulated fleet or events and retain independent cameras, selection, clock and pause',()=>{
  const reference=resolveFacilityVisual(input)!;const controller=createFacilityVisualCoordinator(reference),state=createFacilityEndpointState();
  state.controllers.set(id,controller);state.usage='DELIVERY';
  const camera={position:[-20,25,30] as [number,number,number],target:[0,0,1] as [number,number,number],zoom:17,guided:false,focusKey:'manual'};
  controller.rememberCamera(camera);controller.setInterior(true);controller.advance(2000);
  const snapshot=controller.getSnapshot();assert.equal(snapshot.templateId,'industrial-plant');assert.deepEqual(snapshot.vehicles,[]);assert.deepEqual(snapshot.eventIds,[]);
  assert.equal(snapshot.selectedAssetId,null);assert.equal(snapshot.requestedPlay,false);assert.equal(controller.getElapsedMs(),0);
  assert.equal(state.usage,'DELIVERY');assert.strictEqual(state.controllers.get(id),controller);assert.deepEqual(controller.getCamera(),camera);
});
test('pickup and delivery at the same facility retain separate camera and interior states',()=>{
  const state=createFacilityEndpointState(),pickup=resolveFacilityVisual(input)!,delivery=resolveFacilityVisual({...input,usage:'DELIVERY'})!;
  const a=facilityVisualController(state.controllers,pickup),b=facilityVisualController(state.controllers,delivery);
  assert.notEqual(a.key,b.key);assert.notStrictEqual(a.controller,b.controller);
  a.controller.setInterior(true);a.controller.rememberCamera({position:[-20,25,30],target:[0,0,1],zoom:35,guided:false,focusKey:'manual'});
  assert.equal(b.controller.getSnapshot().interior,false);assert.equal(b.controller.getCamera(),null);
  assert.strictEqual(facilityVisualController(state.controllers,pickup).controller,a.controller);
  assert.equal(a.controller.getCamera()?.zoom,35);assert.equal(state.controllers.size,2);
});
