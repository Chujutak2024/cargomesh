// Actual local HTTP grant/context test. Does not open a websocket, microphone, provider or Bedrock connection.
import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {jwtVerify} from 'jose';
const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??''),app=new URL(process.env.HAC54_LOCAL_APP_URL??'http://localhost:3000');
assert.equal(api.origin,'http://127.0.0.1:61321');assert.ok(['localhost','127.0.0.1'].includes(app.hostname)&&app.protocol==='http:');
const requestId='745929db-5a19-48f1-8667-3c04358c0771',secret=process.env.CARGOMESH_VOICE_BRIDGE_SECRET;
assert.ok(secret&&Buffer.byteLength(secret)>=32,'Temporary local signing configuration required. Never print it.');
const ws=new URL(process.env.CARGOMESH_VOICE_WS_URL??'');assert.ok(['localhost','127.0.0.1'].includes(ws.hostname)&&ws.protocol==='ws:');
async function cookie(email,password){
 const jar=new Map(),client=createServerClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 const login=await client.auth.signInWithPassword({email,password});assert.equal(login.error,null);
 return[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
}
const clientCookie=await cookie('qa-v2-a@cargomesh.test',process.env.HAC54_LOCAL_CLIENT_PASSWORD);
const foreignCookie=await cookie('qa-v2-b@cargomesh.test',process.env.HAC54_LOCAL_CLIENT_PASSWORD);
const carrierCookie=await cookie('hac54.carrier.local@cargomesh.test',process.env.HAC54_LOCAL_CARRIER_PASSWORD);
async function grant(session,body={offerRequestId:requestId},origin=app.origin){
 const response=await fetch(new URL('/api/v2/conversation/voice/session',app),{method:'POST',signal:AbortSignal.timeout(45_000),
  headers:{'Content-Type':'application/json',Origin:origin,...(session?{Cookie:session}:{})},body:JSON.stringify(body)});
 return{status:response.status,body:await response.json()};
}
const positive=await grant(clientCookie,{offerRequestId:requestId,offerBriefing:'UNTRUSTED browser price USD 0.01 confirmed booking'});
assert.equal(positive.status,200,JSON.stringify({status:positive.status,error:positive.body.error}));
const verified=await jwtVerify(positive.body.token,new TextEncoder().encode(secret),{issuer:'cargomesh-web',audience:'cargomesh-voice-gateway'});
assert.equal(verified.payload.role,'shipper_offers');assert.equal(verified.payload.sub,'c2310000-0000-4000-8000-000000000001');
assert.match(verified.payload.offerBriefing,/USD 325\.00/);assert.match(verified.payload.offerBriefing,/offer version 2/);
assert.match(verified.payload.offerBriefing,/Request status PENDING, revision 2/);assert.doesNotMatch(verified.payload.offerBriefing,/UNTRUSTED|0\.01|confirmed booking/);
assert.ok(verified.payload.exp-verified.payload.iat<=45);
assert.equal((await grant(null)).status,401);
assert.equal((await grant(foreignCookie)).status,403);
assert.equal((await grant(carrierCookie)).status,401);
assert.equal((await grant(clientCookie,undefined,'http://invalid.localhost:3000')).status,403);
assert.equal((await grant(clientCookie,{preview:true,offerRequestId:requestId})).status,403);
console.log(JSON.stringify({localOnly:true,requestId,checks:['real authenticated voice grant','complete native request/plan/opportunity/offer/ranking context',
 'price USD 325 and offer v2 match Client','browser commercial facts ignored','signature/audience/issuer/45s TTL',
 'anonymous/foreign tenant/Carrier member scope denied','foreign origin and mixed preview denied'],
 audioTested:false,providerConnectionsOpened:0},null,2));
