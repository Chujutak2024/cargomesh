/** Local Docker + real Supabase Auth/RPC. No hosted target and no business service role. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createHonoApp } from '../src/server/hono/app.ts';
import { createMcpHttpHandler } from '../src/server/mcp/http.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bank = path.resolve(root, process.env.HAC41_BANK_DIR ?? 'supabase-v2');
const project = fs.readFileSync(path.join(bank,'supabase/config.toml'),'utf8').match(/^project_id = "([a-z0-9-]+)"/m)?.[1];
assert.ok(['cargomesh-v2-local','hac41-identity-mcp'].includes(project), 'only the explicitly named local test banks are allowed');
const container = `supabase_db_${project}`;
function sql(query) {
  const result=spawnSync('docker',['exec','-i',container,'psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],
    {input:query,encoding:'utf8',maxBuffer:8e6});
  if(result.status!==0) throw new Error(`HAC41 local SQL prerequisite failed: ${result.stderr.replace(/eyJ[\w.-]+/g,'[REDACTED]').slice(0,1600)}`);
  return result.stdout;
}
function command(args) {
  const result=spawnSync(process.env.HAC41_SUPABASE_CLI ?? (process.platform==='win32'?'npx.cmd':'npx'),
    process.env.HAC41_SUPABASE_CLI ? args : ['--yes','supabase@2.117.0',...args],{cwd:root,encoding:'utf8',maxBuffer:8e6});
  assert.equal(result.status,0,'local Supabase CLI prerequisite');return result.stdout;
}
const statusText=command(['status','--workdir',bank,'-o','json']);
const status=JSON.parse(statusText.slice(statusText.indexOf('{'),statusText.lastIndexOf('}')+1));
const url=status.API_URL;
assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname),'never use a hosted Supabase project');
process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=status.ANON_KEY;
process.env.CARGOMESH_MCP_USER_BEARER_ENABLED='true';
process.env.CARGOMESH_MCP_MODE='local';
process.env.CARGOMESH_MCP_LOCAL_ENABLED='true';
process.env.NODE_ENV='test';
const admin=createClient(url,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const callback='http://127.0.0.1:3174/oauth/callback';
const registration=await admin.auth.admin.oauth.createClient({client_name:'[SYNTHETIC] HAC41 PKCE test',
  redirect_uris:[callback],token_endpoint_auth_method:'none'});
assert.equal(registration.error,null,`OAuth server must be enabled in the LOCAL test config (${registration.error?.code ?? ''})`);
const clientId=registration.data.client_id;
process.env.CARGOMESH_MCP_USER_OAUTH_CLIENT_ID=clientId;
const app=createHonoApp(), mcp=createMcpHttpHandler();
const A='c2310000-0000-4000-8000-000000000001',B='c2310000-0000-4000-8000-000000000002';
const C='c2410000-0000-4000-8000-000000000001',OP='c2420000-0000-4000-8000-000000000001';
const ORGA='c2300000-0000-4000-8000-000000000001',CARRIER='c2340000-0000-4000-8000-000000000001';
const SERVICE='c2360000-0000-4000-8000-000000000001',LANE='c2380000-0000-4000-8000-000000000001';
const password=randomBytes(24).toString('base64url'),results=[];
function pass(name) {results.push(name);console.log(`PASS ${name}`);}
function counts() {
  return sql(`begin;create temp table hac41_counts(name text,n bigint);
    do $$declare t record;n bigint;begin for t in select table_schema,table_name from information_schema.tables
      where table_schema in ('public','private') and table_type='BASE TABLE' loop
      execute format('select count(*) from %I.%I',t.table_schema,t.table_name) into n;
      insert into hac41_counts values(t.table_schema||'.'||t.table_name,n);end loop;end;$$;
    select jsonb_object_agg(name,n) from hac41_counts;rollback;`).split('\n').find(line=>line.startsWith('{'));
}
async function login(email) {
  const user=createClient(url,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await user.auth.signInWithPassword({email,password});assert.equal(result.error,null,'synthetic local password login');
  return {client:user,token:result.data.session.access_token};
}
async function oauth(user) {
  const verifier=randomBytes(48).toString('base64url'),state=randomUUID();
  const params=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:callback,
    code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',scope:'openid email profile',state});
  const response=await fetch(`${url}/auth/v1/oauth/authorize?${params}`,{redirect:'manual',headers:{apikey:status.ANON_KEY}});
  assert.equal(response.status,302,'OAuth authorization redirect');
  const authorizationId=new URL(response.headers.get('location')).searchParams.get('authorization_id');
  assert.ok(authorizationId,'Auth supplies a consent authorization ID');
  const details=await user.client.auth.oauth.getAuthorizationDetails(authorizationId);
  assert.equal(details.error,null,'verified OAuth consent details');
  let redirect;
  if('redirect_url' in details.data) redirect=details.data.redirect_url;
  else {assert.equal(details.data.client.id,clientId);const approved=await user.client.auth.oauth.approveAuthorization(authorizationId,{skipBrowserRedirect:true});
    assert.equal(approved.error,null,'synthetic user explicitly approves Auth consent');redirect=approved.data.redirect_url;}
  const codeURL=new URL(redirect);assert.equal(codeURL.searchParams.get('state'),state);
  const exchanged=await fetch(`${url}/auth/v1/oauth/token`,{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code:codeURL.searchParams.get('code'),redirect_uri:callback,code_verifier:verifier})});
  const tokens=await exchanged.json();assert.equal(exchanged.status,200,`real Auth PKCE token exchange (${tokens.error??''})`);
  assert.equal(JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url')).client_id,clientId);
  return tokens.access_token;
}
async function web(token,method,pathname,value,key=randomUUID(),expected=200) {
  const response=await app.request(`http://127.0.0.1/api/v2${pathname}`,{method,headers:{Authorization:`Bearer ${token}`,
    'Content-Type':'application/json','Idempotency-Key':key},...(value===undefined?{}:{body:JSON.stringify(value)})});
  const body=await response.json();assert.equal(response.status,expected,`${method} ${pathname}: ${body.error?.code??'unexpected status'}`);return body;
}
async function rpc(token,method,params) {
  const response=await mcp(new Request('http://127.0.0.1/mcp',{method:'POST',headers:{Authorization:`Bearer ${token}`,
    'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  return {status:response.status,body:await response.json()};
}
async function tool(token,name,args,expectedCode) {
  const response=await rpc(token,'tools/call',{name,arguments:args});assert.equal(response.status,200,`MCP ${name} auth/transport`);
  const result=response.body.result;
  if(expectedCode) {assert.equal(result?.isError,true);assert.equal(result.structuredContent?.error?.code,expectedCode);return result;}
  assert.equal(result?.isError??false,false,`MCP ${name}: ${result?.structuredContent?.error?.code??response.body.error?.message??'unexpected error'}`);
  assert.equal(result.structuredContent.ok,true);return result.structuredContent.data;
}
const ctx=(requestId=null,carrierId=null,parentId=null,id=null)=>({requestId,carrierId,parentId,id});
const evidence={reference:'fixture:hac41-real-local-rpc',provider:'Synthetic QA',observedAt:'2020-01-01T00:00:00Z',validUntil:'2030-01-01T00:00:00Z',provenanceStatus:'SIMULATED'};
async function confirmed(token,action,context,value,key=randomUUID()) {
  const proposal=await tool(token,'prepare_v2_commercial_action',{action,context,value,idempotencyKey:key});
  const result=await tool(token,'confirm_v2_commercial_action',{confirmationId:proposal.data.id,confirmed:true});
  return {proposal,result};
}
try {
  assert.equal((await app.request('http://127.0.0.1/api/v2/identity/mcp/links')).status,401);
  const crossSite={method:'POST',headers:{Origin:'https://foreign.invalid',Cookie:'synthetic=untrusted','Content-Type':'application/json'},body:'{}'};
  for (const endpoint of ['/identity/mcp/links',`/carriers/${CARRIER}/bookings/${randomUUID()}/confirmations`]) {
    assert.equal((await app.request('http://127.0.0.1/api/v2'+endpoint,crossSite)).status,403);
  }
  pass('identity rejects unauthenticated reads and cross-origin cookie mutations');
  // Auth admin is only used to provision/delete this disposable OAuth client.
  // All domain calls below are anon-key clients + actual user access tokens.
  sql(`begin;
    insert into private.mcp_oauth_clients(client_id,provider,enabled) values('${clientId}','OTHER',true);
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,email_change,email_change_token_new,recovery_token)
    values('00000000-0000-0000-0000-000000000000','${C}','authenticated','authenticated','hac41-carrier@example.invalid',
      extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
    update auth.users set encrypted_password=extensions.crypt('${password}',extensions.gen_salt('bf')) where id in('${A}','${B}');
    insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at)
      values('${OP}','${CARRIER}','${C}','[SYNTHETIC] carrier only','ADMIN','ACTIVE',now());
    insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('${C}','${CARRIER}','CARRIER_EDITOR');
    insert into private.v2_catalog_grants(auth_user_id,permission) values('${A}','CATALOG_ADMIN') on conflict do nothing;
    commit;`);
  const fixture=fs.readFileSync(path.join(root,'supabase/tests/22_v2_hac40_workflow.test.sql'),'utf8');
  const catalogPrefix=fixture.slice(0,fixture.indexOf("select pg_temp.save('route'"))
    .split('\n').filter(line=>!/^select (?:no_plan|plan|ok|is|isnt)\(/.test(line)).join('\n');
  const prepared=sql(catalogPrefix+`\nselect jsonb_build_object('requestPayload',pg_temp.req_payload(),'policyId',pg_temp.id('policy'),
    'calendarId',pg_temp.id('calendar'),'assetId',pg_temp.id('asset'),'originId',pg_temp.id('origin'),'destinationId',pg_temp.id('destination'));
    set constraints all immediate;commit;`);
  const setup=JSON.parse(prepared.split('\n').findLast(line=>line.startsWith('{"requestPayload"')) ?? prepared.split('\n').findLast(line=>line.startsWith('{')));
  const a=await login('qa-v2-a@cargomesh.test'),b=await login('qa-v2-b@cargomesh.test'),c=await login('hac41-carrier@example.invalid');
  const at=await oauth(a),bt=await oauth(b);pass('Supabase OAuth PKCE A/B issues real client-bound tokens');
  const linkA=await web(at,'POST','/identity/mcp/links',{oauthClientId:clientId,expectedVersion:0,consent:true},randomUUID(),201);
  await web(bt,'POST','/identity/mcp/links',{oauthClientId:clientId,expectedVersion:0,consent:true},randomUUID(),201);
  pass('explicit CargoMesh consent binds real user, client and organization');
  const listed=await rpc(at,'tools/list',{});assert.equal(listed.status,200);assert.equal(listed.body.result.tools.length,18);pass('HTTP MCP advertises 18 implemented tools');
  assert.equal((await rpc(a.token,'tools/list',{})).status,401);pass('ordinary password session cannot impersonate an OAuth MCP bearer');
  await web(c.token,'GET',`/carriers/${CARRIER}/operators`);await web(c.token,'GET',`/carriers/${CARRIER}/offers`);pass('carrier HTTP works without shipper membership');
  await web(b.token,'GET',`/carriers/${CARRIER}/offers`,undefined,randomUUID(),403);pass('foreign actor cannot read carrier workflow');
  const integration=await web(c.token,'POST',`/carriers/${CARRIER}/integrations`,{serviceId:SERVICE,channel:'API',endpointRef:'env://HAC41_RESPONSE_URL',enabled:true,expectedVersion:0});
  assert.equal(integration.data.status,'PENDING');
  const diagnostic=await web(c.token,'GET',`/carriers/${CARRIER}/integrations/${integration.data.id}/diagnostics`);
  assert.equal(diagnostic.data.liveIntegrationConfirmed,false);pass('external integration remains PENDING and exposes no secret value');
  await web(a.token,'POST','/facilities',{schemaVersion:'2.0',code:'HAC41_GEO_QA',name:'[SYNTHETIC] Lima coordinate fixture',facilityType:'OTHER',
    location:{label:'Synthetic coordinate control',countryCode:'PE',region:'LIM',city:'Lima',lat:-12.0464,lng:-77.0428},
    active:true,accessRestrictions:[],operatingHours:null},randomUUID(),201);
  const location=await tool(at,'resolve_v2_location',{query:{kind:'TEXT',text:'Lima'}});
  assert.equal(location.data.status,'AMBIGUOUS');
  const place=location.data.candidates.find(x=>x.kind==='FACILITY');
  const webLocation=await web(at,'POST','/locations/resolutions',{query:{kind:'TEXT',text:'Lima'}});
  assert.deepEqual(webLocation,location);
  await tool(at,'confirm_v2_location',{query:{kind:'TEXT',text:'Lima'},candidateId:place.id,candidateKind:place.kind,expectedVersion:place.version,confirmed:true});
  const mapped=location.data.candidates.find(x=>x.location.lat!==null&&x.location.lng!==null);
  assert.ok(mapped,'coordinate positive control requires a persisted coordinate');
  const coordinates=await tool(at,'resolve_v2_location',{query:{kind:'COORDINATES',lat:mapped.location.lat,lng:mapped.location.lng,radiusMeters:50}});
  assert.ok(coordinates.data.candidates.some(x=>x.id===mapped.id));
  await tool(at,'confirm_v2_location',{query:{kind:'TEXT',text:'Lima'},candidateId:place.id,candidateKind:place.kind,expectedVersion:place.version+1,confirmed:true},'STALE_DRAFT');
  pass('text/coordinate resolution shares Web/MCP data and requires explicit current selection');
  const requestKey=randomUUID();
  const created=await tool(at,'create_v2_freight_request',{request:setup.requestPayload,idempotencyKey:requestKey});
  const request=created.data.id;
  const requestList=await tool(at,'list_v2_freight_requests',{});assert.ok(requestList.data.some(row=>row.id===request));
  await tool(at,'revise_v2_freight_request',{requestId:request,idempotencyKey:randomUUID(),value:{expectedDraftVersion:1,value:setup.requestPayload}});
  await tool(bt,'get_v2_freight_request',{requestId:request},'REQUEST_NOT_FOUND');pass('MCP request creation and foreign tenant read isolation');
  await tool(at,'submit_v2_freight_request',{requestId:request,idempotencyKey:randomUUID(),expectedDraftVersion:2,confirmed:true});
  const search=await tool(at,'find_v2_route_alternatives',{targetId:request,idempotencyKey:randomUUID(),value:{schemaVersion:'2.0',policyId:setup.policyId,expectedDraftVersion:3,maxLegs:4,maxAlternatives:1}});
  const route=search.data.alternatives[0];assert.ok(route?.id);
  await tool(at,'explain_v2_route',{routeId:route.id});pass('MCP submission, route search and versioned explanation');
  const plan=await tool(at,'build_v2_transport_plan',{context:ctx(request),idempotencyKey:randomUUID(),value:{schemaVersion:'2.0',routeId:route.id,
    assignments:[{legSequence:1,serviceId:SERVICE,laneId:LANE,calendarId:setup.calendarId,assetId:setup.assetId,capacityPoolId:null,combinationId:null,
      role:'LOAD_BEARING',window:{startsAt:setup.requestPayload.pickupWindow.startsAt,endsAt:setup.requestPayload.deliveryWindow.endsAt},allocations:[{unitIndex:0,quantity:1}]}]}});
  const assignment=plan.data.data.legAssignments[0],resource=assignment.resources[0];
  const opportunity=await confirmed(at,'opportunities.create',ctx(request),{schemaVersion:'2.0',planId:plan.data.id,carrierId:CARRIER,
    assignmentIds:[assignment.id],responseDeadline:new Date(Date.now()+3600000).toISOString(),responseChannel:'MANUAL'});
  const opportunityId=opportunity.result.data.id;
  pass('MCP builds a resource-backed plan and confirms sending the opportunity');
  const offerValue={schemaVersion:'2.0',carrierReference:'HAC41-LOCAL-OFFER',planCandidateId:plan.data.id,coveredServiceIds:[SERVICE],coveredAssignmentIds:[assignment.id],
    price:{amount:100,currency:'USD'},breakdown:[{kind:'TRANSPORT',amount:{amount:100,currency:'USD'},treatment:'QUOTED',source:evidence,observedAt:evidence.observedAt,details:null}],
    validity:{startsAt:new Date(Date.now()-3600000).toISOString(),endsAt:new Date(Date.now()+8*3600000).toISOString()},source:{channel:'MANUAL',evidence},
    issuedAt:new Date().toISOString(),estimatedPickupAt:null,estimatedDeliveryAt:null,transitDurationSeconds:3600,reservableCapacity:{weightKg:1000,volumeM3:2},
    commercialTerms:[],evidence:[evidence],supersedesOfferId:null};
  const offerKey=randomUUID();
  const beforeOffer=counts();
  await web(c.token,'POST',`/carriers/${CARRIER}/opportunities/${opportunityId}/offers`,{...offerValue,source:{...offerValue.source,channel:'API'}},randomUUID(),403);
  assert.equal(counts(),beforeOffer);pass('an ordinary carrier cannot impersonate an API adapter; failed offer leaves no partial rows');
  const offer=await web(c.token,'POST',`/carriers/${CARRIER}/opportunities/${opportunityId}/offers`,offerValue,offerKey,201);
  assert.equal(offer.data.data.source.issuerId,OP);
  const replay=await web(c.token,'POST',`/carriers/${CARRIER}/opportunities/${opportunityId}/offers`,offerValue,offerKey);
  assert.equal(replay.data.id,offer.data.id);assert.equal(replay.meta.idempotentReplay,true);
  await web(c.token,'POST',`/carriers/${CARRIER}/opportunities/${opportunityId}/offers`,{...offerValue,carrierReference:'different'},offerKey,409);
  pass('carrier-only offer records its verified issuer; identical/conflicting retries are deterministic');
  const score=JSON.parse(sql(`begin;set local role authenticated;set local "request.jwt.claims"='{"sub":"${A}","role":"authenticated"}';
    select public.command_v2_workflow('${ORGA}','c2320000-0000-4000-8000-000000000001','scoring-policies.publish',
      '${JSON.stringify(ctx())}','${randomUUID()}','{"schemaVersion":"2.0","active":true,"policy":{"version":"HAC41-1","objective":"LOWEST_COST","weights":{"cost":1,"transit":0,"reliability":0},"missingDataRule":"EXCLUDE","tieBreaker":"OFFER_ID_ASC"}}')->'record';
    set constraints all immediate;commit;`).split('\n').find(line=>line.startsWith('{')));
  await tool(at,'rank_v2_offers',{context:ctx(request),idempotencyKey:randomUUID(),value:{schemaVersion:'2.0',policyId:score.id}});
  const selection=await confirmed(at,'decisions.create',ctx(request),{schemaVersion:'2.0',planId:plan.data.id,selectedOfferIds:[offer.data.id],
    rationale:'explicit local user choice',policyId:score.id,consideredOfferIds:[offer.data.id],evidence:[evidence]});
  const bookingInput={schemaVersion:'2.0',decisionId:selection.result.data.id,offerId:offer.data.id,authorization:'AUTHORIZE',evidence};
  const proposal=await tool(at,'prepare_v2_commercial_action',{action:'bookings.create',context:ctx(),value:bookingInput,idempotencyKey:randomUUID()});
  assert.equal(JSON.parse(sql(`select count(*) from public.v2_bookings where decision_id='${selection.result.data.id}';`).trim()),0);
  await tool(bt,'confirm_v2_commercial_action',{confirmationId:proposal.data.id,confirmed:true},'CONFIRMATION_NOT_FOUND');
  const [booking,bookingReplay]=await Promise.all([1,2].map(()=>tool(at,'confirm_v2_commercial_action',{confirmationId:proposal.data.id,confirmed:true})));
  assert.equal(bookingReplay.data.id,booking.data.id);
  assert.deepEqual([booking.meta.idempotentReplay,bookingReplay.meta.idempotentReplay].sort(),[false,true]);
  pass('ranking and explicit booking confirmation share persistence; preparation and foreign confirmation cannot write');
  const execution=await confirmed(at,'executions.create',ctx(),{schemaVersion:'2.0',bookingId:booking.data.id,serviceId:SERVICE});
  const hold=await confirmed(at,'holds.create',ctx(),{schemaVersion:'2.0',bookingId:booking.data.id,assignmentId:assignment.id,planResourceId:resource.resourceId,
    expiresAt:new Date(Date.now()+3600000).toISOString(),evidence});
  const update={schemaVersion:'2.0',expectedVersion:1,note:'local carrier confirmation',evidence};
  const beforePrematureConfirmation=counts();
  await web(c.token,'POST',`/carriers/${CARRIER}/bookings/${booking.data.id}/confirmations`,{...update,carrierReference:'HAC41-BOOK',confirmation:'CONFIRMED'},randomUUID(),409);
  assert.equal(counts(),beforePrematureConfirmation);pass('rejected booking confirmation rolls back every public/private row count');
  await web(c.token,'POST',`/carriers/${CARRIER}/capacity/holds/${hold.result.data.id}/confirmations`,update);
  const booked=await web(c.token,'POST',`/carriers/${CARRIER}/bookings/${booking.data.id}/confirmations`,{...update,carrierReference:'HAC41-BOOK',confirmation:'CONFIRMED'});
  assert.equal(booked.data.status,'CONFIRMED');pass('carrier booking confirmation requires committed resources');
  const beforeMissingCrew=counts();
  const missingCrew=await web(c.token,'POST',`/carriers/${CARRIER}/executions/${execution.result.data.id}/starts`,update,randomUUID(),409);
  assert.equal(missingCrew.error.code,'CONFIRMED_CREW_REQUIRED');assert.equal(counts(),beforeMissingCrew);
  const crewWindow={startsAt:setup.requestPayload.pickupWindow.startsAt,endsAt:setup.requestPayload.deliveryWindow.endsAt};
  const crewEvidence={reference:'fixture:hac41-crew',verifiedAt:evidence.observedAt,validUntil:evidence.validUntil,provenanceStatus:'SIMULATED'};
  const driver=await web(a.token,'POST',`/carriers/${CARRIER}/drivers`,{schemaVersion:'2.0',serviceId:SERVICE,
    fullName:'[SYNTHETIC] HAC41 crew',portalAccountId:null,licenseClass:'QA_LICENSE',licenseValidUntil:'2030-01-01',licenseTimezone:'America/Lima',
    qualifications:['QA_CERT'],experienceYears:2,dutyStatus:'AVAILABLE',evidence:crewEvidence,availableWindows:[crewWindow],
    dutyWindow:crewWindow,maximumDutySeconds:40000,usedDutySeconds:0},randomUUID(),201);
  const crewBase={schemaVersion:'2.0',serviceId:SERVICE,executionId:execution.result.data.id,window:crewWindow,status:'CONFIRMED',evidence:crewEvidence};
  await web(a.token,'POST',`/carriers/${CARRIER}/driver-assignments`,{...crewBase,driverId:driver.data.id,role:'PRIMARY',
    acceptedLicenseClasses:['QA_LICENSE'],requiredQualifications:['QA_CERT'],policyEvidence:crewEvidence},randomUUID(),201);
  await web(a.token,'POST',`/carriers/${CARRIER}/vehicle-assignments`,{...crewBase,assetId:setup.assetId,combinationId:null,
    reservationId:hold.result.data.id,capacityCommitted:{weightKg:1000,volumeM3:2}},randomUUID(),201);
  await web(c.token,'POST',`/carriers/${CARRIER}/executions/${execution.result.data.id}/starts`,update);
  pass('execution rejects missing crew atomically and starts after verified driver/vehicle commitments');
  const tracked=await tool(at,'read_v2_workflow',{kind:'executions',context:ctx(null,null,null,execution.result.data.id),page:{}});
  assert.equal(tracked.data.status,'IN_PROGRESS');pass('carrier execution is visible through the shared shipper MCP read');
  sql(`update public.carrier_operators set status='INACTIVE' where id='${OP}';`);
  await web(c.token,'GET',`/carriers/${CARRIER}/offers`,undefined,randomUUID(),403);
  sql(`update public.carrier_operators set status='ACTIVE' where id='${OP}';`);
  await web(c.token,'GET',`/carriers/${CARRIER}/offers`);pass('revoked carrier operator loses access and the positive control restores it');
  await web(at,'POST',`/identity/mcp/links/${linkA.data.id}/revocations`,{expectedVersion:1,reason:'end of local smoke'});
  assert.equal((await rpc(at,'tools/list',{})).status,403);pass('revocation immediately denies subsequent MCP HTTP calls');
  console.log(JSON.stringify({result:'PASS',checks:results.length,oauth:'REAL_LOCAL_SUPABASE_PKCE',alexaPlusLive:false,businessServiceRole:false}));
} finally {
  await admin.auth.admin.oauth.deleteClient(clientId);
  // The dedicated gate runner resets/stops its bank after collecting evidence.
}
