import fs from 'node:fs';
import {startCoverageTransport} from './coverage_transport.mts';
import {localConfig} from './real_auth.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';

const root=process.env.HAC44_ROOT!,out=process.env.HAC44_EVIDENCE!,folder=out+'/stack-v2',bank=process.env.HAC44_BANK_DB!;
const require=createRequire(root+'/cargomesh/package.json');
const results:any[]=[];
function write(name:string,value:any){const text=JSON.stringify(value,null,2)+'\n';fs.writeFileSync(out+'/PROBES/'+name,text);assert.equal(fs.readFileSync(out+'/PROBES/'+name,'utf8'),text);}
function sql(query:string,label='local-sql'){const r=spawnSync('docker',['exec','-i',bank,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','local_only=1','-U','postgres','-d','postgres'],{encoding:'utf8',input:query,maxBuffer:32e6});if(r.status!==0){const lines=r.stderr.split('\n').filter(l=>/^ERROR:/.test(l));const symbols=lines.flatMap(l=>l.match(/\b[A-Z][A-Z_]{3,}\b/g)??[]);const messages=lines.map(l=>l.replace(/"[^"]*"|'[^']*'/g,'[QUOTED]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT]').slice(0,200));const functions=[...r.stderr.matchAll(/function ([a-z_]+\.[a-z_]+)\(/g)].map(m=>m[1]);console.error(JSON.stringify({label,exit:r.status,errorSymbols:symbols,messages,functions,rawSQLAndClaimsOmitted:true}));}assert.equal(r.status,0,'Owned local SQL failed; raw SQL/claims deliberately omitted');return r.stdout;}
function counts(){return JSON.parse(sql(`create temporary table probe_counts(name text,n bigint);do $$declare r record;n bigint;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1,2 loop execute format('select count(*) from %I.%I',r.nspname,r.relname) into n;insert into probe_counts values(r.nspname||'.'||r.relname,n);end loop;end$$;select jsonb_object_agg(name,n) from probe_counts;`));}
localConfig();
const {readCliStatus}=await import(pathToFileURL(root+'/scripts/qa/hac44/pkce_smoke.mjs').href);
const cfg=readCliStatus(process.env.HAC44_CLI_JSON,folder);assert.equal(cfg.API_URL,process.env.HAC44_API_URL);
process.env.NEXT_PUBLIC_SUPABASE_URL=cfg.API_URL;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=cfg.ANON_KEY;
const {createClient}=require('@supabase/supabase-js'),opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,opts),clients:any[]=[];
const A='d4410000-0000-4000-8000-000000000001',B='d4410000-0000-4000-8000-000000000002';
const ORGA='d4400000-0000-4000-8000-000000000001',ORGB='d4400000-0000-4000-8000-000000000002';
const MEMA='d4420000-0000-4000-8000-000000000001',MEMB='d4420000-0000-4000-8000-000000000002';
async function login(id:string){const email=JSON.parse(sql(`select to_jsonb(email) from auth.users where id='${id}';`));const client=createClient(cfg.API_URL,cfg.ANON_KEY,opts);clients.push(client);const link=await admin.auth.admin.generateLink({type:'magiclink',email});assert.equal(link.error,null,'Synthetic magic link');const signed=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});assert.equal(signed.error,null,'Actual Auth session');const token=signed.data.session.access_token;const verified=await client.auth.getUser(token);assert.equal(verified.error,null);assert.equal(verified.data.user.id,id);const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());assert.ok(claims.session_id);assert.equal(claims.sub,id);return {id,token,claims};}
function claim(actor:any){return `set local "request.jwt.claims"='${JSON.stringify(actor.claims).replaceAll("'","''")}';`;}
const transport=await startCoverageTransport(),origin=transport.origin;
let complete=false;
try{
const a=await login(A),b=await login(B);
let recipe=fs.readFileSync(root+'/supabase/scenarios/v2-full-flow-qa/workflow-seed.sql','utf8');
recipe=recipe.replace(/set local "request.jwt.claims"\s*=\s*'[^']*';/,claim(a));
assert.ok(!recipe.includes('"role": "authenticated"'),'Literal scenario claims replaced by issuer claims in memory');
const revision='CP-1-'+randomUUID();recipe=recipe.replaceAll("'QA-1'","'"+revision+"'").replaceAll("'HAC44_WORKFLOW_QA'","'CPA_ASSET_"+randomUUID().replaceAll('-','').toUpperCase()+"'");
recipe=recipe.replace(/"plate"\s*:\s*"QA-001"/g,'"plate":"CPA-'+randomUUID().slice(0,8).toUpperCase()+'"');
const points=`'waypoints',jsonb_build_array(jsonb_build_object('kind','REST','location',(select value#>'{data,location}' from refs where name='origin'),'source',pg_temp.ev(),'verifiedAt',null),jsonb_build_object('kind','FUEL','location',(select value#>'{data,location}' from refs where name='destination'),'source',pg_temp.ev(),'verifiedAt',null))`;
assert.match(recipe,/'waypoints',\s*'\[\]'::jsonb/);recipe=recipe.replace(/'waypoints',\s*'\[\]'::jsonb/,points);
recipe=recipe.replace('reset role;',`set constraints all immediate;select 'DTO_BOUNDARY:'||jsonb_build_object('role',current_user,'subject',auth.uid(),'actualSession',current_setting('request.jwt.claims')::jsonb ? 'session_id')::text;`);
assert.ok(!/reset role/i.test(recipe));

recipe=recipe.replace('create or replace function pg_temp.save(', 'create temporary table cp2_captured(name text,action text,payload jsonb,ctx jsonb);grant all on cp2_captured to authenticated;\ncreate or replace function pg_temp.save(');
const beginSave=recipe.indexOf('create or replace function pg_temp.save('),endSave=recipe.indexOf('$$;',beginSave);
const saveSource=recipe.slice(beginSave,endSave);
assert.ok(saveSource.includes('insert into refs values('));
recipe=recipe.slice(0,beginSave)+saveSource.replace('insert into refs values(', 'with recorded as (insert into cp2_captured values(n,a,v,ctx) returning 1) insert into refs values(')+recipe.slice(endSave);
recipe=recipe.replace("select 'HAC44_REFS:'", "select 'CP2_CAPTURE:'||jsonb_build_object('workflow',(select jsonb_agg(to_jsonb(t)) from cp2_captured t),'requestPayload',pg_temp.req_payload(),'catalogFixtures',(select jsonb_object_agg(kind,value) from fixtures))::text;\nselect 'HAC44_REFS:'");

const creation=sql(recipe,'cp2-native-recipe'),refs=JSON.parse(creation.split('\n').find(l=>l.startsWith('HAC44_REFS:'))!.slice(11));
const boundary=JSON.parse(creation.split('\n').find(l=>l.startsWith('DTO_BOUNDARY:'))!.slice(13));
assert.equal(boundary.role,'authenticated');assert.equal(boundary.subject,A);assert.equal(boundary.actualSession,true);
results.push({case:'Native fixture reaches ALL IMMEDIATE and COMMIT with actual issuer claims',status:'PASS',boundary,source:'supabase/scenarios/v2-full-flow-qa/workflow-seed.sql',sourceSha256:createHash('sha256').update(fs.readFileSync(root+'/supabase/scenarios/v2-full-flow-qa/workflow-seed.sql')).digest('hex'),externalAdaptations:['Actual issuer claims in memory','Two sourced waypoints','Unique fixture versions/code','Boundary before role exit; no RESET ROLE']});

const captured=JSON.parse(creation.split("\n").find(l=>l.startsWith("CP2_CAPTURE:"))!.slice(12));
write("RECETAS_MEDIDAS.json",{sha:process.env.HAC44_SOURCE_SHA,refs,captured,boundary});
const index=JSON.parse(fs.readFileSync(out+'/PROBES/INDICE_198.json','utf8'));
const evidence:any[]=[];
const carrier='d4440000-0000-4000-8000-000000000001',serviceId='d4460000-0000-4000-8000-000000000001';
const jsonSql=(v:any)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const textSql=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const idSql=(id:any)=>id?"'"+id+"'::uuid":'null::uuid';
const record=(name:string,rows:string[],status:string,expected:any,observed:any,more:any={})=>{evidence.push({sha:process.env.HAC44_SOURCE_SHA,scenario:'F02 own v2-full-flow-qa real Auth',probe:name,rowIds:rows,status,expected,observed,...more});write('CP2_FOCAL_RESULTADOS.json',{sha:process.env.HAC44_SOURCE_SHA,evidence,complete:false});};
async function request(path:string,actor:any|null=a,payload:any=null){
  const r=await fetch(origin+'/api/v2'+path,{method:payload?'POST':'GET',headers:{...(actor?{Authorization:'Bearer '+actor.token}:{}),...(payload?{'Content-Type':'application/json','Idempotency-Key':randomUUID(),Origin:origin}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
  const raw=await r.text();let body:any;try{body=JSON.parse(raw);}catch{body={error:{code:'NON_JSON_RESPONSE',message:raw.slice(0,100)}};}return {http:r.status,body};
}
function get(obj:any,p:string){let at=obj;for(const token of p.replace(/\[\]/g,'.0').split('.').filter(Boolean)){if(at===null||at===undefined)return undefined;at=at[token];}return at;}
function edit(obj:any,p:string,operation:'NULL'|'OMIT',fill:any=undefined){const v=structuredClone(obj),tokens=p.replace(/\[\]/g,'.0').split('.');let at=v;for(const token of tokens.slice(0,-1)){if(at[token]===undefined)at[token]={};at=at[token];}const key=tokens.at(-1)!;if(fill!==undefined)at[key]=fill;else if(operation==='NULL')at[key]=null;else delete at[key];return v;}
const helpers=`
create function pg_temp.cp2_attempt(q text) returns jsonb language plpgsql security invoker as $$
declare val jsonb;accepted boolean:=false;s text;m text;cn text;r text;u uuid;
begin r:=current_user;u:=auth.uid();
 begin execute q into val;set constraints all immediate;accepted:=true;
 raise exception using errcode='P0001',message='CP2_INTERNAL_ROLLBACK';
 exception when others then get stacked diagnostics s=returned_sqlstate,m=message_text,cn=constraint_name;
 if not(s='P0001' and m='CP2_INTERNAL_ROLLBACK') then accepted:=false;end if;end;
 return jsonb_build_object('accepted',accepted,'sqlstate',case when accepted then null else s end,'error',case when accepted then null else m end,'constraint',case when accepted then null else cn end,'value',val,'role',r,'subject',u,'actualSession',current_setting('request.jwt.claims')::jsonb ? 'session_id');end;$$;
grant execute on function pg_temp.cp2_attempt(text) to authenticated;`;
function dbPair(name:string,rowIds:string[],positive:string,negative:string,expectAccepted:boolean){
  const before=counts();
  const pair=JSON.parse(sql(`begin;${helpers}set local role authenticated;${claim(a)}select jsonb_build_object('positive',pg_temp.cp2_attempt(${textSql(positive)}),'negative',pg_temp.cp2_attempt(${textSql(negative)}));set constraints all immediate;rollback;`));
  const after=counts();assert.deepEqual(before,after);
  const p=pair.positive,n=pair.negative;assert.equal(p.role,'authenticated');assert.equal(n.role,'authenticated');
  let status=!p.accepted?'BLOQUEADO':n.accepted===expectAccepted?'PASS':'DIFERENCIA';
  record(name,rowIds,status,{positiveAccepted:true,negativeAccepted:expectAccepted},pair,{countsBefore:before,countsAfter:after,rollbackDelta:0,controlPositive:name+' / positive',dbBoundary:'ALL IMMEDIATE under authenticated; no RESET; issuer session verified'});
  return pair;
}
function workflow(action:string,value:any,ctx:any={requestId:null,carrierId:null,parentId:null,id:null}){return `select public.command_v2_workflow('${ORGA}','${MEMA}','${action}',${jsonSql(ctx)},gen_random_uuid(),${jsonSql(value)})->'record'`;}
const byAction=(action:string)=>captured.workflow.find((r:any)=>r.action===action);
const routeRecipe=byAction('routes.create'),planRecipe=byAction('plans.create');
const wfHelpers=`create function pg_temp.cp2_plan(v jsonb) returns jsonb language plpgsql security invoker as $$declare r jsonb;begin
select public.command_v2_workflow('${ORGA}','${MEMA}','routes.create',${jsonSql(routeRecipe.ctx)},gen_random_uuid(),${jsonSql(routeRecipe.payload)})->'record' into r;
return public.command_v2_workflow('${ORGA}','${MEMA}','plans.create',${jsonSql(planRecipe.ctx)},gen_random_uuid(),v||jsonb_build_object('routeId',r->>'id'))->'record';end;$$;grant execute on function pg_temp.cp2_plan(jsonb) to authenticated;`;
function planPair(name:string,rowIds:string[],payload:any,accept=false){
 const before=counts();const pair=JSON.parse(sql(`begin;${helpers}${wfHelpers}set local role authenticated;${claim(a)}select jsonb_build_object('positive',pg_temp.cp2_attempt(${textSql('select pg_temp.cp2_plan('+jsonSql(planRecipe.payload)+')')}),'negative',pg_temp.cp2_attempt(${textSql('select pg_temp.cp2_plan('+jsonSql(payload)+')')}));set constraints all immediate;rollback;`));const after=counts();assert.deepEqual(before,after);
 const semanticAllocation=name.startsWith('SEMANTICS missing');const positiveOk=pair.positive.accepted&&(!semanticAllocation||pair.positive.value?.status==='eligible');const negativeOk=pair.negative.accepted===accept&&(!semanticAllocation||(pair.negative.value?.status==='ineligible'&&pair.negative.value?.data.exclusionReasons.includes('INCOMPLETE_LOAD_ALLOCATION')));record(name,rowIds,!positiveOk?'BLOQUEADO':negativeOk?'PASS':'DIFERENCIA',{positiveAccepted:true,negativeAccepted:accept},pair,{countsBefore:before,countsAfter:after,rollbackDelta:0,controlPositive:'Fresh native route + fully allocated plan',dbBoundary:'Authenticated actual claims to ALL IMMEDIATE, no RESET'});
}
const p=planRecipe.payload;
planPair('SEMANTICS missing allocation with eligible positive',['TransportPlanCandidate','CargoUnit','LoadAllocation','PlanResource'],edit(p,'assignments[].allocations','NULL',[]),true);
const newInput=structuredClone(captured.requestPayload);newInput.preferredEquipment='BOX_TRUCK';newInput.selectionObjective='WEIGHTED';newInput.cargoSpecification.units[0].unitsPerPackage=2;
for(const field of ['company','addressDetail','handlingInstructions'])newInput.contacts.pickup[field]='Synthetic CP-2 '+field;
const newRequest=await request('/freight/requests',a,newInput);
record('READ enriched native request',['FreightRequest','CargoUnit.unitsPerPackage','ShipmentContact.company','ShipmentContact.addressDetail','ShipmentContact.handlingInstructions'],newRequest.http===201?'PASS':'BLOQUEADO',{http:201,unitsPerPackage:2},newRequest,{controlPositive:'Native full canonical request creation'});
if(newRequest.http===201){
 const created=newRequest.body.data;const read=await request('/freight/requests/'+created.id);
 record('FIELD roundtrip concrete optional request values',['FreightRequest.preferredEquipment','FreightRequest.selectionObjective','CargoUnit.unitsPerPackage','ShipmentContact.company','ShipmentContact.addressDetail','ShipmentContact.handlingInstructions'],read.http===200&&read.body.data.preferredEquipment===newInput.preferredEquipment&&read.body.data.selectionObjective===newInput.selectionObjective&&read.body.data.cargoSpecification.units[0].unitsPerPackage===2&&['company','addressDetail','handlingInstructions'].every(f=>read.body.data.contacts.pickup[f]===newInput.contacts.pickup[f])?'PASS':'DIFERENCIA',{http:200,valuesPreserved:true},read,{controlPositive:'READ enriched native request'});
 const submit=await request('/freight/requests/'+created.id+'/submissions',a,{expectedDraftVersion:created.draftVersion});
 const submitOk=submit.http===200&&submit.body.data.status==='PENDING';record('METHOD FreightRequest.submit',['FreightRequest'],submitOk?'PASS':'BLOQUEADO',{http:200,status:'PENDING'},submit,{controlPositive:'Fresh valid own draft'});
 const staleSubmit=await request('/freight/requests/'+created.id+'/submissions',a,{expectedDraftVersion:created.draftVersion});
 record('METHOD FreightRequest.submit stale',['FreightRequest'],!submitOk?'BLOQUEADO':staleSubmit.http===409?'PASS':'DIFERENCIA',{positiveHttp:200,negativeHttp:409},{positiveHttp:submit.http,negativeHttp:staleSubmit.http},{controlPositive:'METHOD FreightRequest.submit'});
 const nativeCreate=async(name:string,path:string,value:any)=>{const r=await request(path,a,value);if(r.http!==201){record('PRECONDITION '+name,[],'BLOQUEADO',{http:201},{http:r.http,error:r.body.error});write('CP2_FOCAL_RESULTADOS.json',{sha:process.env.HAC44_SOURCE_SHA,evidence,complete:false});throw new Error('FOCAL_PRECONDITION '+name+' HTTP '+r.http+' '+(r.body.error?.code??'unknown'));}return r.body.data;};
 if(submitOk){
  const nr=created.id,ctx={requestId:nr,carrierId:null,parentId:null,id:null};
  const node=await nativeCreate('transfer','/routing/nodes',{...byAction('nodes.publish').payload,name:'Synthetic CP2 transfer',location:{...byAction('nodes.publish').payload.location,city:'Ica',label:'Synthetic Ica'}});
  const ca=await nativeCreate('corridor-a','/routing/corridors',{...byAction('corridors.publish').payload,destinationNodeId:node.id,version:'CP2_A'});
  const cb=await nativeCreate('corridor-b','/routing/corridors',{...byAction('corridors.publish').payload,originNodeId:node.id,version:'CP2_B'});
  for(const c of [ca,cb])await nativeCreate('limit','/carriers/'+carrier+'/route-limits',{...byAction('limits.publish').payload,corridorId:c.id});
  const route=await nativeCreate('route','/freight/requests/'+nr+'/routes',{...routeRecipe.payload,corridorIds:[ca.id,cb.id]});

  const areaPath=`/carriers/${carrier}/services/${serviceId}/areas`,lanePath=`/carriers/${carrier}/services/${serviceId}/lanes`;
  const areas=(await request(areaPath)).body.data,lanes=(await request(lanePath)).body.data;
  const pickupLima=areas.find((r:any)=>r.value.role==='PICKUP'&&r.value.geography.city==='Lima'),deliveryArequipa=areas.find((r:any)=>r.value.role==='DELIVERY'&&r.value.geography.city==='Arequipa');
  const pickupIca=await nativeCreate('pickup Ica',areaPath,{...pickupLima.value,geography:{...pickupLima.value.geography,city:'Ica'},evidence:'fixture:cp2-explicit-Ica-pickup'});
  const deliveryIca=await nativeCreate('delivery Ica',areaPath,{...deliveryArequipa.value,geography:{...deliveryArequipa.value.geography,city:'Ica'},evidence:'fixture:cp2-explicit-Ica-delivery'});
  const laneA=await nativeCreate('lane A',lanePath,{...lanes[0].value,pickupAreaId:pickupLima.id,deliveryAreaId:deliveryIca.id,evidence:'fixture:cp2-Lima-Ica'});
  const laneB=await nativeCreate('lane B',lanePath,{...lanes[0].value,pickupAreaId:pickupIca.id,deliveryAreaId:deliveryArequipa.id,evidence:'fixture:cp2-Ica-Arequipa'});

  const template=structuredClone(planRecipe.payload.assignments[0]);const starts=new Date(template.window.startsAt).getTime(),ends=new Date(template.window.endsAt).getTime(),middle=starts+(ends-starts)/2;
  const plan=await nativeCreate('plan','/freight/requests/'+nr+'/plans',{...planRecipe.payload,routeId:route.id,assignments:[{...template,laneId:laneA.id,legSequence:1,window:{startsAt:new Date(starts).toISOString(),endsAt:new Date(middle).toISOString()}},{...template,laneId:laneB.id,legSequence:2,window:{startsAt:new Date(middle).toISOString(),endsAt:new Date(ends).toISOString()}}]});
  record('METHOD assessEligibility multileg control',['TransportPlanCandidate','PlanLegAssignment','PlanResource'],plan.status==='eligible'?'PASS':'BLOQUEADO',{status:'eligible',legs:2},plan,{controlPositive:'Two published continuous corridors with native limits and full allocations'});
  if(plan.status==='eligible'){
   const headers=plan.data.legAssignments.map((r:any)=>r.id);
   const opportunity=await nativeCreate('opportunity','/freight/requests/'+nr+'/opportunities',{...byAction('opportunities.create').payload,planId:plan.id,assignmentIds:headers});
   const offers:any[]=[];for(const assignmentId of headers){offers.push(await nativeCreate('offer','/carriers/'+carrier+'/opportunities/'+opportunity.id+'/offers',{...byAction('offers.create').payload,planCandidateId:plan.id,coveredAssignmentIds:[assignmentId]}));}
   const beforeRankings=await request('/freight/requests/'+nr+'/ranking');
   const ranked=await nativeCreate('ranking','/freight/requests/'+nr+'/ranking',byAction('ranking.create').payload);
   const bundle=ranked.data.options.find((r:any)=>r.planId===plan.id);
   record('MULTIPLICITY RankedOption many offers',['RankedOption','CarrierOffer','O3AsrRVXhiO8iDlZrkKS-263 CarrierOffer → RankedOption '],bundle?.offerIds.length===2?'PASS':'DIFERENCIA',{offerIds:2},ranked,{controlPositive:'Two separately attributable native offers covering two disjoint leg assignments'});
   const selected=await nativeCreate('decision','/freight/requests/'+nr+'/decisions',{...byAction('decisions.create').payload,planId:plan.id,selectedOfferIds:offers.map(x=>x.id),consideredOfferIds:offers.map(x=>x.id)});
   const beforeBookings=await request('/bookings');const zeroDecisionBookings=beforeBookings.body.data?.filter((x:any)=>x.data.decisionId===selected.id).length;
   const bookings:any[]=[];for(const offer of offers){bookings.push(await nativeCreate('booking','/bookings',{...byAction('bookings.create').payload,decisionId:selected.id,offerId:offer.id}));}
   const ownBookings=await request('/bookings');const forDecision=ownBookings.body.data.filter((r:any)=>r.data.decisionId===selected.id);
   record('MULTIPLICITY SelectionDecision many bookings',['SelectionDecision','Booking','TTPNMglXCn0O7Q35afVn-1 SelectionDecision → Booking '],ownBookings.http===200&&forDecision.length===2&&bookings.every(r=>r.data.decisionId===selected.id)?'PASS':'DIFERENCIA',{bookings:2,oneDecision:true},{get:ownBookings.http,decisionId:selected.id,bookings:forDecision},{controlPositive:'First booking authorized and readable; second independent booking for other selected offer'});
   if(process.env.HAC44_CP1C==='1'){
    const selectionPayload={...byAction('decisions.create').payload,planId:plan.id,selectedOfferIds:offers.map(x=>x.id),consideredOfferIds:offers.map(x=>x.id)};
    const firstBooking={...byAction('bookings.create').payload,offerId:offers[0].id},secondBooking={...firstBooking,offerId:offers[1].id};
    const command=(action:string,v:string,context:any)=>`public.command_v2_workflow('${ORGA}','${MEMA}','${action}',${jsonSql(context)},gen_random_uuid(),${v})->'record'`;
    const pairedHelper=`create function pg_temp.cp1c_bookings(duplicate boolean) returns jsonb language plpgsql security invoker as $$declare d jsonb;b1 jsonb;b2 jsonb;begin
      select ${command('decisions.create',jsonSql(selectionPayload),ctx)} into d;
      select ${command('bookings.create',jsonSql(firstBooking)+"||jsonb_build_object('decisionId',d->>'id')",{})} into b1;
      select ${command('bookings.create',`(case when duplicate then ${jsonSql(firstBooking)} else ${jsonSql(secondBooking)} end)||jsonb_build_object('decisionId',d->>'id')`,{})} into b2;
      return jsonb_build_object('decisionId',d->>'id','bookings',jsonb_build_array(b1,b2));end;$$;grant execute on function pg_temp.cp1c_bookings(boolean) to authenticated;`;
    const cb=counts();const pair=JSON.parse(sql(`begin;${helpers}${pairedHelper}set local role authenticated;${claim(a)}select jsonb_build_object('positive',pg_temp.cp2_attempt('select pg_temp.cp1c_bookings(false)'),'negative',pg_temp.cp2_attempt('select pg_temp.cp1c_bookings(true)'));set constraints all immediate;rollback;`));const ca=counts();assert.deepEqual(cb,ca);
    const foreign=await request('/bookings',b);const noForeign=foreign.http===200&&!foreign.body.data.some((x:any)=>x.data.decisionId===selected.id);
    record('CP1C UML08 relation 83 both ends',['TTPNMglXCn0O7Q35afVn-1'],!pair.positive.accepted?'BLOQUEADO':pair.positive.value?.bookings.length===2&&!pair.negative.accepted&&pair.negative.sqlstate==='23505'&&pair.negative.constraint==='one_booking_per_offer_decision'&&zeroDecisionBookings===0&&forDecision.length===2&&noForeign?'PASS':'DIFERENCIA',
      {twoBookingsOneDecision:true,duplicateConstraint:'one_booking_per_offer_decision'},pair,
      {countsBefore:cb,countsAfter:ca,rollbackDelta:0,controlPositive:'Native fresh decision with two selected offers creates two native bookings; exact duplicate rejected at authenticated boundary',zeroBookingsBefore:zeroDecisionBookings,httpGet:forDecision,foreignReadDenied:noForeign});
    const overlapping=await nativeCreate('overlap offer','/carriers/'+carrier+'/opportunities/'+opportunity.id+'/offers',{...byAction('offers.create').payload,planCandidateId:plan.id,coveredAssignmentIds:[headers[0]]});
    const reranked=await nativeCreate('overlap ranking','/freight/requests/'+nr+'/ranking',byAction('ranking.create').payload);
    const getRank=await request('/freight/requests/'+nr+'/ranking');
    const lookup=new Map([...offers,overlapping].map(x=>[x.id,x.data.coveredAssignmentIds]));
    const completeCover=(option:any)=>{const ids=option.offerIds,covered=ids.flatMap((id:string)=>lookup.get(id)??[]);return ids.length>0&&new Set(ids).size===ids.length&&ids.includes(option.offerId)&&covered.length===headers.length&&new Set(covered).size===headers.length&&headers.every((id:string)=>covered.includes(id));};
    const variants=reranked.data.options.filter((x:any)=>x.planId===plan.id),readRank=getRank.body.data?.find((x:any)=>x.id===reranked.id);
    record('CP1C UML08 relation 40 both ends',['O3AsrRVXhiO8iDlZrkKS-263'],!bundle?'BLOQUEADO':beforeRankings.http===200&&beforeRankings.body.data.length===0&&bundle.offerIds.length===2&&completeCover(bundle)&&variants.length>=2&&variants.every(completeCover)&&getRank.http===200&&readRank?.data.options.filter((x:any)=>x.planId===plan.id).every(completeCover)?'PASS':'DIFERENCIA',
      {completeDisjointCover:true,representativeOfferAndBundleExposed:true},
      {positiveHttp:201,positiveOption:bundle,zeroRankingBefore:beforeRankings.body.data.length,negativeOverlapInput:overlapping.data.coveredAssignmentIds,negativeResult:variants,getHttp:getRank.http,get:readRank,physicalRepresentative:'ranked_options.offer_id',httpRepresentative:'data.options[].offerId',bundle:'data.options[].offerIds'},
      {controlPositive:'Two disjoint persisted offers cover two assignments; competing overlapping offer never produces a duplicated assignment in ranked bundles',contractRevision:'UML08 relation40 1..* attributable offers per ranking option'});
   }
  }
 }
}
write('CP2_FOCAL_RESULTADOS.json',{sha:process.env.HAC44_SOURCE_SHA,evidence,complete:true,matricesChanged:false});
complete=true;
}finally{for(const client of clients)await client.auth.signOut({scope:'local'});await transport.stop();}
console.log('PASS focused CP-2 semantics and multiplicities measured with own real sessions');
