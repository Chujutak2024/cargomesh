import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunity,at,period,id} from '@/features/carrier-portal/commercial-test-fixtures';
import {opportunityFacts,canRespondOpportunity,opportunityReference} from './opportunity-model';
import {opportunityRequestBrief} from './opportunity-request-brief';

function row(){
 const value=opportunity();
 value.data.requestBrief={schemaVersion:'1.0',requestId:value.requestId,requestCode:'ORDER-104',
  requestVersion:2,currentRequestVersion:2,customerRef:value.organizationId,pickupWindow:period,
  deliveryWindow:{startsAt:'2026-10-16T15:00:00Z',endsAt:'2026-10-16T18:00:00Z'},
  acceptedModes:['ROAD'],requiredEquipment:'BOX_TRUCK',preferredEquipment:null,
  contactsVisibility:'WITHHELD',locationPrecision:'CITY',isCurrent:true,canReview:true,requestStatus:'PENDING',
  planEligibility:'unknown',pendingRequirements:['ROUTE_LIMITS_UNKNOWN'],exclusionReasons:[]};
 return value;
}
test('authorized request code, version and customer windows come from the minimum projection',()=>{
 const value=row(),facts=opportunityFacts(value);
 assert.equal(opportunityReference(value),'ORDER-104');assert.equal(facts.brief?.requestVersion,2);
 assert.deepEqual(facts.pickup,period);assert.equal(facts.delivery?.endsAt,'2026-10-16T18:00:00Z');
 assert.equal(facts.brief?.contactsVisibility,'WITHHELD');
 assert.equal(facts.brief?.planEligibility,'unknown');assert.equal(canRespondOpportunity(value,'OPERATOR',Date.parse(at)),true);
});
test('a stale invitation remains readable but cannot be accepted as the current request',()=>{
 const value=row();value.data.requestBrief={...(value.data.requestBrief as object),isCurrent:false,canReview:false,currentRequestVersion:3};
 assert.equal(opportunityRequestBrief(value)?.requestVersion,2);
 assert.equal(opportunityFacts(value).delivery?.endsAt,'2026-10-16T18:00:00Z');
 assert.equal(canRespondOpportunity(value,'ADMIN',Date.parse(at)),false);
});
test('a mismatched tenant or request brief cannot enable a response',()=>{
 for(const foreign of [{customerRef:id(88)},{requestId:id(89)}]){
  const value=row();value.data.requestBrief={...(value.data.requestBrief as object),...foreign};
  assert.equal(opportunityRequestBrief(value),null);assert.equal(opportunityFacts(value).projectionInvalid,true);
  assert.equal(canRespondOpportunity(value,'ADMIN',Date.parse(at)),false);
 }
});
test('invalid windows and inconsistent current-version assertions fail closed',()=>{
 for(const invalid of [{pickupWindow:{...period,endsAt:'invalid'}},{currentRequestVersion:3},{requestStatus:'CANCELLED'}]){
  const value=row();value.data.requestBrief={...(value.data.requestBrief as object),...invalid};
  assert.equal(opportunityRequestBrief(value),null);assert.equal(canRespondOpportunity(value,'ADMIN',Date.parse(at)),false);
 }
});
test('a closed request does not regain review permission from an open opportunity deadline',()=>{
 const value=row();value.data.requestBrief={...(value.data.requestBrief as object),requestStatus:'CANCELLED',canReview:false};
 assert.equal(opportunityRequestBrief(value)?.requestStatus,'CANCELLED');
 assert.equal(canRespondOpportunity(value,'OPERATOR',Date.parse(at)),false);
});
