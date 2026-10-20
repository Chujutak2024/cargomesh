// Explicit local-only access bootstrap and focused HTTP read checks. Never a runtime fallback or hosted provisioner.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {refreshRequestCommercial} from '../src/features/shipper-portal/shipper-commercial-client.ts';
import {inspectOffer,inspectRankedOption} from '../src/features/shipper-portal/commercial-context.ts';

const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');
const app=new URL(process.env.HAC54_LOCAL_APP_URL??'http://localhost:3000');
assert.equal(api.origin,'http://127.0.0.1:61321','Only the existing cargomesh-v2-local API is allowed.');
assert.ok(['localhost','127.0.0.1'].includes(app.hostname)&&app.protocol==='http:'&&!app.username&&!app.password,'Loopback HTTP app required.');
const info=JSON.parse(execFileSync('docker',['inspect','supabase_kong_cargomesh-v2-local'],{encoding:'utf8'}))[0];
assert.ok(info.State.Running&&info.NetworkSettings.Ports['8000/tcp'].some(p=>p.HostPort==='61321'),'Expected local gateway must be running.');
assert.ok(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Local anon key required.');
const clientEmail='qa-v2-a@cargomesh.test',carrierEmail='hac54.carrier.local@cargomesh.test';
const carrierId='c2340000-0000-4000-8000-000000000001';
const clientPassword=process.env.HAC54_LOCAL_CLIENT_PASSWORD;
const carrierPassword=process.env.HAC54_LOCAL_CARRIER_PASSWORD;
assert.ok(clientPassword&&carrierPassword&&carrierPassword.length>=16,'Supply local test passwords in process environment; never commit them.');
const makeClient=()=>createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const customer=makeClient(),carrier=makeClient();
const customerLogin=await customer.auth.signInWithPassword({email:clientEmail,password:clientPassword});
assert.equal(customerLogin.error,null,'Existing synthetic Client credentials must work; this script never resets them.');
let carrierLogin=await carrier.auth.signInWithPassword({email:carrierEmail,password:carrierPassword});
if(carrierLogin.error){
  // Signup uses real local Auth; auto-confirm is a local stack setting, not an application bypass.
  const signup=await carrier.auth.signUp({email:carrierEmail,password:carrierPassword,options:{data:{fixture:'HAC54 LOCAL_ONLY synthetic Carrier operator'}}});
  assert.equal(signup.error,null,'Signup failed; an existing account with another password will not be overwritten.');
  carrierLogin=await carrier.auth.signInWithPassword({email:carrierEmail,password:carrierPassword});
}
assert.equal(carrierLogin.error,null,'Local synthetic Carrier login must work.');
const user=await carrier.auth.getUser();assert.equal(user.error,null);assert.ok(user.data.user.email_confirmed_at,'Local Auth must confirm this synthetic account.');
const seed=readFileSync(fileURLToPath(new URL('../../supabase/scenarios/v2-hac54-local-access/seed.sql',import.meta.url)),'utf8');
execFileSync('docker',['exec','-i','supabase_db_cargomesh-v2-local','psql','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1','-v','local_only=1','-v',`operator_auth_id=${user.data.user.id}`],{input:seed,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const access=await carrier.rpc('read_v2_carrier_portal_access');assert.equal(access.error,null);
assert.ok(access.data.some(row=>row.carrierId===carrierId&&row.role==='OPERATOR'));
const customerAccess=await customer.rpc('read_v2_carrier_portal_access');assert.equal(customerAccess.error,null);assert.deepEqual(customerAccess.data,[],'Client membership must not imply Carrier authority.');
const tokens={customer:customerLogin.data.session.access_token,carrier:carrierLogin.data.session.access_token};
async function call(path,actor){
  const res=await fetch(new URL('/api/v2'+path,app),{redirect:'manual',signal:AbortSignal.timeout(45_000),headers:actor?{Authorization:`Bearer ${tokens[actor]}`}:{}});
  const body=await res.json().catch(()=>null);return{status:res.status,body};
}
const requests=await call('/freight/requests?limit=100&offset=0','customer');assert.equal(requests.status,200,JSON.stringify(requests.body));
const opportunities=await call(`/carriers/${carrierId}/opportunities?limit=100&offset=0`,'carrier');assert.equal(opportunities.status,200,JSON.stringify(opportunities.body));
const denied=await call(`/carriers/${carrierId}/opportunities?limit=100&offset=0`,'customer');assert.equal(denied.status,403);
const anonymous=await call('/freight/requests?limit=1&offset=0');assert.equal(anonymous.status,401);
const nonMember=await call('/freight/requests?limit=1&offset=0','carrier');assert.equal(nonMember.status,403);
const correlated=[];
for(const opportunity of opportunities.body.data){
  const req=await call(`/freight/requests/${opportunity.requestId}`,'customer');assert.equal(req.status,200);
  const customerOffers=await call(`/freight/requests/${opportunity.requestId}/offers?limit=100&offset=0`,'customer');assert.equal(customerOffers.status,200);
  const carrierOffers=await call(`/carriers/${carrierId}/offers?limit=100&offset=0`,'carrier');assert.equal(carrierOffers.status,200);
  const ids=customerOffers.body.data.filter(row=>row.carrierId===carrierId&&row.data.opportunityId===opportunity.id).map(row=>row.id);
  assert.ok(ids.every(id=>carrierOffers.body.data.some(row=>row.id===id&&row.requestId===req.body.data.id)));
  correlated.push({requestId:req.body.data.id,reference:req.body.data.referenceCode,opportunityId:opportunity.id,offerIds:ids});
}
const commercialReads=[];
for(const item of correlated){
  const original=requests.body.data.find(row=>row.id===item.requestId);assert.ok(original);
  const fresh=await refreshRequestCommercial(item.requestId,original.organizationId,AbortSignal.timeout(45_000),(path,init)=>fetch(new URL(String(path),app),{...init,headers:{...init?.headers,Authorization:`Bearer ${tokens.customer}`}}));
  const context={request:fresh.request,offers:fresh.workflow.offers,opportunities:fresh.workflow.opportunities,plans:fresh.workflow.plans,
    ranking:[...fresh.workflow.ranking].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]??null};
  const inspected=context.offers.map(row=>({offerId:row.id,...inspectOffer(row,context)}));
  assert.ok(inspected.every(row=>row.linked),'Actual native offer/request/plan/opportunity references must correlate.');
  commercialReads.push({requestId:item.requestId,catalogCarrierName:fresh.catalog.carriers[carrierId]?.name,
    offers:inspected.map(row=>({offerId:row.offerId,linked:row.linked,current:row.current,reasons:row.reasons})),
    rankedOptions:context.ranking?.data.options.map(option=>({position:option.position,...inspectRankedOption(option,context)}))??[]});
}
async function page(actor,path){
  const jar=new Map(),client=createServerClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
  const session=actor==='customer'?customerLogin.data.session:carrierLogin.data.session;
  const set=await client.auth.setSession(session);assert.equal(set.error,null);
  const res=await fetch(new URL(path,app),{redirect:'manual',signal:AbortSignal.timeout(45_000),headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}});
  assert.equal(res.status,200,`${actor} page must open without a login redirect`);
  const html=await res.text();assert.ok(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'));
  const detail=path.startsWith('/clients/requests/');
  if(detail)assert.ok(html.includes('id="commercial-title"'),'Current H2 comparison must render in the authenticated detail.');
  return {path,status:res.status,...(detail?{commercialComparisonRendered:true}:{})};
}
const pages=[await page('customer','/clients/requests'),await page('carrier','/carriers/requests')];
if(correlated[0])pages.push(await page('customer',`/clients/requests/${correlated[0].requestId}`));
console.log(JSON.stringify({localOnly:true,app:app.origin,api:api.origin,clientEmail,carrierEmail,carrierId,operatorRole:'OPERATOR',
  requestReadStatus:requests.status,requestCount:requests.body.data.length,opportunityReadStatus:opportunities.status,opportunityCount:opportunities.body.data.length,
  anonymousStatus:anonymous.status,clientCannotActAsCarrierStatus:denied.status,carrierCannotActAsClientStatus:nonMember.status,pages,correlated,commercialReads},null,2));
// No global sign-out: it would revoke other local browser sessions. Tokens live only in this process.
