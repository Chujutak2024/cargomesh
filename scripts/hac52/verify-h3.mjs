import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:59580',checks=[];
const login=await fetch(origin+'/api/local/hac52/client-session',{method:'POST',headers:{Origin:origin},redirect:'manual'});
assert.equal(login.status,303);const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function api(route,body,auth=true){const response=await fetch(origin+'/api/v2'+route,{method:body?'POST':'GET',headers:{...(auth?{cookie}:{}),Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});return {status:response.status,value:await response.json()};}
function check(name,ok){assert.ok(ok,name);checks.push(name);}
try{
 const context=await api('/client-context');check('authorized organization/facilities/profiles/preferences context',context.status===200&&context.value.organization.id==='52000000-0000-4000-8000-000000000001'&&context.value.facilities.data.length>=3&&context.value.profiles.data.length>=1&&context.value.preferences.data.length===1);
 check('context excludes other organizations',context.value.facilities.data.every(v=>v.organizationId===context.value.organization.id)&&context.value.profiles.data.every(v=>v.organizationId===context.value.organization.id));
 const anonymous=await api('/client-context',undefined,false);check('anonymous context denied with authorized positive control',anonymous.status===401);
 const options=await api('/intake/options');check('three seed Facilities available to new request',options.status===200&&options.value.data.facilities.filter(v=>v.id.startsWith('52010000-')).length===3);
 const foreign=await api('/facilities/52010000-0000-4000-8000-000000000004');check('foreign Facility id is not disclosed',foreign.status===404);
 const own=await api('/facilities/52010000-0000-4000-8000-000000000001');check('own detail positive control',own.status===200);
 const profile=context.value.profiles.data.find(v=>v.id==='52040000-0000-4000-8000-000000000001');
 const proposal={action:'cargo-profile.revise',resourceId:profile.id,expectedVersion:profile.version,idempotencyKey:crypto.randomUUID(),value:{...profile.value,preferredEquipment:'BOX_TRUCK'}};
 const prepared=await api('/client-context',proposal);check('assistant requests a persisted confirmation',prepared.status===200&&prepared.value.data.requiresConfirmation===true);
 const before=await api('/cargo-profiles/'+profile.id);check('prepare has not changed business data',before.value.data.version===profile.version);
 const unconfirmed=await api('/client-context/confirm',{confirmationId:prepared.value.data.id,confirmed:false});check('unconfirmed action refused',unconfirmed.status===400);
 const confirmed=await api('/client-context/confirm',{confirmationId:prepared.value.data.id,confirmed:true});check('confirmed profile revision persists',confirmed.status===200&&confirmed.value.data.version===profile.version+1);
 const replay=await api('/client-context/confirm',{confirmationId:prepared.value.data.id,confirmed:true});check('confirmed replay does not duplicate',replay.status===200&&replay.value.meta.idempotentReplay&&replay.value.data.id===profile.id);
 const unknown=await api('/facilities/52010000-0000-4000-8000-000000000003');check('unknown schedule stays explicit',unknown.status===200&&unknown.value.data.value.operatingHours===null);
 const report={checks,passed:checks.length,hostedAccess:false};if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){console.error('H3 HTTP smoke failed: '+error.message);process.exitCode=1;}
