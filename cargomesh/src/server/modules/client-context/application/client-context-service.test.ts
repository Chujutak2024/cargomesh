import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClientContextService,type ClientConfirmationRepository} from './client-context-service';
import {FacilityServiceV2} from '../../facilities/application/facility-service';
import {OrganizationServiceV2} from '../../organizations/application/organization-service';
import {CatalogServiceV2} from '../../catalog/application/catalog-service';
import type {FacilityV2} from '@/shared/schemas/v2/facilities';
const actor={organizationId:'52000000-0000-4000-8000-000000000001',memberId:'52020000-0000-4000-8000-000000000001'};
const id='52010000-0000-4000-8000-000000000001',confirmationId='52cc0000-0000-4000-8000-000000000001',now='2026-10-19T12:00:00Z';
const facility:FacilityV2={id,organizationId:actor.organizationId,version:1,createdAt:now,updatedAt:now,value:{schemaVersion:'2.0',code:'CONTROL',name:'Synthetic control',facilityType:'WAREHOUSE',active:true,location:{label:'Fictional address',city:'Lima',region:null,countryCode:'PE',lat:-12,lng:-77},accessRestrictions:[],operatingHours:null}};
function services(row=facility){return {
 facilities:new FacilityServiceV2({list:async()=>[row],get:async()=>row,command:async()=>{throw new Error('Direct write must not run');}}),
 organization:new OrganizationServiceV2({get:async()=>({id:actor.organizationId,version:1,createdAt:now,updatedAt:now,value:{schemaVersion:'2.0',code:'CONTROL',commercialName:'Synthetic organization',legalName:null,taxIdType:null,taxIdValue:null,countryCode:'PE',corporateEmail:null,corporatePhone:null,defaultCurrency:'USD',status:'ACTIVE'}}),revise:async()=>{throw new Error('Direct write must not run');}}),
 catalog:new CatalogServiceV2({read:async()=>[],command:async()=>{throw new Error('Direct write must not run');}}),
};}
const proposalInput={action:'facility.create',resourceId:null,expectedVersion:null,idempotencyKey:confirmationId,value:facility.value};
function repository():ClientConfirmationRepository{return {
 prepare:async(member,input)=>({id:confirmationId,organizationId:member.organizationId,memberId:member.memberId,action:input.action,resourceId:input.resourceId,expectedVersion:input.expectedVersion,proposedValue:input.value,expiresAt:now,requiresConfirmation:true}),
 confirm:async()=>({action:'facility.create',id,idempotentReplay:false}),
};}
test('authorized context is the positive control for tenant mismatch and invalid page',async()=>{
 const service=new ClientContextService(actor,services(),repository());
 const result=await service.read({limit:1});assert.equal(result.facilities.data[0].id,id);assert.equal(result.facilities.meta.nextOffset,1);
 await assert.rejects(service.read({limit:101}));
 await assert.rejects(new ClientContextService(actor,services({...facility,organizationId:'52000000-0000-4000-8000-000000000002'}),repository()).read(),{code:'FORBIDDEN_TENANT'});
});
test('prepare cannot mutate; explicit confirmation and server actor are required',async()=>{
 let confirms=0;const repo=repository(),confirm=repo.confirm;repo.confirm=async(...args)=>{confirms++;return confirm(...args);};
 const service=new ClientContextService(actor,services(),repo),prepared=await service.prepare(proposalInput);
 assert.equal(prepared.data.requiresConfirmation,true);assert.equal(confirms,0);
 await assert.rejects(service.confirm({confirmationId,confirmed:false}));assert.equal(confirms,0);
 assert.equal((await service.confirm({confirmationId,confirmed:true})).data.id,id);assert.equal(confirms,1);
 await assert.rejects(service.prepare({...proposalInput,organizationId:'52000000-0000-4000-8000-000000000002'}));
});
test('a valid proposal controls rejection of forged proposal membership',async()=>{
 const repo=repository(),service=new ClientContextService(actor,services(),repo);
 assert.equal((await service.prepare(proposalInput)).data.organizationId,actor.organizationId);
 const original=repo.prepare;repo.prepare=async(...args)=>({...await original(...args) as Record<string,unknown>,memberId:'52020000-0000-4000-8000-000000000002'});
 await assert.rejects(service.prepare(proposalInput),{code:'FORBIDDEN_TENANT'});
});
