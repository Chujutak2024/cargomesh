import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin='http://127.0.0.1:59580',checks=[];
const login=await fetch(origin+'/api/local/hac52/client-session',{method:'POST',headers:{Origin:origin},redirect:'manual'});
assert.equal(login.status,303,'local authenticated control');
const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function api(route,body,key){const response=await fetch(origin+'/api/v2'+route,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});return {status:response.status,value:await response.json()};}
function check(name,ok){assert.ok(ok,name);checks.push(name);}
try{
 const value={schemaVersion:'2.0',code:'HAC52_HTTP_CONTROL',name:'[SYNTHETIC] HTTP control facility',facilityType:'WAREHOUSE',active:false,
  location:{label:'Fictional Test Avenue 52',countryCode:'PE',region:'Lima',city:'Lima',lat:-12.05,lng:-77.04},accessRestrictions:[],operatingHours:{timezone:'America/Lima',weekly:[{dayOfWeek:1,opensAt:'08:00',closesAt:'24:00'}]}};
 const key='52e00000-0000-4000-8000-000000000001';
 const created=await api('/facilities',value,key);
 check('authenticated Facility create with midnight closure',[200,201].includes(created.status));
 const id=created.value.data.id,replay=await api('/facilities',value,key);
 check('identical create replays the same id',replay.status===200&&replay.value.meta.idempotentReplay&&replay.value.data.id===id);
 const conflict=await api('/facilities',{...value,name:'changed'},key);
 check('changed payload with same key conflicts',conflict.status===409&&conflict.value.error.code==='IDEMPOTENCY_CONFLICT');
 const invalid=await api('/facilities',{...value,location:{...value.location,lat:91}},'52e00000-0000-4000-8000-000000000009');
 check('invalid coordinates rejected after valid control',invalid.status===400);
 const revision={expectedVersion:1,value:{...value,name:'[SYNTHETIC] Revised HTTP control facility'}};
 const revised=await api('/facilities/'+id+'/revisions',revision,'52e00000-0000-4000-8000-000000000002');
 check('Facility revision is persisted',revised.status===200&&revised.value.data.version===2);
 const stale=await api('/facilities/'+id+'/revisions',{...revision,value:{...value,name:'Stale attempt'}},'52e00000-0000-4000-8000-000000000003');
 check('old version returns recoverable 409',stale.status===409&&stale.value.error.code==='STALE_DRAFT');
 const readback=await api('/facilities/'+id);
 check('new read returns saved version and hours',readback.status===200&&readback.value.data.version===2&&readback.value.data.value.operatingHours.weekly[0].closesAt==='24:00');
 const options=await api('/intake/options');
 check('intake catalog is persisted and omits inactive control',options.status===200&&options.value.data.cargoCategories.length>0&&!options.value.data.facilities.some(v=>v.id===id));
 const profile={schemaVersion:'2.0',name:'[SYNTHETIC] HTTP control profile',categoryId:options.value.data.cargoCategories[0].id,typicalUnits:[{packageType:'BOX',quantity:2,weightPerUnitKg:10,volumePerUnitM3:.1,dimensionsCm:{length:50,width:40,height:50},indivisible:false,stackable:true,unitsPerPackage:1}],requirements:['FRAGILE'],preferredEquipment:'BOX_TRUCK',active:false};
 const savedProfile=await api('/cargo-profiles',profile,'52e00000-0000-4000-8000-000000000004');
 check('cargo profile create connected',[200,201].includes(savedProfile.status));
 const profileRead=await api('/cargo-profiles/'+savedProfile.value.data.id);
 check('cargo units reloaded',profileRead.status===200&&profileRead.value.data.value.typicalUnits[0].quantity===2);
 const organization=await api('/organizations/current');
 check('organization positive read control',organization.status===200);
 const orgSave=await api('/organizations/current/revisions',{expectedVersion:organization.value.data.version,value:{...organization.value.data.value,corporatePhone:'+5115550052'}},crypto.randomUUID());
 check('organization revision connected',orgSave.status===200);
 const current=await api('/organizations/current');check('organization revision read back',current.status===200&&current.value.data.value.corporatePhone==='+5115550052');
 const report={checks,passed:checks.length,facilityId:id,profileId:savedProfile.value.data.id,inactiveControlRowsRetained:true,hostedAccess:false};
 if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){console.error('H2 smoke failed: '+error.message);process.exitCode=1;}
