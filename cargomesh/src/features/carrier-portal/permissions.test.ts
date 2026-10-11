import {test} from 'node:test';import assert from 'node:assert/strict';
import {canCarrierAction,canCreateCarrierRecord,canReviseCarrierRecord} from './permissions';
import {carrierResources} from './resources';
import {loginDestination} from '@/shared/schemas/v2/carrier-portal';
const access=[{carrierId:'00000000-0000-4000-8000-000000000001',operatorId:'00000000-0000-4000-8000-000000000002',role:'OPERATOR' as const,carrierName:'Synthetic',displayName:'Operator'}];
test('carrier-only login returns to portal, without shipper membership or open redirects',()=>{
 assert.equal(loginDestination('/carrier-portal',false,access),'/carrier-portal');
 assert.equal(loginDestination('/dashboard',false,access),'/carrier-portal');
 assert.equal(loginDestination('https://attacker.invalid',false,access),'/carrier-portal');
 assert.equal(loginDestination('/carrier-portal',true,[]),null);
 assert.equal(loginDestination(undefined,true,[]),'/dashboard');
 assert.equal(loginDestination(undefined,false,[]),null);
});
test('catalog editing requires ADMIN; operational records remain available to dispatcher',()=>{
 const asset=carrierResources.find(r=>r.key==='assets')!,incident=carrierResources.find(r=>r.key==='incidents')!;
 assert.equal(canCreateCarrierRecord('ADMIN',asset),true);
 for(const role of ['OPERATOR','DISPATCHER'] as const){assert.equal(canCreateCarrierRecord(role,asset),false);assert.equal(canReviseCarrierRecord(role,asset),false);}
 assert.equal(canCreateCarrierRecord('DISPATCHER',incident),true);
 assert.equal(canCreateCarrierRecord('DISPATCHER',carrierResources.find(r=>r.key==='metrics')!),false);
});
test('actions follow booking and execution lifecycle, fail closed for unknown transitions',()=>{
 assert.equal(canCarrierAction('OPERATOR','bookings.confirm','AUTHORIZED'),true);
 for(const status of ['PENDING','CONFIRMED','CANCELLED'])assert.equal(canCarrierAction('OPERATOR','bookings.confirm',status),false);
 assert.equal(canCarrierAction('DISPATCHER','bookings.confirm','AUTHORIZED'),false);
 assert.equal(canCarrierAction('DISPATCHER','executions.start','PLANNED'),true);
 assert.equal(canCarrierAction('DISPATCHER','executions.complete','PLANNED'),false);
 assert.equal(canCarrierAction('OPERATOR','executions.complete','IN_PROGRESS'),true);
 assert.equal(canCarrierAction('ADMIN','unknown.command','OPEN'),false);
});
