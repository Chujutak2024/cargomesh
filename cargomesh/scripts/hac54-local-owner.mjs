// User-authorized isolated local identity fixture + native, versioned organization correction.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {localHarness} from './hac54-local-harness.mjs';
import {assertOwnerProvisioningTarget,LOCAL_OWNER_EMAIL as email,LOCAL_OWNER_ORGANIZATION as org} from './hac54-owner-policy.mjs';
import {OrganizationRecordV2Schema,OrganizationValueV2Schema} from '../src/shared/schemas/v2/organization.ts';

const repository=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const target=assertOwnerProvisioningTarget({api:process.env.NEXT_PUBLIC_SUPABASE_URL??'',app:process.env.HAC54_LOCAL_APP_URL??'http://localhost:3000',
 file:process.env.HAC54_LOCAL_OWNER_ACCESS_FILE??'',repository,authorized:process.env.HAC54_LOCAL_AUTHORIZE_OWNER});
assertOwnerProvisioningTarget({...target,api:target.api.href,app:target.app.href,
 file:path.join(realpathSync(path.dirname(target.file)),path.basename(target.file)),repository,authorized:'1'});
const gateway=JSON.parse(execFileSync('docker',['inspect','supabase_kong_cargomesh-v2-local'],{encoding:'utf8'}))[0];
assert.ok(gateway.State.Running&&gateway.NetworkSettings.Ports['8000/tcp'].some(row=>row.HostPort==='61321'));
const h=await localHarness('HAC54-LOCAL-OWNER-2026-10-20');
const readSql=sql=>execFileSync('docker',['exec','-i','supabase_db_cargomesh-v2-local','psql','-U','postgres','-d','postgres','-X','-A','-t','-q','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'}).trim();
const existing=readSql(`select count(*) from auth.users where email='${email}';`);
let password;
if(existsSync(target.file)){
 assert.ok(lstatSync(target.file).isFile()&&!lstatSync(target.file).isSymbolicLink());
 const saved=readFileSync(target.file,'utf8');assert.ok(saved.includes('Email: '+email));
 password=saved.split(/\r?\n/).find(row=>row.startsWith('Password: '))?.slice(10);assert.ok(password?.length>=24);
}else{
 assert.equal(existing,'0','Existing local Auth identity has no matching private access file; refuse password reset.');
 password='H54!'+randomBytes(24).toString('base64url');
 writeFileSync(target.file,`CargoMesh LOCAL ONLY — synthetic Client OWNER\nURL: http://localhost:3000/login?returnTo=%2Fclients\nEmail: ${email}\nPassword: ${password}\nOrganization: ${org}\nNever commit or share this file with the team.\n`,{flag:'wx',mode:0o600});
}
const owner=createClient(target.api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let login=await owner.auth.signInWithPassword({email,password});
if(login.error){
 assert.equal(existing,'0','Existing account credentials do not match; no password reset or new grant.');
 const signup=await owner.auth.signUp({email,password,options:{data:{fixture:'HAC54 LOCAL_ONLY synthetic Client OWNER'}}});
 assert.equal(signup.error,null,'Local Auth signup failed.');login=await owner.auth.signInWithPassword({email,password});
}
assert.equal(login.error,null,'Local OWNER login failed.');
const user=await owner.auth.getUser();assert.equal(user.error,null);assert.ok(user.data.user.email_confirmed_at);
assert.equal(user.data.user.email,email);assert.equal(user.data.user.user_metadata.fixture,'HAC54 LOCAL_ONLY synthetic Client OWNER');
const seed=readFileSync(fileURLToPath(new URL('../../supabase/scenarios/v2-hac54-local-owner/seed.sql',import.meta.url)),'utf8');
execFileSync('docker',['exec','-i','supabase_db_cargomesh-v2-local','psql','-U','postgres','-d','postgres','-X','-q','-v','ON_ERROR_STOP=1','-v','local_only=1','-v',`owner_auth_id=${user.data.user.id}`],{input:seed,encoding:'utf8'});
const membership=await owner.from('organization_members').select('id,organization_id,role,status').eq('auth_user_id',user.data.user.id).single();
assert.equal(membership.error,null);assert.equal(membership.data.organization_id,org);assert.equal(membership.data.role,'OWNER');assert.equal(membership.data.status,'ACTIVE');
assert.equal(membership.data.id,'d54e0000-0000-4000-8000-000000000001');
const supervisorUser=(await h.clients.client.auth.getUser()).data.user;
const supervisor=await h.clients.client.from('organization_members').select('role,status').eq('auth_user_id',supervisorUser.id).eq('organization_id',org).single();
assert.equal(supervisor.error,null);assert.equal(supervisor.data.role,'SUPERVISOR');assert.equal(supervisor.data.status,'ACTIVE');
const carrierAccess=await owner.rpc('read_v2_carrier_portal_access');assert.equal(carrierAccess.error,null);assert.deepEqual(carrierAccess.data,[]);

async function cookieFetch(client){
 const jar=new Map(),ssr=createServerClient(target.api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
  cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))},
 });
 assert.equal((await ssr.auth.setSession((await client.auth.getSession()).data.session)).error,null);
 return async(route,body)=>{
  const result=await fetch(new URL('/api/v2'+route,target.app),{method:body?'POST':'GET',redirect:'manual',signal:AbortSignal.timeout(45000),
   headers:{Cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; '),...(body?{Origin:target.app.origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:result.status,body:await result.json()};
 };
}
const call=await cookieFetch(owner),clientCall=await cookieFetch(h.clients.client),foreignCall=await cookieFetch(h.clients.foreign);
const raw=await owner.from('organizations').select('*').eq('id',org).single();assert.equal(raw.error,null);
assert.equal(raw.data.code,'QA-V2-A');assert.ok(raw.data.name.startsWith('[SYNTHETIC]'));assert.equal(raw.data.status,'ACTIVE');
const row=raw.data,value=OrganizationValueV2Schema.parse({schemaVersion:'2.0',code:row.code,commercialName:row.name,legalName:row.legal_name,
 taxIdType:row.business_identifier_type,taxIdValue:row.business_identifier_value,countryCode:row.country_code,corporateEmail:row.corporate_email,
 corporatePhone:row.corporate_phone,defaultCurrency:'USD',status:row.status});
let revised=false;
if(row.default_currency!=='USD'){
 assert.equal(row.default_currency,'PEN');
 const input={action:'organization.revise',resourceId:org,expectedVersion:row.version,idempotencyKey:h.key('qa-usd-v'+row.version),value};
 const proposal=await call('/client-context',input);assert.equal(proposal.status,200,proposal.body.error?.code);
 assert.equal(proposal.body.data.requiresConfirmation,true);assert.equal(proposal.body.data.organizationId,org);
 assert.equal(proposal.body.data.memberId,membership.data.id);assert.equal(proposal.body.data.expectedVersion,row.version);
 const confirmation={confirmationId:proposal.body.data.id,confirmed:true};
 assert.equal((await foreignCall('/client-context/confirm',confirmation)).status,404);
 const saved=await call('/client-context/confirm',confirmation);assert.equal(saved.status,200,saved.body.error?.code);
 const savedOrg=OrganizationRecordV2Schema.parse(saved.body.data);assert.equal(savedOrg.version,row.version+1);assert.deepEqual(savedOrg.value,value);
 const replay=await call('/client-context/confirm',confirmation);assert.equal(replay.status,200);assert.equal(replay.body.meta.idempotentReplay,true);
 assert.equal(replay.body.data.version,savedOrg.version);
 const stale=await call('/client-context',{...input,idempotencyKey:h.key('stale-qa-usd-v'+row.version)});assert.equal(stale.status,200);
 const conflict=await call('/client-context/confirm',{confirmationId:stale.body.data.id,confirmed:true});assert.equal(conflict.status,409);assert.equal(conflict.body.error.code,'STALE_DRAFT');
 revised=true;
}
const supervisorDenied=await clientCall('/client-context',{action:'organization.revise',resourceId:org,expectedVersion:row.version,
 idempotencyKey:h.key('supervisor-not-owner'),value});assert.equal(supervisorDenied.status,403);
for(const [actor,read] of [['owner',call],['supervisor',clientCall]]){
 const context=await read('/client-context?limit=25&offset=0');assert.equal(context.status,200,actor+': '+context.body.error?.code);
 const organization=OrganizationRecordV2Schema.parse(context.body.organization);assert.equal(organization.id,org);assert.equal(organization.value.defaultCurrency,'USD');
 assert.ok(context.body.facilities.data.every(record=>record.organizationId===org));
}
const foreign=await owner.from('organizations').select('id').eq('id','c2300000-0000-4000-8000-000000000002');assert.equal(foreign.error,null);assert.deepEqual(foreign.data,[]);
const deniedCarrier=await call('/carriers/c2340000-0000-4000-8000-000000000001/opportunities');assert.equal(deniedCarrier.status,403);
console.log('HAC54_OWNER_RESULT='+JSON.stringify({localOnly:true,email,memberId:membership.data.id,organizationId:org,role:'OWNER',
 credentialsFile:target.file,organizationRevised:revised,originalSupervisorUnchanged:true,clientContextStatus:200,ownerContextStatus:200,
 supervisorOrganizationWriteStatus:403,foreignOrganizationRows:0,carrierPortalAccess:[],carrierOpportunitiesStatus:403,
 organizationVersion:row.version+(revised?1:0),organizationCurrency:'USD'}));
