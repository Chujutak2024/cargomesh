import type {OfferPreparationRecord} from '@/shared/schemas/v2/offer-preparation';
import test from 'node:test';import assert from 'node:assert/strict';
import {PreparationService,preparationHash,type PreparationRepository,type PreparationActor} from './preparation-service';
import {opportunity,id,at} from '@/features/carrier-portal/commercial-test-fixtures';
import {emptyPreparation} from '@/features/carrier-juan/offers-model';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import {createOfferPreparationsRouter} from '@/server/hono/routes/offer-preparations';
const actor:PreparationActor={kind:'carrier',carrierId:id(1),operatorId:id(99),userId:id(98),organizationId:null};
const value={schemaVersion:'2.0' as const,opportunityId:id(10),assignmentIds:[id(6)],supersedesOfferId:null,fields:emptyPreparation()};
const record:OfferPreparationRecord={id:id(40),carrierId:id(1),operatorId:id(99),userId:id(98),organizationId:id(2),requestId:id(3),version:1,updatedAt:at,value};
const refs=async()=>({opportunity:opportunity(),supersedes:null});
function bank(){let current:OfferPreparationRecord|undefined;const receipts=new Map<string,{hash:string;record:OfferPreparationRecord}>();
 const repo:PreparationRepository={list:async actor=>current&&current.userId===actor.userId?[current]:[],save:async(actor,input)=>{
  const receipt=receipts.get(input.key);if(receipt){if(receipt.hash!==input.payloadHash)throw new V2DraftError('IDEMPOTENCY_CONFLICT','Changed',409);return {record:receipt.record,replay:true};}
  if(input.expectedVersion!==(current?.version??0))throw new V2DraftError('STALE_PREPARATION','Stale',409);
  current={...record,userId:actor.userId,version:input.expectedVersion+1,value:input.value};receipts.set(input.key,{hash:input.payloadHash,record:current});return {record:current,replay:false};}};return repo;}
test('saving incomplete commercial preparation is separate from issuance with stable SHA-256',async()=>{
 assert.equal(preparationHash({a:1,b:2}),preparationHash({b:2,a:1}));assert.match(preparationHash(value),/^[a-f0-9]{64}$/);
 const service=new PreparationService(bank(),refs),saved=await service.save(actor,{expectedVersion:0,value},id(80));assert.equal(saved.data.value.fields.price,'');assert.equal(saved.data.version,1);assert.equal(saved.meta.idempotentReplay,false);
 assert.equal((await service.save(actor,{expectedVersion:0,value},id(80))).meta.idempotentReplay,true);
 await assert.rejects(service.save(actor,{expectedVersion:0,value:{...value,fields:{...value.fields,price:'20'}}},id(80)),{code:'IDEMPOTENCY_CONFLICT'});
 await assert.rejects(service.save(actor,{expectedVersion:0,value},id(81)),{code:'STALE_PREPARATION'});
 assert.equal((await service.save(actor,{expectedVersion:1,value},id(81))).data.version,2);
});
test('invalid assignments, replacement correlation and foreign records cannot cross identity boundaries',async()=>{
 const service=new PreparationService(bank(),refs);await assert.rejects(service.save(actor,{expectedVersion:0,value:{...value,assignmentIds:[id(77)]}},id(80)),{code:'INVALID_PREPARATION_REFERENCES'});
 await assert.rejects(service.save(actor,{expectedVersion:0,value:{...value,supersedesOfferId:id(77)}},id(80)),{code:'INVALID_PREPARATION_REFERENCES'});
 const leaking=new PreparationService({list:async()=>[{...record,userId:id(77)}],save:async()=>({record,replay:false})},refs);await assert.rejects(leaking.list(actor,{}),{code:'FORBIDDEN_PREPARATION_SCOPE'});
 await assert.rejects(service.save(actor,{expectedVersion:0,value},'not-a-key'));
});
test('route requires authentication and same-origin before resolving its service',async()=>{
 const router=createOfferPreparationsRouter({actor:async()=>actor,service:async()=>new PreparationService(bank(),refs)}),url=`http://localhost/api/v2/carriers/${actor.carrierId}/offer-preparations`;
 assert.equal((await router.request(url)).status,401);
 assert.equal((await router.request(url,{method:'POST',headers:{Cookie:'test=controlled',Origin:'https://foreign.invalid'},body:'{}'})).status,403);
 const own=await router.request(url,{headers:{Cookie:'test=controlled'}});assert.equal(own.status,200);assert.equal(own.headers.get('Cache-Control'),'no-store, private');
 const save=await router.request(url,{method:'POST',headers:{Cookie:'test=controlled',Origin:'http://localhost','Content-Type':'application/json','Idempotency-Key':id(80)},body:JSON.stringify({expectedVersion:0,value})});assert.equal(save.status,200);assert.equal((await save.json()).data.value.fields.price,'');
});
