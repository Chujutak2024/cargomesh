/** Disposable local fixtures, real Next cookie login. No hosted target or secrets in output. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
const origin=process.env.HAC45_APP_URL??'http://127.0.0.1:3090';
const bank=process.env.HAC45_BANK_DIR;
assert.ok(bank,'HAC45_BANK_DIR is required');
assert.equal(new URL(origin).hostname,'127.0.0.1');
assert.match(fs.readFileSync(bank+'/supabase/config.toml','utf8'),/^project_id = "hac45-carrier-local"/m);
const carrier='c2340000-0000-4000-8000-000000000001';
const password=randomBytes(24).toString('base64url');
const roles=['ADMIN','OPERATOR','DISPATCHER'];
function sql(query){const r=spawnSync('docker',['exec','-i','supabase_db_hac45-carrier-local','psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',maxBuffer:2e6});assert.equal(r.status,0,'local fixture prerequisite');return r.stdout;}
const credentials=[];
for(const [index,role] of roles.entries()){
 const suffix=String(index+1).padStart(12,'0'),id='c4610000-0000-4000-8000-'+suffix,op='c4620000-0000-4000-8000-'+suffix;
 const email='hac45-'+role.toLowerCase()+'@example.invalid';
 sql(`begin;insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
 values('00000000-0000-0000-0000-000000000000','${id}','authenticated','authenticated','${email}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','')
 on conflict(id) do update set encrypted_password=excluded.encrypted_password;
 insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at)
 values('${op}','${carrier}','${id}','[SYNTHETIC] HAC45 ${role}','${role}','ACTIVE',now()) on conflict(id) do nothing;
 insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission)
 select '${id}','${carrier}','CARRIER_EDITOR' where not exists(select 1 from private.v2_catalog_grants where auth_user_id='${id}' and permission='CARRIER_EDITOR');commit;`);
 assert.equal(sql(`select count(*) from public.organization_members where auth_user_id='${id}';`).trim(),'0');
 credentials.push({role,email,password,carrierId:carrier});
}
// An ignored local file is used for manual UI verification; credentials are never printed.
const privatePath=new URL('../.env.hac45-actors.local',import.meta.url);fs.writeFileSync(privatePath,JSON.stringify(credentials,null,2));
let checks=0;
function pass(){checks++;}
async function login(actor,value={}){
 const response=await fetch(origin+'/api/auth/login',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password:actor.password,returnTo:'/carrier-portal',...value})});
 return {response,body:await response.json(),cookies:response.headers.getSetCookie().map(c=>c.split(';',1)[0]).join('; ')};
}
assert.equal((await login(credentials[0],{returnTo:'https://foreign.invalid'})).response.status,400);pass();
assert.equal((await login(credentials[0],{password:'invalid'})).response.status,401);pass();
const csrf=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);pass();
for(const actor of credentials){
 const {response,body,cookies}=await login(actor);assert.equal(response.status,200,actor.role+' cookie login');assert.equal(body.destination,'/carrier-portal');assert.ok(cookies);pass();
 const get=async p=>fetch(origin+p,{redirect:'manual',headers:{Cookie:cookies}});
 const own=await get('/api/v2/carrier-portal/access');assert.equal(own.status,200);const access=(await own.json()).data;assert.equal(access.length,1);assert.equal(access[0].role,actor.role);pass();
 assert.equal((await get('/api/v2/carrier-portal/carriers/'+carrier)).status,200);pass();
 assert.equal((await get('/api/v2/carrier-portal/carriers/'+carrier+'/assets')).status,200);pass();
 assert.equal((await get('/api/v2/carrier-portal/carriers/'+carrier+'/depots?limit=100&offset=0')).status,200);pass();
 const back=await get('/login?returnTo=%2Fcarrier-portal');assert.equal(back.status,307);assert.equal(new URL(back.headers.get('location'),origin).pathname,'/carrier-portal');pass();
 assert.equal((await get('/dashboard')).status,307);pass();
 const mutation=await fetch(origin+'/api/v2/carrier-portal/carriers/'+carrier+'/depots',{method:'POST',headers:{Cookie:cookies,Origin:origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({schemaVersion:'2.0',code:'HAC45_COOKIE_'+actor.role,name:'[SYNTHETIC] cookie depot',location:{label:'Local fixture',countryCode:'PE',region:'LIM',city:'Lima',lat:-12,lng:-77},active:true,handling:['BOX_TRUCK']})});
 assert.equal(mutation.status,actor.role==='ADMIN'?201:403);pass();
 const logout=await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookies}});assert.equal(logout.status,200);pass();
}
const anonymous=await fetch(origin+'/api/v2/carrier-portal/access');assert.equal(anonymous.status,401);pass();
console.log(JSON.stringify({result:'PASS',checks,transport:'REAL_NEXT_HTTP_COOKIES',carrierOnly:true,localOnly:true,roles}));
