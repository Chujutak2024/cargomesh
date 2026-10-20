import assert from 'node:assert/strict';
export function scenarioPolicy(name,recipe,phase,now=Date.now()){
 assert.ok(['v2-hac54-commercial','v2-hac54-validation-2026-10-21'].includes(name),'Unknown scenario; refuse arbitrary recipe paths.');
 assert.equal(recipe.package,name==='v2-hac54-commercial'?'HAC54-H4-2026-10-20':'HAC54-VALIDATION-2026-10-21');
 assert.ok(['prepare','execute'].includes(phase),'Phase must be explicit prepare or execute.');
 const clock=Date.parse(recipe.clock),expiry=Date.parse(recipe.expiresAt),start=Date.parse(recipe.planWindow.startsAt),end=Date.parse(recipe.planWindow.endsAt);
 assert.ok(Number.isFinite(now)&&Number.isFinite(clock)&&Number.isFinite(expiry)&&Number.isFinite(start)&&Number.isFinite(end));
 assert.ok(clock<=now&&now<expiry,'Dated scenario expired or evidence is in the future; never silently redate.');
 assert.ok(clock<start&&start<end&&end<=Date.parse(recipe.validUntil));
 assert.ok(Date.parse(recipe.responseDeadline??recipe.expiresAt)<=Date.parse(recipe.pickupWindow.endsAt),'Response deadline exceeds pickup window.');
 assert.ok(Date.parse(recipe.holdExpiresAt??recipe.expiresAt)<=end,'Hold expiry exceeds the assigned window.');
 if(phase==='execute')assert.ok(start<=now&&now<end,'Execution phase cannot backdate a future or closed transport.');
 return {phase,manualSelectionCase:recipe.manualSelectionCase??null,resourcePrefix:recipe.resourcePrefix??'H54_'};
}
