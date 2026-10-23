import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunity,at,period,id} from '@/features/carrier-portal/commercial-test-fixtures';
import {opportunityFacts,canRespondOpportunity,opportunityIdFromHash,opportunityReference} from './opportunity-model';
test('missing cargo and customer windows stay unknown; resource windows are not substituted',()=>{
 const row=opportunity();row.data.assignmentSnapshots[0].window=period;
 const f=opportunityFacts(row);assert.equal(f.weightKg,null);assert.equal(f.pickup,null);assert.equal(f.delivery,null);assert.deepEqual(f.resourceWindows[0].window,period);assert.equal(f.resourceWindows.length,1);
});
test('valid explicit windows and recorded zero weight are retained; malformed values remain unknown',()=>{
 const row=opportunity();row.data.pickupWindow=period;row.data.deliveryWindow={...period,endsAt:'invalid'};row.data.cargoSpecification.totalWeightKg=0;row.data.cargoSpecification.totalVolumeM3='20';
 const f=opportunityFacts(row);assert.deepEqual(f.pickup,period);assert.equal(f.delivery,null);assert.equal(f.weightKg,0);assert.equal(f.volumeM3,null);
});
test('response permissions use role, actual status and response deadline',()=>{
 const row=opportunity(),now=Date.parse(at);assert.equal(canRespondOpportunity(row,'ADMIN',now),true);assert.equal(canRespondOpportunity(row,'OPERATOR',now),true);assert.equal(canRespondOpportunity(row,'DISPATCHER',now),false);
 assert.equal(canRespondOpportunity(row,'ADMIN',Date.parse(row.data.responseDeadline)),false);
 for(const status of ['OFFERED','DECLINED','EXPIRED','CANCELLED','UNKNOWN'])assert.equal(canRespondOpportunity({...row,status},'ADMIN',now),false);
});
test('details accept only valid API identities and do not reinterpret local example references',()=>{
 assert.equal(opportunityIdFromHash('#/shipments/details/'+id(10)),id(10));
 for(const hash of ['#/shipments','#/shipments/details/SOL-0001','#/shipments/details/%','#/shipments/details/foreign'])assert.equal(opportunityIdFromHash(hash),null);
 // The display reference belongs to the parent request; opportunity identity remains separate.
 assert.equal(opportunityReference({...opportunity(),id:id(10)}),opportunityReference({...opportunity(),id:id(11)}));
 assert.notEqual(opportunityReference({...opportunity(),requestId:id(10)}),opportunityReference({...opportunity(),requestId:id(11)}));
});
