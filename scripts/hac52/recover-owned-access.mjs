// Explicit recovery only. Do not run --recover-owned-bo-cl without the user's approval.
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {API,command,sql,privateFile,outsideRepo} from './provision-local.mjs';
const [mode,filenameArg,bankArg]=process.argv.slice(2);
if(!['--check','--recover-owned-bo-cl'].includes(mode)||!filenameArg||!bankArg)throw new Error('Usage: recover-owned-access.mjs --check|--recover-owned-bo-cl ABS_ACCESS_FILE ABS_OWN_BANK');
const filename=outsideRepo(filenameArg),bank=outsideRepo(bankArg);
try{
 const access=JSON.parse(await fs.readFile(filename,'utf8'));
 if(access.profile!=='hac52-client'||access.url!==API)throw new Error('OWN_LOCAL_PROFILE_REQUIRED');
 if(sql("select shobj_description((select oid from pg_database where datname=current_database()),'pg_database');").trim()!=='LOCAL_ONLY:HAC52_CLIENT_BASE')throw new Error('OWN_LOCAL_BANK_REQUIRED');
 const accounts=[{code:'HAC52_BO',memberId:'52020000-0000-4000-8000-000000000002',orgId:'52000000-0000-4000-8000-000000000002',email:'hac52-client-bo@example.invalid'},
  {code:'HAC52_CL',memberId:'52020000-0000-4000-8000-000000000003',orgId:'52000000-0000-4000-8000-000000000003',email:'hac52-client-cl@example.invalid'}];
 for(const account of accounts){
  account.userId=sql(`select m.auth_user_id from public.organization_members m join auth.users u on u.id=m.auth_user_id
   where m.id='${account.memberId}' and m.organization_id='${account.orgId}' and u.email='${account.email}' and m.status='ACTIVE';`).trim();
  if(!/^[0-9a-f-]{36}$/i.test(account.userId))throw new Error('OWN_SYNTHETIC_IDENTITY_REQUIRED');
 }
 if(mode==='--check'){console.log('Recovery scope verified: exactly two owned local synthetic BO/CL identities. No password change, private-file write or service key access.');}
 else{
  const status=JSON.parse(command('supabase',['status','--workdir',bank,'-o','json']));
  if(status.API_URL!==API||!status.SERVICE_ROLE_KEY)throw new Error('OWN_LOCAL_ADMIN_REQUIRED');
  access.accounts??={};
  access.accounts.HAC52_PE??={email:access.email,password:access.password};
  for(const account of accounts){
   const password=randomBytes(30).toString('base64url');
   access.accounts[account.code]={email:account.email,password,userId:account.userId};
   await privateFile(filename,access);
   const response=await fetch(API+'/auth/v1/admin/users/'+account.userId,{method:'PUT',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:'Bearer '+status.SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({password})});
   if(!response.ok)throw new Error('LOCAL_ACCESS_RECOVERY_FAILED');
  }
  console.log('Two owned local synthetic accesses recovered; private access file verified outside Git. No credential output.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
