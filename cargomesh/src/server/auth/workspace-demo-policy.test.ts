import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceDemoHandler,workspaceDemoAllowed,automaticDemoIdentity,type WorkspaceDemoConfig} from './workspace-demo-policy';
const origin='http://127.0.0.1:8080',organization='c2300000-0000-4000-8000-000000000001';
const config:WorkspaceDemoConfig={mode:'local',production:false,origin,supabaseUrl:'http://127.0.0.1:61321',
 client:{email:'qa-v2-a@cargomesh.test',password:'private-test-client'},carrier:{email:'hac54.carrier.local@cargomesh.test',password:'private-test-carrier'},clientOrganizationId:organization};
const request=(body:unknown={workspace:'client'},extra:Record<string,string>={})=>new Request(origin+'/api/auth/workspace-session',{
 method:'POST',headers:{host:'127.0.0.1:8080',origin,'content-type':'application/json','sec-fetch-site':'same-origin',...extra},body:JSON.stringify(body)});
test('local switching is explicit, nonproduction, exact loopback8080 and a local Supabase only',()=>{
 assert.equal(workspaceDemoAllowed(config,'127.0.0.1:8080'),true);
 for(const override of [{mode:'disabled' as const},{production:true},{origin:'http://127.0.0.1:3000'},
  {origin:'https://127.0.0.1:8080'},{origin:'http://user:pw@127.0.0.1:8080'},{origin:origin+'/path'},
  {supabaseUrl:'https://project.supabase.co'},{supabaseUrl:'http://user:pw@127.0.0.1:61321'}])assert.equal(workspaceDemoAllowed({...config,...override},'127.0.0.1:8080'),false);
 for(const host of ['localhost:8080','evil.test','127.0.0.1:8080.evil',null])assert.equal(workspaceDemoAllowed(config,host),false);
});

test('automatic entry is only anonymous or an exact configured synthetic identity, never real/phone-only/unrelated users',()=>{
 assert.equal(automaticDemoIdentity(config,null),true);
 for(const account of [config.client!,config.carrier!])assert.equal(automaticDemoIdentity(config,{email:account.email}),true);
 for(const user of [{},{email:''},{email:'real@company.com'},{email:'qa-v2-unrelated@cargomesh.test'}])assert.equal(automaticDemoIdentity(config,user),false);
 assert.equal(automaticDemoIdentity({carrier:config.carrier},{}),false);
 assert.equal(automaticDemoIdentity({client:{email:'real@company.com',password:'not-used'}},{email:'real@company.com'}),false);
});
test('CSRF, missing origin, GET and arbitrary workspace/credentials/redirects never call Auth',async()=>{
 let calls=0;const handler=createWorkspaceDemoHandler(config,{start:async()=>{calls++;return true;},preview:async()=>assert.fail('no local preview')});
 for(const req of [request(undefined,{origin:'https://evil.test'}),request(undefined,{origin:''}),request(undefined,{'sec-fetch-site':'cross-site'}),
  new Request(origin+'/api/auth/workspace-session',{headers:{host:'127.0.0.1:8080',origin}})])assert.equal((await handler(req)).status,403);
 for(const body of [null,{},[],{workspace:'owner'},{workspace:'client',email:'other@example.invalid'},{workspace:'carrier',returnTo:'https://evil.test'}])assert.equal((await handler(request(body))).status,400);
 assert.equal(calls,0);
});
test('both workspaces use only fixed server credentials and exact destinations, no secrets in response',async()=>{
 for(const workspace of ['client','carrier'] as const){
  const handler=createWorkspaceDemoHandler(config,{start:async(actual,account,org)=>{assert.equal(actual,workspace);assert.deepEqual(account,config[workspace]);assert.equal(org,organization);return true;},preview:async()=>assert.fail('no fixture fallback')});
  const result=await handler(request({workspace}));assert.equal(result.status,200);assert.match(result.headers.get('cache-control')!,/no-store/);
  assert.deepEqual(await result.json(),{ok:true,destination:workspace==='client'?'/clients':'/carriers'});
 }
});
test('failed account, scope or network validation never returns a success or preview fallback',async()=>{
 for(const start of [async()=>false,async()=>{throw Error('private backend detail');}]){
  const result=await createWorkspaceDemoHandler(config,{start,preview:async()=>assert.fail('no fallback')})(request());
  assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private backend detail|private-test/);
 }
 for(const delta of [{client:undefined},{client:{email:'real@company.com',password:'secret'}},{clientOrganizationId:'invalid'}]){
  const handler=createWorkspaceDemoHandler({...config,...delta},{start:async()=>assert.fail('no login'),preview:async()=>assert.fail('no fallback')});
  assert.equal((await handler(request())).status,503);
 }
});
test('assigned hosted mode retains exact HTTPS opt-in, preview is only the explicitly configured legacy mode',async()=>{
 const hostedOrigin='https://demo.example.test',assigned={enabled:true,origin:hostedOrigin,secret:'s'.repeat(32)};
 const hosted:WorkspaceDemoConfig={mode:'assigned',production:true,origin:hostedOrigin,assigned};
 const req=new Request(hostedOrigin+'/api/auth/workspace-session',{method:'POST',headers:{host:'demo.example.test',origin:hostedOrigin},body:JSON.stringify({workspace:'client'})});
 let previews=0;const handler=createWorkspaceDemoHandler({...hosted,previewSecret:assigned.secret},{start:async()=>assert.fail('no native account configured'),preview:async()=>{previews++;}});
 assert.equal((await handler(req)).status,200);assert.equal(previews,1);
 assert.equal(workspaceDemoAllowed({...hosted,assigned:{...assigned,enabled:false}},'demo.example.test'),false);
 assert.equal(workspaceDemoAllowed({...hosted,origin:'http://demo.example.test'},'demo.example.test'),false);
});
