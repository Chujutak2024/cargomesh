// Explicit recovery only. Do not run --recover-owned-bo-cl without the user's approval.
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {API,command,sql,privateFile,outsideRepo} from './provision-local.mjs';
const [mode,filenameArg,bankArg,evidenceArg]=process.argv.slice(2);
if(!['--check','--recover-owned-bo-cl'].includes(mode)||!filenameArg||!bankArg)throw new Error('Usage: recover-owned-access.mjs --check|--recover-owned-bo-cl ABS_ACCESS_FILE ABS_OWN_BANK');
const filename=outsideRepo(filenameArg),bank=outsideRepo(bankArg);
try{
 const access=JSON.parse(await fs.readFile(filename,'utf8'));
 if(access.profile!=='hac52-client'||access.url!==API)throw new Error('OWN_LOCAL_PROFILE_REQUIRED');
 if(sql("select shobj_description((select oid from pg_database where datname=current_database()),'pg_database');").trim()!=='LOCAL_ONLY:HAC52_CLIENT_BASE')throw new Error('OWN_LOCAL_BANK_REQUIRED');
 const accounts=[{code:'HAC52_BO',memberId:'52020000-0000-4000-8000-000000000002',orgId:'52000000-0000-4000-8000-000000000002',userId:'8611d4f9-bc58-4ec4-821e-f64aee3d9ce2',email:'hac52-client-bo@example.invalid'},
  {code:'HAC52_CL',memberId:'52020000-0000-4000-8000-000000000003',orgId:'52000000-0000-4000-8000-000000000003',userId:'4445548f-d8bf-4348-ba41-0b8317100f73',email:'hac52-client-cl@example.invalid'}];
 for(const account of accounts){
  const actualId=sql(`select m.auth_user_id from public.organization_members m join auth.users u on u.id=m.auth_user_id
   where m.id='${account.memberId}' and m.organization_id='${account.orgId}' and m.auth_user_id='${account.userId}' and u.email='${account.email}' and m.status='ACTIVE';`).trim();
  if(actualId!==account.userId)throw new Error('EXACT_OWN_SYNTHETIC_IDENTITY_REQUIRED');
 }
 if(mode==='--check'){console.log('Recovery scope verified: exactly two owned local synthetic BO/CL identities. No password change, private-file write or service key access.');}
 else{
  const bankConfig=await fs.readFile(bank+'/supabase/config.toml','utf8');
  if(!bankConfig.includes('project_id = "cargomesh-hac52-local"'))throw new Error('OWN_LOCAL_PROJECT_REQUIRED');
  const peAccess=JSON.stringify({email:access.email,password:access.password,entry:access.accounts?.HAC52_PE});
  const untouchedAccounts=JSON.stringify(Object.entries(access.accounts??{}).filter(([key])=>!accounts.some(account=>account.code===key)));
  const unchangedAuth=()=>sql("select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(u) order by id),'[]'::jsonb)::text,'sha256'),'hex') from auth.users u where id not in ('8611d4f9-bc58-4ec4-821e-f64aee3d9ce2','4445548f-d8bf-4348-ba41-0b8317100f73');").trim();
  const nonTargetAuthBefore=unchangedAuth();
  const status=JSON.parse(command('supabase',['status','--workdir',bank,'-o','json']));
  if(status.API_URL!==API||!status.SERVICE_ROLE_KEY)throw new Error('OWN_LOCAL_ADMIN_REQUIRED');
  const databaseUrl=new URL(status.DB_URL);
  if(databaseUrl.hostname!=='127.0.0.1'||databaseUrl.port!=='64622'||databaseUrl.pathname!=='/postgres')throw new Error('OWN_LOCAL_DATABASE_ENDPOINT_REQUIRED');
  access.accounts??={};
  for(const account of accounts){
   const password=randomBytes(30).toString('base64url');
   access.accounts[account.code]={email:account.email,password,userId:account.userId};
   await privateFile(filename,access);
   const response=await fetch(API+'/auth/v1/admin/users/'+account.userId,{method:'PUT',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:'Bearer '+status.SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({password})});
   if(!response.ok)throw new Error('LOCAL_ACCESS_RECOVERY_FAILED');
  }
  const readback=JSON.parse(await fs.readFile(filename,'utf8'));
  if(JSON.stringify({email:readback.email,password:readback.password,entry:readback.accounts?.HAC52_PE})!==peAccess)throw new Error('PE_PRIVATE_ACCESS_CHANGED');
  if(JSON.stringify(Object.entries(readback.accounts??{}).filter(([key])=>!accounts.some(account=>account.code===key)))!==untouchedAccounts)throw new Error('NON_TARGET_PRIVATE_ACCESS_CHANGED');
  if(unchangedAuth()!==nonTargetAuthBefore)throw new Error('NON_TARGET_AUTH_ROW_CHANGED');
  const report={recovered:accounts.map(({code,userId})=>({code,authUserId:userId})),pePrivateAccessUnchanged:true,nonTargetPrivateAccessUnchanged:true,nonTargetAuthRowsUnchanged:true,privateFileOutsideRepo:true,hostedAccess:false};
  if(evidenceArg)await fs.writeFile(outsideRepo(evidenceArg),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
 }
}catch(error){console.error(error.message);process.exitCode=1;}
