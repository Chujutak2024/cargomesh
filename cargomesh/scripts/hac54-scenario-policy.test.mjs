import assert from 'node:assert/strict';
import test from 'node:test';
import {scenarioPolicy} from './hac54-scenario-policy.mjs';
const name='v2-hac54-validation-2026-10-21',recipe={package:'HAC54-VALIDATION-2026-10-21',clock:'2026-10-20T19:00:00Z',expiresAt:'2026-10-22T05:00:00Z',validUntil:'2026-10-28T00:00:00Z',
 planWindow:{startsAt:'2026-10-21T11:00:00Z',endsAt:'2026-10-22T03:00:00Z'},pickupWindow:{endsAt:'2026-10-21T18:00:00Z'},responseDeadline:'2026-10-21T18:00:00Z',holdExpiresAt:'2026-10-22T03:00:00Z',manualSelectionCase:'07_COMPARISON',resourcePrefix:'H54_21_'};
const now=Date.parse('2026-10-20T20:00:00Z');
test('prepare is valid now but cannot execute the next-day shipment early',()=>{
 assert.equal(scenarioPolicy(name,recipe,'prepare',now).manualSelectionCase,'07_COMPARISON');
 assert.throws(()=>scenarioPolicy(name,recipe,'execute',now),/cannot backdate/);
 assert.equal(scenarioPolicy(name,recipe,'execute',Date.parse('2026-10-21T13:00:00Z')).phase,'execute');
});
test('old recipes, future evidence, arbitrary paths/phases and wrong package fail before authentication',()=>{
 for(const instant of ['2026-10-22T05:00:00Z','2026-10-20T18:59:59Z'])assert.throws(()=>scenarioPolicy(name,recipe,'prepare',Date.parse(instant)),/expired or evidence/);
 assert.throws(()=>scenarioPolicy('../foreign',recipe,'prepare',now),/Unknown scenario/);
 assert.throws(()=>scenarioPolicy(name,recipe,'auto-confirm',now),/Phase must be explicit/);
 assert.throws(()=>scenarioPolicy(name,{...recipe,package:'foreign'},'prepare',now));
});
test('response and hold deadlines cannot exceed native request/assignment windows',()=>{
 assert.throws(()=>scenarioPolicy(name,{...recipe,responseDeadline:recipe.expiresAt},'prepare',now),/pickup window/);
 assert.throws(()=>scenarioPolicy(name,{...recipe,holdExpiresAt:recipe.expiresAt},'prepare',now),/assigned window/);
});
