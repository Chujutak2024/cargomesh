import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {API,ROOT,sql,privateFile,outsideRepo} from './provision-local.mjs';
const filename=outsideRepo(process.argv[2]??'');
try{
 const access=JSON.parse(await fs.readFile(filename,'utf8'));
 if(access.profile!=='hac52-client'||access.url!==API)throw new Error('HAC52_LOCAL_PROFILE_REQUIRED');
 const fixture=JSON.parse(await fs.readFile(path.join(ROOT,'supabase/scenarios/v2-client-base/manifest.json'),'utf8'));
 const seed=await fs.readFile(path.join(ROOT,'supabase/scenarios/v2-client-base/seed.sql'),'utf8');
 sql(seed);const first=sql("select count(*) from public.facilities where id::text like '52010000-%';").trim();
 sql(seed);const second=sql("select count(*) from public.facilities where id::text like '52010000-%';").trim();
 if(first!=='8'||second!=='8')throw new Error('SEED_REPLAY_COUNT_MISMATCH');
 access.accounts??={};
 for(const org of fixture.organizations){
  const account=access.accounts[org.code]??{email:org.email,password:org.email===access.email?access.password:randomBytes(30).toString('base64url')};
  access.accounts[org.code]=account;await privateFile(filename,access);
  const headers={apikey:access.anonKey,'Content-Type':'application/json'},body=JSON.stringify({email:account.email,password:account.password});
  let response=await fetch(API+'/auth/v1/token?grant_type=password',{method:'POST',headers,body});
  if(!response.ok)response=await fetch(API+'/auth/v1/signup',{method:'POST',headers,body});
  const auth=await response.json(),user=auth.user?.id;
  if(!response.ok||!/^[0-9a-f-]{36}$/i.test(user??''))throw new Error('LOCAL_ACCOUNT_UNAVAILABLE');
  account.userId=user;await privateFile(filename,access);
  sql(`begin;insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status,created_at,updated_at)
    values('${org.memberId}','${org.id}','${user}','Synthetic Client ${org.countryCode}','${org.email}','OWNER','ACTIVE','${fixture.clock}','${fixture.clock}') on conflict(id) do nothing;
    do $$ begin if not exists(select 1 from public.organization_members where id='${org.memberId}' and organization_id='${org.id}' and auth_user_id='${user}' and status='ACTIVE')then raise exception 'LOCAL_MEMBER_SCOPE_MISMATCH';end if;end $$;commit;`);
 }
 console.log(JSON.stringify({scenario:fixture.scenario,clock:fixture.clock,organizations:3,facilities:8,profiles:3,preferences:3,firstCount:Number(first),repeatedCount:Number(second),accountsProvisioned:3,carrierCatalogChanged:false,hostedAccess:false},null,2));
}catch(error){console.error('H3 local seed failed: '+error.message);process.exitCode=1;}
