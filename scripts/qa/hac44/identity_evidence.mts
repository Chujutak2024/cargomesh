import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const root=process.env.HAC44_ROOT!,out=process.env.HAC44_EVIDENCE!,folder=out+'/stack-v2';
const require=createRequire(root+'/cargomesh/package.json');
const bank=process.env.HAC44_BANK_DB!;
assert.ok(bank==='supabase_db_'+process.env.HAC44_PROJECT_PREFIX+'-v2');
const child=(cmd:string,args:string[],input?:string)=>{const r=spawnSync(cmd,args,{encoding:'utf8',input,maxBuffer:8e6});assert.equal(r.status,0,'Local fixture command failed');return r.stdout;};
assert.equal(child('docker',['inspect',bank,'--format','{{index .Config.Labels "com.supabase.cli.project"}}']).trim(),process.env.HAC44_PROJECT_PREFIX+'-v2');
const sql=(q:string)=>child('docker',['exec','-i',bank,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],q);
const {readCliStatus}=await import(pathToFileURL(root+'/scripts/qa/hac44/pkce_smoke.mjs').href);
const cfg=readCliStatus(process.env.HAC44_CLI_JSON,folder);assert.equal(cfg.API_URL,process.env.HAC44_API_URL);
process.env.NEXT_PUBLIC_SUPABASE_URL=cfg.API_URL;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=cfg.ANON_KEY;
const {createClient}=require('@supabase/supabase-js'),opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,opts),clients:any[]=[],roundtrips:any[]=[],cases:any[]=[];
const output=(file:string,v:any)=>fs.writeFileSync(out+'/logs/'+file,JSON.stringify(v,null,2)+'\n');
require('next/dist/server/node-environment');
const {NextRequest}=require('next/server'),{workAsyncStorage}=require('next/dist/server/app-render/work-async-storage.external'),{workUnitAsyncStorage}=require('next/dist/server/app-render/work-unit-async-storage.external'),{createRequestStoreForAPI}=require('next/dist/server/async-storage/request-store');
const {createHonoApp}=await import(pathToFileURL(root+'/cargomesh/src/server/hono/app.ts').href),app=createHonoApp();
const port=Number(process.env.HAC44_HTTP_PORT);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);const origin='http://127.0.0.1:'+port;
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
const request=new NextRequest(origin+req.url,{method:req.method,headers:req.headers,...(body.length?{body,duplex:'half'}:{})} as any),u=new URL(request.url),store=createRequestStoreForAPI(request,{pathname:u.pathname,search:u.search},{tags:[],expirationsByCacheHandler:new Map()},undefined,undefined);
const response=await workAsyncStorage.run({route:u.pathname,isStaticGeneration:false},()=>workUnitAsyncStorage.run(store,()=>app.fetch(request)));
res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('{}');}});
await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
const ORG='d4400000-0000-4000-8000-000000000001',CARRIER='d4440000-0000-4000-8000-000000000001',SERVICE='d4460000-0000-4000-8000-000000000001';
async function call(label:string,token:string|null,path:string,body:any=undefined,expected=200,key=randomUUID()){
const r=await fetch(origin+'/api/v2'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'content-type':'application/json','Idempotency-Key':key},...(body===undefined?{}:{body:JSON.stringify(body)})});
const value=await r.json();cases.push({case:label,label,actor:token?1:0,authMechanism:token?'issuer-verified-session':'anonymous',status:r.status===expected?'PASS':'FAIL',method:body===undefined?'GET':'POST',path,http:r.status,expected,error:value.error?.code??null});output('identity-cases.json',cases);output('identity-api-results.json',cases);assert.equal(r.status,expected,label+': '+value.error?.code);
if(token&&expected>=200&&expected<300)await call(label+' anonymous paired control',null,path,body,401);
return value.data;}
async function login(id:string,email:string){const c=createClient(cfg.API_URL,cfg.ANON_KEY,opts);clients.push(c);const l=await admin.auth.admin.generateLink({type:'magiclink',email});assert.equal(l.error,null);assert.equal(l.data.user.id,id);const s=await c.auth.verifyOtp({token_hash:l.data.properties.hashed_token,type:'magiclink'});assert.equal(s.error,null);const checked=await c.auth.getUser(s.data.session.access_token);assert.equal(checked.error,null);assert.equal(checked.data.user.id,id);return {client:c,token:s.data.session.access_token,id};}
async function roundtrip(kind:string,token:string,path:string,input:any,written:any){const rows=await call(kind+' read',token,path);const read=Array.isArray(rows)?rows.find((r:any)=>r.id===written.id):rows;assert.deepEqual(read,written);roundtrips.push({kind,id:written.id,input,written,read,status:'PASS',authMechanism:'issuer-verified actual Auth session; PKCE for links'});output('identity-roundtrips.json',roundtrips);}
let completed=false,clientId:string|undefined;
try{
sql(`update public.organization_members set role='OWNER' where id='d4420000-0000-4000-8000-000000000001';`);
const emails=JSON.parse(sql("select jsonb_agg(jsonb_build_object('id',id,'email',email) order by id) from auth.users;"));
const a=await login(emails[0].id,emails[0].email),b=await login(emails[1].id,emails[1].email);
const invitees=[];for(let n=0;n<2;n++){const email='identity-evidence-'+randomUUID()+'@cargomesh.test',u=await admin.auth.admin.createUser({email,email_confirm:true});assert.equal(u.error,null);invitees.push(await login(u.data.user.id,email));}
const memberEmail=(await invitees[0].client.auth.getUser()).data.user.email;
const mi={email:memberEmail,role:'REQUESTER'},mp='/organizations/current/members';
let member=await call('owner member invitation',a.token,mp+'/invitations',mi);await roundtrip('members',a.token,mp,mi,member);
await call('anonymous member invitation',null,mp+'/invitations',mi,401);
const accept={expectedVersion:member.version,consent:true},ap='/identity/organizations/'+ORG+'/members/'+member.id+'/acceptance';
await call('wrong invited identity denied',b.token,ap,accept,404);
member=await call('invited verified user accepts membership',invitees[0].token,ap,accept);await roundtrip('members',a.token,mp,accept,member);
const mr={expectedVersion:member.version,role:'SUPERVISOR',status:'ACTIVE'};member=await call('owner member revision',a.token,mp+'/'+member.id+'/revisions',mr);await roundtrip('members',a.token,mp,mr,member);
await call('stale member revision',a.token,mp+'/'+member.id+'/revisions',mr,409);
const foreignMembers=await call('tenant B member list',b.token,mp);assert.ok(!foreignMembers.some((m:any)=>m.id===member.id));
const op='/carriers/'+CARRIER+'/operators',oi={email:(await invitees[1].client.auth.getUser()).data.user.email,displayName:'[SYNTHETIC] measured operator',role:'OPERATOR'};
let operator=await call('carrier admin invitation',a.token,op+'/invitations',oi);await roundtrip('operators',a.token,op,oi,operator);
await call('foreign carrier invitation denied',b.token,op+'/invitations',oi,403);
const oa={expectedVersion:operator.version,consent:true};
await call('invitation alone cannot grant carrier access',invitees[1].token,op+'/'+operator.id+'/acceptance',oa,403);
assert.match(invitees[1].id,/^[a-f0-9-]{36}$/);sql(`insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('${invitees[1].id}','${CARRIER}','CARRIER_EDITOR');`);
operator=await call('invited carrier identity accepts with independently provisioned server grant',invitees[1].token,op+'/'+operator.id+'/acceptance',oa);await roundtrip('operators',a.token,op,oa,operator);
const or={expectedVersion:operator.version,role:'DISPATCHER',status:'ACTIVE'};operator=await call('carrier admin operator revision',a.token,op+'/'+operator.id+'/revisions',or);await roundtrip('operators',a.token,op,or,operator);
await call('stale operator revision',a.token,op+'/'+operator.id+'/revisions',or,409);
const ip='/carriers/'+CARRIER+'/integrations',ii={serviceId:SERVICE,channel:'API',endpointRef:'env://HAC44_RESPONSE_URL',enabled:true,expectedVersion:0};
let integration=await call('persist response integration configuration',a.token,ip,ii);await roundtrip('integrations',a.token,ip,ii,integration);
assert.equal(integration.status,'PENDING');assert.equal(integration.verifiedAt,null);
await call('foreign integration denied',b.token,ip,ii,403);await call('raw secret endpoint denied',a.token,ip,{...ii,endpointRef:'https://unsafe.invalid/?token=secret'},400);
const diag=await call('configuration diagnostic',a.token,ip+'/'+integration.id+'/diagnostics');assert.equal(diag.liveIntegrationConfirmed,false);await call('foreign diagnostic denied',b.token,ip+'/'+integration.id+'/diagnostics',undefined,403);
const locationQuery={kind:'TEXT',text:'Lima'};
const resolved=await call('resolve own saved locations',a.token,'/locations/resolutions',{query:locationQuery});assert.ok(resolved.candidates.length);
const candidate=resolved.candidates.find((c:any)=>c.kind==='FACILITY')??resolved.candidates[0];
const confirmation={query:locationQuery,candidateId:candidate.id,candidateKind:candidate.kind,expectedVersion:candidate.version,confirmed:true};
const selected=await call('confirm versioned own location',a.token,'/locations/confirmations',confirmation);assert.equal(selected.confirmed,true);
await call('stale location denied',a.token,'/locations/confirmations',{...confirmation,expectedVersion:candidate.version+1},409);
const reg=await admin.auth.admin.oauth.createClient({client_name:'LOCAL_ONLY identity evidence',redirect_uris:[origin+'/oauth/callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'});assert.equal(reg.error,null);clientId=reg.data.client_id;assert.match(clientId!,/^[a-f0-9-]{36}$/);
sql(`insert into private.mcp_oauth_clients(client_id,provider,enabled,maximum_lifetime_seconds) values('${clientId}','OTHER',true,600);`);
const verifier=randomBytes(48).toString('base64url'),state=randomUUID(),callback=origin+'/oauth/callback';
const params=new URLSearchParams({client_id:clientId!,response_type:'code',redirect_uri:callback,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',scope:'openid email profile',state});
const ar=await fetch(cfg.API_URL+'/auth/v1/oauth/authorize?'+params,{redirect:'manual',headers:{apikey:cfg.ANON_KEY}});assert.equal(ar.status,302);
const authId=new URL(ar.headers.get('location')!).searchParams.get('authorization_id'),d=await a.client.auth.oauth.getAuthorizationDetails(authId);assert.equal(d.error,null);
let redirect=d.data.redirect_url;if(!redirect){const consent=await a.client.auth.oauth.approveAuthorization(authId,{skipBrowserRedirect:true});assert.equal(consent.error,null);redirect=consent.data.redirect_url;}
const location=new URL(redirect);assert.equal(location.searchParams.get('state'),state);
const exchange=await fetch(cfg.API_URL+'/auth/v1/oauth/token',{method:'POST',headers:{apikey:cfg.ANON_KEY,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId!,code:location.searchParams.get('code')!,redirect_uri:callback,code_verifier:verifier})});assert.equal(exchange.status,200);
const session=await exchange.json(),oauthClient=createClient(cfg.API_URL,cfg.ANON_KEY,opts);clients.push(oauthClient);assert.equal((await oauthClient.auth.setSession(session)).error,null);assert.equal((await oauthClient.auth.getUser(session.access_token)).data.user.id,a.id);
const lp='/identity/mcp/links',li={oauthClientId:clientId,expectedVersion:0,consent:true};
const link=await call('verified PKCE consent',session.access_token,lp,li,201);await roundtrip('links',session.access_token,lp,li,link);
await call('ordinary bearer cannot forge client consent',a.token,lp,li,403);
const otherLinks=await call('foreign link list positive',b.token,lp);assert.ok(!otherLinks.some((l:any)=>l.id===link.id));
await call('foreign revocation denied',b.token,lp+'/'+link.id+'/revocations',{expectedVersion:link.version,reason:'foreign'},404);
const revoked=await call('own link revocation',session.access_token,lp+'/'+link.id+'/revocations',{expectedVersion:link.version,reason:'end of local evidence'});assert.equal(revoked.status,'REVOKED');assert.ok(revoked.revokedAt);
const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
const boundary=sql(`begin;set local role authenticated;set local "request.jwt.claims"='${JSON.stringify(claims).replaceAll("'","''")}';set constraints all immediate;select jsonb_build_object('role',current_user,'subject',auth.uid());commit;`);const measured=JSON.parse(boundary.trim());assert.equal(measured.role,'authenticated');assert.equal(measured.subject,a.id);
completed=true;output('identity-result.json',{status:'PASS',cases,roundtrips:roundtrips.length,actualAuthSessions:true,actualPKCE:true,boundary:'COMMIT under authenticated with issuer-verified claims',configurationDoesNotClaimLive:true});
console.log('PASS identity evidence: '+cases.length+' HTTP cases, '+roundtrips.length+' concrete roundtrips, actual PKCE and authenticated COMMIT');
}finally{
for(const c of clients)await c.auth.signOut({scope:'local'});if(clientId)sql(`update private.mcp_oauth_clients set enabled=false where client_id='${clientId}';`);
await new Promise<void>(resolve=>server.close(()=>resolve()));
if(!completed)output('identity-result.json',{status:'FAIL',cases,roundtrips:roundtrips.length});
}
