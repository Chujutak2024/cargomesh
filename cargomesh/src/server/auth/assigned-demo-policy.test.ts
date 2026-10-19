import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedDemoAllowed,createAssignedDemoHandler,syntheticDemoEmail,syntheticCarrierAccess} from './assigned-demo-policy';
const origin='https://demo.example.test';
const config={enabled:true,origin,secret:'demo-test-secret-at-least-thirty-two-characters',carrierEmail:'hac45-demo@example.invalid',carrierPassword:'test-only-not-a-real-secret'};
function request(body:unknown={workspace:'carrier'},headers:Record<string,string>={}){return new Request(origin+'/api/auth/demo-session',{method:'POST',headers:{host:'demo.example.test',origin,'content-type':'application/json','sec-fetch-site':'same-origin',...headers},body:JSON.stringify(body)});}
test('automatic entry is opt-in, exact HTTPS origin and strong session secret',()=>{
 assert.equal(assignedDemoAllowed(config,'demo.example.test'),true);
 for(const delta of [{enabled:false},{secret:''},{secret:'short'},{origin:'http://demo.example.test'},{origin:origin+'/path'},{origin:'https://user:pass@demo.example.test'}])assert.equal(assignedDemoAllowed({...config,...delta},'demo.example.test'),false);
 for(const host of [null,'other.example.test','demo.example.test.evil','demo.example.test:8080'])assert.equal(assignedDemoAllowed(config,host),false);
});
test('cross-origin, missing origin, disabled hosts and GET never call authentication',async()=>{
 let calls=0;const deps={startClient:async()=>{calls++;},startCarrier:async()=>{calls++;return true;}};
 const handler=createAssignedDemoHandler(config,deps);
 for(const req of [request(undefined,{origin:'https://evil.test'}),request(undefined,{'sec-fetch-site':'cross-site'}),request(undefined,{origin:''}),new Request(origin+'/api/auth/demo-session',{headers:{host:'demo.example.test',origin}})])assert.equal((await handler(req)).status,403);
 assert.equal((await createAssignedDemoHandler({...config,enabled:false},deps)(request())).status,404);
 assert.equal((await handler(request(undefined,{host:'other.test'}))).status,404);
 assert.equal(calls,0);
});
test('only the fixed workspace choice is accepted, never client credentials or redirects',async()=>{
 let calls=0;const handler=createAssignedDemoHandler(config,{startClient:async()=>{calls++;},startCarrier:async()=>{calls++;return true;}});
 for(const body of [null,{},[],{workspace:'admin'},{workspace:'carrier',email:'other@test.invalid'},{workspace:'client',destination:'https://evil.test'}])assert.equal((await handler(request(body))).status,400);
 assert.equal(calls,0);
});
test('Carrier login uses only server-configured credentials and never returns them',async()=>{
 const handler=createAssignedDemoHandler(config,{startClient:async()=>{assert.fail('wrong workspace');},startCarrier:async(email,password)=>{assert.equal(email,config.carrierEmail);assert.equal(password,config.carrierPassword);return true;}});
 const response=await handler(request());assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control')! ,/no-store/);
 assert.deepEqual(await response.json(),{ok:true,destination:'/carriers'});
});
test('Client assigns a visual profile without invoking Supabase login',async()=>{
 let assigned=0;const handler=createAssignedDemoHandler(config,{startClient:async secret=>{assert.equal(secret,config.secret);assigned++;},startCarrier:async()=>{assert.fail('no Carrier login');}});
 assert.deepEqual(await (await handler(request({workspace:'client'}))).json(),{ok:true,destination:'/clients'});assert.equal(assigned,1);
});
test('missing or real-account credentials fail closed',async()=>{
 let calls=0;const deps={startClient:async()=>{},startCarrier:async()=>{calls++;return true;}};
 for(const delta of [{carrierPassword:''},{carrierEmail:'person@example.com'},{carrierEmail:'admin@example.invalid'}])assert.equal((await createAssignedDemoHandler({...config,...delta},deps)(request())).status,503);
 assert.equal(calls,0);
});
test('failed auth or unavailable backend never produces a successful session response',async()=>{
 for(const startCarrier of [async()=>false,async()=>{throw Error('private backend diagnostic');}]){
  const res=await createAssignedDemoHandler(config,{startClient:async()=>{},startCarrier})(request());assert.equal(res.status,503);assert.doesNotMatch(await res.text(),/private backend diagnostic/);
 }
});
test('only named synthetic carriers can become the predefined Carrier session',()=>{
 assert.ok(syntheticDemoEmail(config.carrierEmail));assert.ok(syntheticCarrierAccess([{carrierName:'[SYNTHETIC] Test road'}]));
 for(const value of [null,[],[{}],[{carrierName:'Real customer carrier'}],[{carrierName:'[SYNTHETIC] Test'},{carrierName:'Real carrier'}]])assert.equal(syntheticCarrierAccess(value),false);
});
