import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FacilityVisualService,type FacilityVisualRepository} from './facility-visual-service';
const actor={organizationId:'50f00000-0000-4000-8000-000000000001',memberId:'50f20000-0000-4000-8000-000000000001',role:'OWNER'};
const id='50f10000-0000-4000-8000-000000000001',key='50ff0000-0000-4000-8000-000000000001';
function response(overrides={}){return {schemaVersion:'2.0',data:{organizationId:actor.organizationId,facilityId:id,templateId:null,version:0,updatedAt:null,...overrides},meta:{idempotentReplay:false}};}
test('unassigned authorized facility remains unassigned; reads do not mutate',async()=>{
 let input:unknown;const service=new FacilityVisualService({async command(a,f,v){assert.deepEqual(a,actor);assert.equal(f,id);input=v;return response();}});
 assert.equal((await service.get(actor,id)).data.version,0);assert.equal(input,null);
});
test('save carries exact actor, explicit model, version and replay key; clearing is explicit',async()=>{
 let calls=0;const repository:FacilityVisualRepository={async command(a,f,input){calls++;assert.equal(a,actor);assert.equal(f,id);
 assert.deepEqual(input,{templateId:calls===1?'retail-store':null,expectedVersion:calls-1,key});return response({templateId:input!.templateId,version:calls,updatedAt:'2026-10-20T15:00:00Z'});}};
 const service=new FacilityVisualService(repository);assert.equal((await service.save(actor,id,{templateId:'retail-store',expectedVersion:0},key)).data.templateId,'retail-store');
 assert.equal((await service.save(actor,id,{templateId:null,expectedVersion:1},key)).data.templateId,null);
});
test('Requester cannot save; unknown design, stale-shape versions and supplied tenant are rejected before repository',async()=>{
 let calls=0;const service=new FacilityVisualService({async command(){calls++;return response();}});
 await assert.rejects(()=>service.save({...actor,role:'REQUESTER'},id,{templateId:'compact',expectedVersion:0},key),{code:'FORBIDDEN_TENANT'});
 for(const input of [{templateId:'invented',expectedVersion:0},{templateId:'compact',expectedVersion:-1},{templateId:'compact',expectedVersion:0,organizationId:actor.organizationId}])await assert.rejects(()=>service.save(actor,id,input,key));
 assert.equal(calls,0);
});
test('foreign organization or facility returned by adapter cannot become a successful response',async()=>{
 for(const changes of [{organizationId:'50f00000-0000-4000-8000-000000000002'},{facilityId:'50f10000-0000-4000-8000-000000000002'}]){
  const service=new FacilityVisualService({async command(){return response(changes);}});
  await assert.rejects(()=>service.get(actor,id),{code:'FORBIDDEN_TENANT'});
 }
});
test('native repository conflicts propagate without inventing successful state',async()=>{
 const conflict=Object.assign(new Error('changed'),{code:'STALE_DRAFT'});
 const service=new FacilityVisualService({async command(){throw conflict;}});
 await assert.rejects(()=>service.save(actor,id,{templateId:'compact',expectedVersion:0},key),e=>e===conflict);
});
