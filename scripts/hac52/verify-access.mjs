import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {APP,API,ROOT,outsideRepo,sql} from './provision-local.mjs';
try{
 const access=JSON.parse(await fs.readFile(outsideRepo(process.argv[2]??''),'utf8'));
 if(access.profile!=='hac52-client'||access.url!==API||access.appOrigin!==APP)throw new Error('OWN_LOCAL_PROFILE_REQUIRED');
 const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'supabase/scenarios/v2-client-base/manifest.json'),'utf8'));
 const checks=[],accounts=[];
 const peCredentialState=()=>sql("select encode(extensions.digest(jsonb_build_object('id',u.id,'email',u.email,'encryptedPassword',u.encrypted_password,'memberId',m.id,'organizationId',m.organization_id,'role',m.role,'status',m.status)::text,'sha256'),'hex') from auth.users u join public.organization_members m on m.auth_user_id=u.id where u.id='6fc92c96-f3b8-4f1b-9038-9ca07bf5dc7d' and m.id='52020000-0000-4000-8000-000000000001';").trim();
 const peBefore=peCredentialState();assert.match(peBefore,/^[0-9a-f]{64}$/);
 function check(name,ok){assert.ok(ok,name);checks.push(name);}
 const anonymous=await fetch(APP+'/api/v2/organizations/current');
 check('anonymous organization request denied',anonymous.status===401);
 for(const org of manifest.organizations){
  const entry=org.code==='HAC52_PE'?{email:access.email,password:access.password}:access.accounts?.[org.code];
  if(!entry||entry.email!==org.email)throw new Error('PRIVATE_ACCOUNT_ENTRY_REQUIRED: '+org.code);
  const login=await fetch(APP+'/api/auth/login',{method:'POST',headers:{Origin:APP,'Content-Type':'application/json'},body:JSON.stringify({...entry,userId:undefined,returnTo:'/clients'}),redirect:'manual',signal:AbortSignal.timeout(120000)});
  const result=await login.json();
  if(login.status!==200||result.ok!==true)throw new Error(org.code+' normal Client login: HTTP '+login.status+'; ok='+String(result.ok===true));
  check(org.code+' normal Client login',result.destination==='/clients');
  const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  check(org.code+' isolated session cookie issued',cookie.startsWith('sb-cargomesh-hac52-client-auth-token'));
  async function read(route){const response=await fetch(APP+'/api/v2'+route,{headers:{cookie},cache:'no-store',signal:AbortSignal.timeout(120000)});return {status:response.status,value:await response.json()};}
  const organization=await read('/organizations/current');
  check(org.code+' sees only its expected organization',organization.status===200&&organization.value.data.id===org.id);
  const facilities=await read('/facilities?limit=100&offset=0');
  const expected=manifest.facilities.filter(facility=>facility.organizationId===org.id).map(facility=>facility.id);
  check(org.code+' has its seeded Facilities positive control',facilities.status===200&&expected.every(id=>facilities.value.data.some(facility=>facility.id===id)));
  check(org.code+' Facility list excludes foreign organizations',facilities.value.data.every(facility=>facility.organizationId===org.id));
  for(const foreign of manifest.organizations.filter(candidate=>candidate.id!==org.id)){
   const ownControl=await read('/facilities/'+expected[0]);check(org.code+' own detail control before '+foreign.code,ownControl.status===200&&ownControl.value.data.organizationId===org.id);
   const foreignId=manifest.facilities.find(facility=>facility.organizationId===foreign.id).id;
   const denied=await read('/facilities/'+foreignId);check(org.code+' cannot read '+foreign.code+' Facility',denied.status===404);
  }
  const context=await read('/client-context');check(org.code+' assistant context stays in its organization',context.status===200&&context.value.organization.id===org.id&&context.value.facilities.data.every(v=>v.organizationId===org.id)&&context.value.profiles.data.every(v=>v.organizationId===org.id)&&context.value.preferences.data.every(v=>v.organizationId===org.id));
  const page=await fetch(APP+'/clients/organization',{headers:{cookie},signal:AbortSignal.timeout(120000)}),html=await page.text();
  check(org.code+' connected page shows its own organization',page.status===200&&html.includes(org.name)&&manifest.organizations.filter(candidate=>candidate.id!==org.id).every(candidate=>!html.includes(candidate.name)));
  accounts.push({code:org.code,organizationId:org.id,login:true,scopedRead:true,foreignReadsDenied:2});
 }
 check('PE credentials and membership unchanged by verification',peCredentialState()===peBefore);
 const report={accounts,accountsPassed:accounts.length,checksPassed:checks.length,checks,peCredentialsAndMembershipUnchanged:true,hostedAccess:false};
 if(process.argv[3])await fs.writeFile(outsideRepo(process.argv[3]),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}catch(error){console.error('Access verification failed: '+error.message);process.exitCode=1;}
