import fs from 'node:fs';
import {startCoverageTransport} from './coverage_transport.mts';
import {localConfig} from './real_auth.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {isDeepStrictEqual as sameValue} from 'node:util';

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
let recipe=fs.readFileSync(root+'/supabase/scenarios/v2-full-flow-qa/workflow-seed.sql','utf8').replace(/\r\n/g,'\n');
recipe=recipe.replace(/set local "request.jwt.claims"\s*=\s*'[^']*';/,claim(a));
assert.ok(!recipe.includes('"role": "authenticated"'),'Literal scenario claims replaced by issuer claims in memory');
const revision='CP-1-'+randomUUID();recipe=recipe.replaceAll("'QA-1'","'"+revision+"'").replaceAll("'HAC44_WORKFLOW_QA'","'CPA_ASSET_"+randomUUID().replaceAll('-','').toUpperCase()+"'");
recipe=recipe.replace(/"plate"\s*:\s*"QA-001"/g,'"plate":"CPA-'+randomUUID().slice(0,8).toUpperCase()+'"');
// Snapshot controls deliberately stop before native booking/reservation creation.
// The independent full-flow dataset still supplies execution/incident controls.
const bookingStart=recipe.indexOf("select pg_temp.save(\n    'booking',");
assert.ok(bookingStart>0);const recipeFooter=recipe.indexOf('reset role;',bookingStart);
recipe=recipe.slice(0,bookingStart)+recipe.slice(recipeFooter);
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
const committedRefs=JSON.parse(fs.readFileSync(out+'/dataset/refs.json','utf8'));
const focalRefs=JSON.parse(fs.readFileSync(out+'/PROBES/RECETAS_MEDIDAS.json','utf8')).refs;
refs.execution=committedRefs.execution;refs.booking=committedRefs.booking;
const completeRefs=JSON.parse(fs.readFileSync(out+'/dataset/complete-refs.json','utf8'));
refs.incident=completeRefs.incident;refs.incidentExecutionId=completeRefs.execution.id;
write("RECETAS_MEDIDAS.json",{sha:process.env.HAC44_SOURCE_SHA,refs,captured,boundary});
const index=JSON.parse(fs.readFileSync(out+'/PROBES/INDICE_198.json','utf8'));
const evidence:any[]=[];
const carrier='d4440000-0000-4000-8000-000000000001',serviceId='d4460000-0000-4000-8000-000000000001';
const jsonSql=(v:any)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const textSql=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const idSql=(id:any)=>id?"'"+id+"'::uuid":'null::uuid';
const record=(name:string,rows:string[],status:string,expected:any,observed:any,more:any={})=>{evidence.push({sha:process.env.HAC44_SOURCE_SHA,scenario:'F02 own v2-full-flow-qa real Auth',probe:name,rowIds:rows,status,expected,observed,...more});write('CP2_RESULTADOS.json',{sha:process.env.HAC44_SOURCE_SHA,evidence,complete:false});};
async function request(path:string,actor:any|null=a,payload:any=null){
  const r=await fetch(origin+'/api/v2'+path,{method:payload?'POST':'GET',headers:{...(actor?{Authorization:'Bearer '+actor.token}:{}),...(payload?{'Content-Type':'application/json','Idempotency-Key':randomUUID(),Origin:origin}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
  const raw=await r.text();let body:any;try{body=JSON.parse(raw);}catch{body={error:{code:'NON_JSON_RESPONSE',message:raw.slice(0,100)}};}return {http:r.status,body};
}
function get(obj:any,p:string){let at=obj;for(const token of p.replace(/\[\]/g,'.0').split('.').filter(Boolean)){if(at===null||at===undefined)return undefined;at=at[token];}return at;}
function edit(obj:any,p:string,operation:'NULL'|'OMIT',fill:any=undefined){const v=structuredClone(obj),tokens=p.replace(/\[\]/g,'.0').split('.');let at=v;for(const token of tokens.slice(0,-1)){if(at[token]===undefined)at[token]={};at=at[token];}const key=tokens.at(-1)!;if(fill!==undefined)at[key]=fill;else if(operation==='NULL')at[key]=null;else delete at[key];return v;}
const helpers=`
create function pg_temp.cp2_attempt(q text) returns jsonb language plpgsql security invoker as $$
declare val jsonb;accepted boolean:=false;s text;m text;r text;u uuid;
begin r:=current_user;u:=auth.uid();
 begin execute q into val;set constraints all immediate;accepted:=true;
 raise exception using errcode='P0001',message='CP2_INTERNAL_ROLLBACK';
 exception when others then get stacked diagnostics s=returned_sqlstate,m=message_text;
 if not(s='P0001' and m='CP2_INTERNAL_ROLLBACK') then accepted:=false;end if;end;
 return jsonb_build_object('accepted',accepted,'sqlstate',case when accepted then null else s end,'error',case when accepted then null else m end,'value',val,'role',r,'subject',u,'actualSession',current_setting('request.jwt.claims')::jsonb ? 'session_id');end;$$;
grant execute on function pg_temp.cp2_attempt(text) to authenticated;`;
function dbPair(name:string,rowIds:string[],positive:string,negative:string,expectAccepted:boolean,extraHelpers=''){
  const before=counts();
  const pair=JSON.parse(sql(`begin;${helpers}${extraHelpers}set local role authenticated;${claim(a)}select jsonb_build_object('positive',pg_temp.cp2_attempt(${textSql(positive)}),'negative',pg_temp.cp2_attempt(${textSql(negative)}));set constraints all immediate;rollback;`));
  const after=counts();assert.deepEqual(before,after);
  const p=pair.positive,n=pair.negative;assert.equal(p.role,'authenticated');assert.equal(n.role,'authenticated');
  let status=!p.accepted?'BLOQUEADO':n.accepted===expectAccepted?'PASS':'DIFERENCIA';
  record(name,rowIds,status,{positiveAccepted:true,negativeAccepted:expectAccepted},pair,{countsBefore:before,countsAfter:after,rollbackDelta:0,controlPositive:name+' / positive',dbBoundary:'ALL IMMEDIATE under authenticated; no RESET; issuer session verified'});
  return pair;
}
function workflow(action:string,value:any,ctx:any={requestId:null,carrierId:null,parentId:null,id:null}){return `select public.command_v2_workflow('${ORGA}','${MEMA}','${action}',${jsonSql(ctx)},gen_random_uuid(),${jsonSql(value)})->'record'`;}
const catPaths:any={preferences:'/organizations/current/preferences','cargo-profiles':'/cargo-profiles','cargo-categories':'/cargo-categories',carriers:'/carriers',depots:`/carriers/${carrier}/depots`,services:`/carriers/${carrier}/services`,partners:`/carriers/${carrier}/partners`,drivers:`/carriers/${carrier}/drivers`,'vehicle-combinations':`/carriers/${carrier}/vehicle-combinations`,'driver-assignments':`/carriers/${carrier}/driver-assignments`,'vehicle-assignments':`/carriers/${carrier}/vehicle-assignments`,assets:`/carriers/${carrier}/assets`,'capacity-pools':`/carriers/${carrier}/capacity-pools`,calendars:`/carriers/${carrier}/calendars`,maintenances:`/carriers/${carrier}/maintenances`,'repositioning-blocks':`/carriers/${carrier}/repositioning-blocks`,'capability-definitions':`/carriers/${carrier}/capability-definitions`,areas:`/carriers/${carrier}/services/${serviceId}/areas`,lanes:`/carriers/${carrier}/services/${serviceId}/lanes`};
const classes:any={Organization:'organization',Facility:'facility',FreightRequest:'request',CargoSpecification:'request',CargoUnit:'request',ShipmentContact:'request',Carrier:'carriers',CarrierDepot:'depots',CarrierService:'services',ServiceArea:'areas',ServiceLane:'lanes',FulfilmentPartner:'partners',OrganizationPreferences:'preferences',CargoProfile:'cargo-profiles',CargoCategory:'cargo-categories',TransportAsset:'assets',RoadVehicle:'assets',CapacityPool:'capacity-pools',CapacityCalendar:'calendars',ScheduledMaintenance:'maintenances',RepositioningBlock:'repositioning-blocks',Driver:'drivers',VehicleCombination:'vehicle-combinations',VehicleAssignment:'vehicle-assignments',AssetCargoCapability:'capability-definitions',LogisticsNode:'nodes',RouteCorridor:'corridors',RoutePlanningPolicy:'route-policies',RoutePlan:'routes',RouteLeg:'routes',RouteWaypoint:'routes',RoutePlanner:'routes',RouteCondition:'conditions',TransportPlanCandidate:'plans',PlanResource:'plans',PlanLegAssignment:'plans',LoadAllocation:'plans',CarrierOpportunity:'opportunities',CarrierOffer:'offers',OfferCostComponent:'offers',RankedOption:'ranking',ScoringPolicy:'scoring-policies',SelectionDecision:'decisions',Booking:'bookings',CapacityReservation:'holds',TransportExecution:'executions',OperationalIncident:'incidents',IncidentUpdate:'incident-updates',AssetStatusEvent:'asset-events',CarrierMetric:'metrics',OrganizationMember:'members',CarrierOperator:'operators',ResponseIntegration:'integrations',McpAccountLink:'links'};

const ev={reference:'fixture:cp2-native',provider:'Synthetic HAC-44',observedAt:new Date().toISOString(),validUntil:null,provenanceStatus:'SIMULATED'};
const setup:any[]=[];
const incidentSetup=await request(`/carriers/${carrier}/executions/${refs.execution.id}/incidents`,a,{schemaVersion:'2.0',kind:'QA_OBSERVATION',severity:'INFO',occurredAt:ev.observedAt,location:null,description:'Synthetic independent coverage observation',evidence:[ev]});
if(incidentSetup.http===201){refs.incident=incidentSetup.body.data;const update=await request(`/carriers/${carrier}/incidents/${refs.incident?.id??''}/updates`,a,{schemaVersion:'2.0',expectedVersion:refs.incident.version,note:'Synthetic note',evidence:ev,action:'NOTE'});setup.push({action:'incident-update',result:update});}
setup.push({action:'incident',result:incidentSetup});
const metricSetup=await request(`/carriers/${carrier}/metrics`,a,{schemaVersion:'2.0',period:{startsAt:new Date(Date.now()-3600000).toISOString(),endsAt:new Date().toISOString()},corridorId:refs.corridor.id,mode:'ROAD',sampleSize:1,onTimeRate:0.9,successfulDeliveryRate:1,source:ev});setup.push({action:'metrics',result:metricSetup});
const assetSetup=await request(`/carriers/${carrier}/assets/${refs.asset.id}/events`,a,{schemaVersion:'2.0',expectedVersion:refs.asset.version,note:'Synthetic observation',evidence:ev,next:'IN_SERVICE',reason:'QA control'});setup.push({action:'asset-event',result:assetSetup});if(assetSetup.http===201){const fresh=await request(`/carriers/${carrier}/assets/${refs.asset.id}`);const restored=await request(`/carriers/${carrier}/assets/${refs.asset.id}/events`,a,{schemaVersion:'2.0',expectedVersion:fresh.body.data.version,note:'Restore positive resource',evidence:ev,next:'AVAILABLE',reason:'QA positive control'});setup.push({action:'asset-event restore',result:restored});}
const holdPayload={schemaVersion:'2.0',bookingId:focalRefs.booking.id,assignmentId:focalRefs.plan.data.legAssignments[0].id,planResourceId:focalRefs.plan.data.legAssignments[0].resources[0].resourceId,expiresAt:new Date(Date.now()+3600000).toISOString(),consolidationId:null,evidence:focalRefs.booking.data.authorizationEvidence};
// The focal native booking has no hold; the snapshot bank remains unreserved.
const holdSetup=await request('/capacity/holds',a,holdPayload);setup.push({action:'hold',result:holdSetup});

for(const kind of ['capacity-pools','maintenances','repositioning-blocks']){
 const v=structuredClone(captured.catalogFixtures[kind]);if(v.assetId==='ASSET')v.assetId=committedRefs.asset.id;if(v.calendarId==='CALENDAR')v.calendarId=committedRefs.calendar.id;if(v.code)v.code+='_'+randomUUID().slice(0,8).toUpperCase();
 const result=await request(`/carriers/${carrier}/${kind}`,a,v);setup.push({action:'catalog '+kind,result});
}
setup.push({action:'preferences',result:await request('/organizations/current/preferences',a,{schemaVersion:'2.0',objective:'WEIGHTED',maximumWaitMinutes:60,preferredMode:'ROAD',preferredEquipment:'BOX_TRUCK',usualBudget:{amount:1000,currency:'USD'},validUntil:'2027-03-01T00:00:00Z'})});
setup.push({action:'partner',result:await request(`/carriers/${carrier}/partners`,a,{schemaVersion:'2.0',registeredName:'Synthetic independent partner',partnerCarrierRef:null,agreementValidFrom:'2026-01-01T00:00:00Z',agreementValidUntil:'2027-03-01T00:00:00Z',status:'ACTIVE',coverageEvidence:'fixture:cp2-local-partner'})});
setup.push({action:'integration MANUAL',result:await request(`/carriers/${carrier}/integrations`,a,{serviceId,channel:'MANUAL',endpointRef:null,enabled:true,expectedVersion:0})});

write('PRECONDICIONES_PROBES.json',{sha:process.env.HAC44_SOURCE_SHA,setup});

const wfPaths:any={nodes:'/routing/nodes',corridors:'/routing/corridors','route-policies':'/routing/policies',conditions:'/routing/conditions',routes:`/freight/requests/${refs.request.id}/routes`,plans:`/freight/requests/${refs.request.id}/plans`,opportunities:`/freight/requests/${refs.request.id}/opportunities`,offers:`/freight/requests/${refs.request.id}/offers`,ranking:`/freight/requests/${refs.request.id}/ranking`,decisions:`/freight/requests/${refs.request.id}/decisions`,bookings:'/bookings',holds:'/capacity/holds',executions:'/executions',incidents:`/executions/${refs.execution.id}/incidents`,'incident-updates':`/carriers/${carrier}/incidents/${refs.incident?.id??''}/updates`,'asset-events':`/carriers/${carrier}/assets/${refs.plan.data.assignments[0].resource.assetId}/events`,metrics:`/carriers/${carrier}/metrics`,'scoring-policies':'/scoring/policies'};
const identityPaths:any={members:'/organizations/current/members',operators:`/carriers/${carrier}/operators`,integrations:`/carriers/${carrier}/integrations`,links:'/identity/mcp/links'};
// Concrete nullable values are written through native revisions before reads.
const enrichment:any={organization:{legalName:'Synthetic F02 Legal',taxIdType:'SYNTHETIC',taxIdValue:'F02_'+randomUUID().slice(0,8),countryCode:'PE',corporateEmail:'f02@cargomesh.test',corporatePhone:'+51999000123'},services:{temperatureRange:{minCelsius:2,maxCelsius:8}},assets:{roadVehicle:{variant:'Synthetic variant',conditionReason:'Synthetic available control'}},'capability-definitions':{temperatureRange:{minCelsius:2,maxCelsius:8}}};
const ownOperator=(await request(`/carriers/${carrier}/operators`)).body.data?.[0];
const referenceCarrier=(await request('/carriers')).body.data?.find((r:any)=>r.id!==carrier);
if(ownOperator?.id)enrichment.drivers={portalAccountId:ownOperator.id};
if(referenceCarrier?.id)enrichment.partners={partnerCarrierRef:referenceCarrier.id};
for(const [kind,changes] of Object.entries(enrichment)){
 const path=kind==='organization'?'/organizations/current':catPaths[kind];const list=await request(path);const data=list.body.data;const currentRecord=Array.isArray(data)?data.find((r:any)=>r.id===(kind==='assets'?refs.asset.id:kind==='services'?serviceId:null))??data[0]:data;
 if(list.http===200&&currentRecord){const value={...currentRecord.value,...changes as any};if(kind==='assets')value.roadVehicle={...currentRecord.value.roadVehicle,...(changes as any).roadVehicle};
 const query=kind==='organization'?`select public.command_v2_organization('${ORGA}','${MEMA}',gen_random_uuid(),${currentRecord.version},${jsonSql(value)})->'row'`:`select public.command_v2_catalog('${ORGA}','${MEMA}','${kind}','${carrier}',null,'${currentRecord.id}',gen_random_uuid(),${currentRecord.version},${jsonSql(value)})->'record'`;
 const related=index.attributes.filter((f:any)=>classes[f.clase]===kind&&get(changes,f.ruta_input)!==undefined);const ids=related.map((f:any)=>f.clase+'.'+f.atributo);
 const db=dbPair('DB_ROUNDTRIP concrete enrichment '+kind,ids,query,query,true);
 const positive=await request(kind==='organization'?path+'/revisions':path+'/'+currentRecord.id+'/revisions',a,{expectedVersion:currentRecord.version,value});setup.push({action:'concrete nullable enrichment '+kind,result:positive});
 for(const field of related){const id=field.clase+'.'+field.atributo,expected=get(value,field.ruta_input),dbValue=kind==='organization'?db.positive.value?.[({legalName:'legal_name',taxIdType:'business_identifier_type',taxIdValue:'business_identifier_value',countryCode:'country_code',corporateEmail:'corporate_email',corporatePhone:'corporate_phone'} as any)[field.ruta_input]]:get(db.positive.value,field.ruta_output),actual=get(positive.body.data,field.ruta_output);record('FIELD roundtrip '+id+' DB/HTTP',[id],db.positive.accepted&&positive.http===200&&sameValue(expected,dbValue)&&sameValue(expected,actual)?'PASS':'BLOQUEADO',{written:expected},{value:actual,dbValue,positiveHttp:positive.http,positiveError:positive.body.error??null},{controlPositive:'Native submitted concrete enrichment, exact DB and HTTP comparison'});}
 }
}
const sources:any={};
for(const [kind,path] of Object.entries({...catPaths,...wfPaths,...identityPaths,organization:'/organizations/current',request:'/freight/requests/'+refs.request.id,facility:'/facilities'})){
  const result=await request(String(path));const data=result.body.data;
  const ids:any={assets:refs.asset.id,calendars:refs.calendar.id,plans:refs.plan.id,routes:refs.route.id,offers:refs.offer.id,'route-policies':refs.policy.id,corridors:refs.corridor.id};
  sources[kind]={path,result,record:Array.isArray(data)?data.find((r:any)=>r.id===ids[kind])??data[0]:data};
}
write('LECTURAS_ACTUALES.json',{sha:process.env.HAC44_SOURCE_SHA,sources});
const fields=index.attributes.filter((r:any)=>index.pending.some((p:any)=>p.tipo==='atributo'&&p.id===r.clase+'.'+r.atributo));
for(const field of fields){
  const rowId=field.clase+'.'+field.atributo,kind=classes[field.clase],source=sources[kind];
  const path=field.ruta_output;
  const value=source?.record?get(source.record,path):undefined;
  record('FIELD_READ '+rowId,[rowId],!source||source.result.http!==200||!source.record?'BLOQUEADO':value===undefined?'PARCIAL':'PASS',
    {recordHttp:200,fieldPath:path,optionalUml:field.opcional_uml},{http:source?.result.http??null,valuePresent:value!==undefined,value:value??null},{sourcePath:source?.path??null,fieldSource:field.dto_lectura,certifiesOnly:'This field read; not all class methods or required/null guards'});
}
// Exact field-specific NULL/omission probes on native catalog revisions, not whole green endpoints.
for(const field of fields){
 const kind=classes[field.clase];if(!['organization',...Object.keys(catPaths)].includes(kind)||field.ruta_input==='—'||field.ruta_input==='')continue;
 const target=sources[kind];if(!target?.record){record('FIELD_GUARD '+field.clase+'.'+field.atributo,[field.clase+'.'+field.atributo],'BLOQUEADO',{positive:'Concrete own writable record'},{reason:'No populated native control in this fixture'});continue;}
 const id=target.record.id,detail=kind==='organization'?target.path:target.path+'/'+id;
 for(const operation of ['NULL','OMIT'] as const){
   const now=await request(detail);if(now.http!==200){record('FIELD_GUARD '+field.clase+'.'+field.atributo+' '+operation,[field.clase+'.'+field.atributo],'BLOQUEADO',200,now.http);continue;}
   const value=now.body.data.value,payload=edit(value,field.ruta_input,operation);
   // The nullable tax fields are a pair in the native schema, not independent.
   const expectedAccepted=operation==='NULL'?field.nullable_dto_input==='True'&&!['taxIdType','taxIdValue'].includes(field.ruta_input):field.optional_dto_input==='True';
   const query=(v:any)=>kind==='organization'?`select public.command_v2_organization('${ORGA}','${MEMA}',gen_random_uuid(),${now.body.data.version},${jsonSql(v)})->'record'`:
     `select public.command_v2_catalog('${ORGA}','${MEMA}','${kind}',${idSql(kind==='preferences'||kind.startsWith('cargo-')||kind==='carriers'?null:carrier)},${idSql(['lanes','areas'].includes(kind)?serviceId:null)},'${id}',gen_random_uuid(),${now.body.data.version},${jsonSql(v)})->'record'`;
   dbPair('DB_FIELD '+field.clase+'.'+field.atributo+' '+operation,[field.clase+'.'+field.atributo],query(value),query(payload),expectedAccepted);
   const postPath=detail+'/revisions';const positive=await request(postPath,a,{expectedVersion:now.body.data.version,value});
   if(positive.http!==200){record('HTTP_FIELD '+field.clase+'.'+field.atributo+' '+operation,[field.clase+'.'+field.atributo],'BLOQUEADO',{positiveHttp:200},positive,{controlPositive:'Fresh own native revision'});continue;}
   const refreshed=await request(detail);const negative=await request(postPath,a,{expectedVersion:refreshed.body.data.version,value:payload});
   record('HTTP_FIELD '+field.clase+'.'+field.atributo+' '+operation,[field.clase+'.'+field.atributo],negative.http===(expectedAccepted?200:400)?'PASS':'DIFERENCIA',
     {positiveHttp:200,negativeHttp:expectedAccepted?200:400},{positiveHttp:positive.http,negativeHttp:negative.http,error:negative.body.error??null},{controlPositive:'Own revision of concrete '+field.clase+' record',inputPath:field.ruta_input,operation});
 }
}

{const current=await request('/organizations/current');const value=current.body.data.value,nullable={...value,taxIdType:null,taxIdValue:null};
 const query=(v:any)=>`select public.command_v2_organization('${ORGA}','${MEMA}',gen_random_uuid(),${current.body.data.version},${jsonSql(v)})->'record'`;
 dbPair('NULLABLE organization tax pair',['Organization.taxIdType','Organization.taxIdValue'],query(value),query(nullable),true);
 const p=await request('/organizations/current/revisions',a,{expectedVersion:current.body.data.version,value});const n=await request('/organizations/current/revisions',a,{expectedVersion:p.body.data?.version,value:nullable});
 record('HTTP_NULLABLE organization tax pair',['Organization.taxIdType','Organization.taxIdValue'],p.http!==200?'BLOQUEADO':n.http===200&&n.body.data.value.taxIdType===null&&n.body.data.value.taxIdValue===null?'PASS':'DIFERENCIA',{positiveHttp:200,nullablePairAccepted:true},{positiveHttp:p.http,negativeHttp:n.http,error:n.body.error??null},{controlPositive:'Concrete correlated tax fields; null is valid for both together, individual removal violates native pair guard',contractCitation:'cargomesh/src/shared/schemas/v2/organization.ts:14'});
}

const requestPayload=structuredClone(captured.requestPayload);
requestPayload.preferredEquipment='BOX_TRUCK';requestPayload.selectionObjective='WEIGHTED';requestPayload.cargoSpecification.units[0].unitsPerPackage=2;
requestPayload.contacts.pickup.company='Synthetic company';requestPayload.contacts.pickup.addressDetail='Synthetic warehouse';requestPayload.contacts.pickup.handlingInstructions='Synthetic handling note';
const newDraft=(v:any)=>`select public.create_v2_freight_request('${ORGA}','${MEMA}',gen_random_uuid(),private.hash_v2_freight_payload(${jsonSql(v)}),${jsonSql(v)})`;
for(const field of fields.filter((f:any)=>['FreightRequest','CargoUnit','ShipmentContact'].includes(f.clase)&&f.ruta_input!=='—')){
 for(const operation of ['NULL','OMIT'] as const){const id=field.clase+'.'+field.atributo,negative=edit(requestPayload,field.ruta_input,operation),expect=operation==='NULL'?field.nullable_dto_input==='True':field.optional_dto_input==='True';
 dbPair('DB_FIELD '+id+' '+operation,[id],newDraft(requestPayload),newDraft(negative),expect);
 const positive=await request('/freight/requests',a,requestPayload),n=await request('/freight/requests',a,negative);
 record('HTTP_FIELD '+id+' '+operation,[id],positive.http!==201?'BLOQUEADO':n.http===(expect?201:400)?'PASS':'DIFERENCIA',{positiveHttp:201,negativeHttp:expect?201:400},{positiveHttp:positive.http,negativeHttp:n.http,error:n.body.error??null},{controlPositive:'Native full valid enriched draft; fresh idempotency key'});
 }
}
for(const [name,payload] of [['units min 1',{...requestPayload,cargoSpecification:{...requestPayload.cargoSpecification,units:[]}}],['contacts pickup required',edit(requestPayload,'contacts.pickup','OMIT')],['contacts recipient required',edit(requestPayload,'contacts.recipient','OMIT')],['modes nonempty',{...requestPayload,acceptedModes:[]}],['modes no duplicates',{...requestPayload,acceptedModes:['ROAD','ROAD']}]] as const){
 const ids=name.startsWith('units')?['CargoSpecification','CargoUnit']:name.startsWith('contacts')?['FreightRequest','ShipmentContact']:['FreightRequest.acceptedModes','FreightRequest'];
 dbPair('CARDINALITY request '+name,ids,newDraft(requestPayload),newDraft(payload),false);
 const positive=await request('/freight/requests',a,requestPayload),negative=await request('/freight/requests',a,payload);record('HTTP_CARDINALITY '+name,ids,positive.http!==201?'BLOQUEADO':negative.http===400?'PASS':'DIFERENCIA',{positiveHttp:201,negativeHttp:400},{positiveHttp:positive.http,negativeHttp:negative.http,error:negative.body.error??null},{controlPositive:'Complete enriched native draft'});
}

write('CP2_RESULTADOS.json',{sha:process.env.HAC44_SOURCE_SHA,evidence,complete:false});
// Cardinality and XOR guards use fresh native routes for each independent rollback.
const byAction=(action:string)=>captured.workflow.find((r:any)=>r.action===action);
const routeRecipe=byAction('routes.create'),planRecipe=byAction('plans.create');
for(const operation of ['NULL','OMIT'] as const){
 const value=edit(requestPayload,'cargoSpecification',operation);
 dbPair('CARDINALITY cargo specification '+operation,['FreightRequest','CargoSpecification'],newDraft(requestPayload),newDraft(value),false);
}
dbPair('CARDINALITY route minimum corridor',['RoutePlan','RouteLeg'],workflow('routes.create',routeRecipe.payload,routeRecipe.ctx),workflow('routes.create',{...routeRecipe.payload,corridorIds:[]},routeRecipe.ctx),false);
const assetValue=sources.assets.record.value;
const calendarValue=sources.calendars.record.value;
const calendarQuery=(variant:string)=>{
 const uniqueAsset={...assetValue,code:'F02_'+randomUUID().replaceAll('-','').toUpperCase(),roadVehicle:{...assetValue.roadVehicle,plate:'F02-'+randomUUID().slice(0,12).toUpperCase()}};
 const asset=`public.command_v2_catalog('${ORGA}','${MEMA}','assets','${carrier}',null,null,gen_random_uuid(),null,${jsonSql(uniqueAsset)})->'record'`;
 const value=`${jsonSql(calendarValue)}||jsonb_build_object('assetId',${variant==='none'?'null':"a.value->>'id'"},'capacityPoolId',${variant==='both'&&sources['capacity-pools'].record?textSql(sources['capacity-pools'].record.id):'null'})`;
 const create=`public.command_v2_catalog('${ORGA}','${MEMA}','calendars','${carrier}',null,null,gen_random_uuid(),null,${value})->'record'`;
 return variant==='duplicate'?`with a as (select ${asset} value), first as (select ${create} value from a) select ${create} from a cross join first where first.value is not null`:`with a as (select ${asset} value) select ${create} from a`;
};
dbPair('CARDINALITY calendar source none',['CapacitySource','CapacityCalendar'],calendarQuery('positive'),calendarQuery('none'),false);
if(sources['capacity-pools'].record)dbPair('CARDINALITY calendar source both',['CapacitySource','CapacityCalendar'],calendarQuery('positive'),calendarQuery('both'),false);
dbPair('CARDINALITY calendar source unique',['CapacitySource','CapacityCalendar'],calendarQuery('positive'),calendarQuery('duplicate'),false);
for(const variant of ['none','both','unique'] as const){
 const asset=await request(catPaths.assets,a,{...assetValue,code:'F02_'+randomUUID().replaceAll('-','').toUpperCase(),roadVehicle:{...assetValue.roadVehicle,plate:'F02-'+randomUUID().slice(0,12).toUpperCase()}});
 const value={...calendarValue,assetId:asset.body.data?.id,capacityPoolId:null};
 const positive=asset.http===201?await request(catPaths.calendars,a,value):asset;
 const bad=variant==='none'?{...value,assetId:null}:variant==='both'?{...value,capacityPoolId:sources['capacity-pools'].record?.id}:value;
 const negative=await request(catPaths.calendars,a,bad);
 record('HTTP_CARDINALITY calendar source '+variant,['O3AsrRVXhiO8iDlZrkKS-200'],positive.http!==201?'BLOQUEADO':(variant==='unique'?[400,409]:[400]).includes(negative.http)?'PASS':'DIFERENCIA',{positiveHttp:201,invalidSourceOrDuplicateRejected:true},{positiveHttp:positive.http,negativeHttp:negative.http,error:negative.body.error??null},{controlPositive:'Fresh native unique own asset and successful first calendar; paired HTTP source XOR/uniqueness frontier'});
}
const wfHelpers=`create function pg_temp.cp2_plan(v jsonb) returns jsonb language plpgsql security invoker as $$declare r jsonb;begin
select public.command_v2_workflow('${ORGA}','${MEMA}','routes.create',${jsonSql(routeRecipe.ctx)},gen_random_uuid(),${jsonSql(routeRecipe.payload)})->'record' into r;
return public.command_v2_workflow('${ORGA}','${MEMA}','plans.create',${jsonSql(planRecipe.ctx)},gen_random_uuid(),v||jsonb_build_object('routeId',r->>'id'))->'record';end;$$;grant execute on function pg_temp.cp2_plan(jsonb) to authenticated;`;
function planPair(name:string,rowIds:string[],payload:any,accept=false){
 const before=counts();const pair=JSON.parse(sql(`begin;${helpers}${wfHelpers}set local role authenticated;${claim(a)}select jsonb_build_object('positive',pg_temp.cp2_attempt(${textSql('select pg_temp.cp2_plan('+jsonSql(planRecipe.payload)+')')}),'negative',pg_temp.cp2_attempt(${textSql('select pg_temp.cp2_plan('+jsonSql(payload)+')')}));set constraints all immediate;rollback;`));const after=counts();assert.deepEqual(before,after);
 const semanticAllocation=name.startsWith('SEMANTICS missing');const positiveOk=pair.positive.accepted&&pair.positive.value?.status==='eligible';const negativeOk=pair.negative.accepted===accept&&(!semanticAllocation||(pair.negative.value?.status==='ineligible'&&pair.negative.value?.data.exclusionReasons.includes('INCOMPLETE_LOAD_ALLOCATION')));record(name,rowIds,!positiveOk?'BLOQUEADO':negativeOk?'PASS':'DIFERENCIA',{positiveAccepted:true,positiveStatus:'eligible',negativeAccepted:accept},pair,{countsBefore:before,countsAfter:after,rollbackDelta:0,controlPositive:'Fresh native route + fully allocated eligible plan without reservation',dbBoundary:'Authenticated actual claims to ALL IMMEDIATE, no RESET',contractCitations:['docs/v2-amazon/models/FULL_MODEL_UML_INVENTORY.json:3490','cargomesh/src/shared/schemas/v2/workflow.ts:20','cargomesh/src/shared/schemas/v2/workflow.ts:59','docs/v2-amazon/models/FULL_MODEL_DER.md:749'],contractLimit:'DER permits neither only for UNKNOWN physical historical rows; native command schema requires exactly one'});
}
const p=planRecipe.payload;
planPair('CARDINALITY plan assignments min 1',['TransportPlanCandidate','PlanLegAssignment'],{...p,assignments:[]});
planPair('SEMANTICS missing allocation produces ineligible candidate',['CargoUnit','LoadAllocation','PlanResource'],edit(p,'assignments[].allocations','NULL',[]),true);
planPair('XOR plan capacity source none',['CapacitySource','PlanResource','TransportAsset','CapacityPool'],{...p,assignments:p.assignments.map((r:any)=>({...r,assetId:null,capacityPoolId:null}))},false);
if(sources['capacity-pools'].record)planPair('XOR plan capacity source both',['CapacitySource','PlanResource','TransportAsset','CapacityPool'],{...p,assignments:p.assignments.map((r:any)=>({...r,capacityPoolId:sources['capacity-pools'].record.id}))});
const poolRead=sources['capacity-pools'];
const poolCalendar=poolRead?.record?await request(catPaths.calendars,a,{...calendarValue,assetId:null,capacityPoolId:poolRead.record.id}):null;
const poolPlan=poolCalendar?.http===201?await request(wfPaths.plans,a,{...p,assignments:p.assignments.map((r:any)=>({...r,assetId:null,capacityPoolId:poolRead.record.id,calendarId:poolCalendar.body.data.id}))}):null;
const projectedPool=poolPlan?.body.data?.data?.assignments?.[0]?.resource;
record('PROJECTION pool CapacitySource.sourceId',['CapacitySource','CapacityPool'],poolPlan?.http===201&&projectedPool?.poolId===poolRead.record.id&&sources.plans.record?.status==='eligible'?'PASS':'BLOQUEADO',{representation:'POOL/id in a native plan resource, compared with eligible ASSET control'},{value:projectedPool?.poolId,resource:projectedPool,poolPlanStatus:poolPlan?.body.data?.status,eligibleAssetStatus:sources.plans.record?.status,positiveHttp:poolPlan?.http,calendarHttp:poolCalendar?.http,error:poolPlan?.body.error??poolCalendar?.body.error??null},{controlPositive:'Native pool calendar and persisted native plan projection; eligible ASSET control remains separate, native ineligibility is preserved; no new CRUD'});
const grouped={...p,assignments:p.assignments.map((r:any)=>({legSequence:r.legSequence,serviceId:r.serviceId,laneId:r.laneId,window:r.window,resources:[{calendarId:r.calendarId,assetId:r.assetId,capacityPoolId:r.capacityPoolId,combinationId:r.combinationId,role:r.role,allocations:r.allocations}]}))};
planPair('CARDINALITY grouped resources min 1',['PlanLegAssignment','PlanResource','TransportPlanCandidate'],{...grouped,assignments:grouped.assignments.map((r:any)=>({...r,resources:[]}))});
planPair('CARDINALITY duplicate grouped physical source',['PlanLegAssignment','PlanResource'],{...grouped,assignments:grouped.assignments.map((r:any)=>({...r,resources:[r.resources[0],r.resources[0]]}))});
// Non-CRUD capacity projections are observed on native plan resources.
const capacity=sources.plans?.record?.data?.assignments?.[0]?.resource;
for(const [attribute,value] of [['sourceId',capacity?.assetId??capacity?.poolId],['provenance',sources.assets?.record?.value?.provenance]] as const){
 record('PROJECTION CapacitySource.'+attribute,['CapacitySource.'+attribute],sources.plans?.result.http===200&&capacity?.assetId===sources.assets?.record?.id&&value!==undefined&&value!==null?'PASS':'BLOQUEADO',{representation:'Native plan resource ASSET/POOL, fulfilment provenance from actual referenced asset',field:attribute},{value,resource:capacity,sourceAssetId:sources.assets?.record?.id,availabilityIsNotFulfilmentProvenance:true},{controlPositive:'Own eligible native plan resource joined to its real source asset; no capacity-source CRUD'});
}
const requestRead=sources.request;
const rolePresent=requestRead?.record?.contacts?.pickup!=null;
record('DERIVED ShipmentContact.role',['ShipmentContact.role'],requestRead?.result.http===200&&rolePresent?'PASS':'BLOQUEADO',{role:'PICKUP',representation:'contacts.pickup container key'},{value:rolePresent?'PICKUP':null,contact:requestRead?.record?.contacts?.pickup},{controlPositive:'Own persisted request with pickup contact; no invented role field'});
for(const attr of ['estimatedTolls','borderCostEstimate']){
 const value=sources.routes?.record?.data?.[attr];
 record('UNKNOWN RoutePlan.'+attr,['RoutePlan.'+attr],sources.routes?.result.http===200&&value===null?'PASS':'BLOQUEADO',{value:null,contract:'Unknown estimation remains unknown'},{value},{controlPositive:'Own concrete route GET, typed null estimate contract'});
}
// Workflow writable fields use their real creation command, not a catalog writer.
const workflowFields:any={RoutePlanningPolicy:'route-policies.publish',RouteCorridor:'corridors.publish',CarrierOffer:'offers.create',OfferCostComponent:'offers.create'};
for(const field of fields.filter((r:any)=>workflowFields[r.clase]&&r.ruta_input!=='—')){
 const action=workflowFields[field.clase],recipe=byAction(action),base=structuredClone(recipe.payload);
 if(action==='offers.create'){base.estimatedPickupAt=planRecipe.payload.assignments[0].window.startsAt;base.estimatedDeliveryAt=planRecipe.payload.assignments[0].window.endsAt;base.breakdown=base.breakdown.map((v:any)=>({...v,details:'fixture:f02-concrete-cost'}));}
 for(const operation of ['NULL','OMIT'] as const){
  if(action==='route-policies.publish')base.version='F02_'+randomUUID();
  if(field.clase==='CarrierOffer'&&field.atributo==='supersedesOfferId'){
   const predecessor=await request(`/carriers/${carrier}/opportunities/${recipe.ctx.parentId}/offers`,a,{...base,supersedesOfferId:null});
   if(predecessor.http!==201){for(const prefix of ['DB_FIELD ','HTTP_FIELD '])record(prefix+field.clase+'.'+field.atributo+' '+operation,[field.clase+'.'+field.atributo],'BLOQUEADO',{predecessorHttp:201},predecessor,{controlPositive:'Native attributable own unbooked predecessor offer'});continue;}base.supersedesOfferId=predecessor.body.data.id;
  }
  const row=field.clase+'.'+field.atributo,negative=edit(base,field.ruta_input,operation);
  const accept=operation==='NULL'?field.nullable_dto_input==='True':field.optional_dto_input==='True';
  const db=dbPair('DB_FIELD '+row+' '+operation,[row],workflow(action,base,recipe.ctx),workflow(action,negative,recipe.ctx),accept);
  const path=action==='offers.create'?`/carriers/${carrier}/opportunities/${recipe.ctx.parentId}/offers`:wfPaths[classes[field.clase]];
  const positive=await request(path,a,base);
  if(positive.http===201){const actual=get(positive.body.data,field.ruta_output),expected=get(base,field.ruta_input);record('FIELD roundtrip '+field.clase+'.'+field.atributo+' HTTP comparison',[field.clase+'.'+field.atributo],db.positive.accepted&&sameValue(actual,expected)&&sameValue(get(db.positive.value,field.ruta_output),expected)?'PASS':'BLOQUEADO',{written:expected},{value:actual,dbValue:get(db.positive.value,field.ruta_output)},{controlPositive:'Native offers/policy command exact submitted value, DB and HTTP'});}
  if(action==='route-policies.publish')negative.version='F02_'+randomUUID();const n=await request(path,a,negative);
  record('HTTP_FIELD '+row+' '+operation,[row],positive.http!==201?'BLOQUEADO':n.http===(accept?201:400)?'PASS':'DIFERENCIA',{positiveHttp:201,negativeHttp:accept?201:400},{positiveHttp:positive.http,negativeHttp:n.http,error:n.body.error??null},{controlPositive:'Native '+action+' with a concrete valid payload',inputPath:field.ruta_input});
 }
}
// RoutePlanner methods are exercised for their documented bounded-network semantics.
// Required audit fields have independent native commands and fresh parent versions.
for(const field of fields.filter((f:any)=>['AssetStatusEvent','IncidentUpdate','CapacityReservation'].includes(f.clase)&&f.ruta_input!=='—')){
 const row=field.clase+'.'+field.atributo;
 for(const operation of ['NULL','OMIT'] as const){
  const isEvent=field.clase==='AssetStatusEvent',isHold=field.clase==='CapacityReservation';
  let parent:any,path:string,ctx:any,base:any,action:string;
  if(isEvent){parent=(await request(`/carriers/${carrier}/assets/${refs.asset.id}`)).body.data;path=`/carriers/${carrier}/assets/${refs.asset.id}/events`;ctx={requestId:null,carrierId:carrier,parentId:refs.asset.id,id:null};action='asset-events.create';base={schemaVersion:'2.0',expectedVersion:parent?.version,next:parent?.value?.operatingStatus==='AVAILABLE'?'IN_SERVICE':'AVAILABLE',note:'Synthetic audit '+randomUUID(),reason:'Synthetic required-field control',evidence:ev};}
  else if(!isHold){parent=(await request(`/carriers/${carrier}/executions/${refs.incidentExecutionId}/incidents/${refs.incident?.id}`)).body.data;path=`/carriers/${carrier}/incidents/${refs.incident?.id}/updates`;ctx={requestId:null,carrierId:carrier,parentId:null,id:refs.incident?.id};action='incidents.update';base={schemaVersion:'2.0',expectedVersion:parent?.version,action:'NOTE',note:'Synthetic audit '+randomUUID(),evidence:ev};}
  else {path='/capacity/holds';ctx={requestId:null,carrierId:null,parentId:null,id:null};action='holds.create';base=holdPayload;
   const list=await request('/capacity/holds');for(const hold of list.body.data??[])if(hold.data.bookingId===focalRefs.booking.id&&hold.status==='HELD'){const release=await request('/capacity/holds/'+hold.id+'/releases',a,{schemaVersion:'2.0',expectedVersion:hold.version,note:'Release own QA control before independent required-field pair',evidence:ev});setup.push({action:'Release own focal hold '+hold.id,result:release});}
  }
  if(parent?.version===undefined&&!isHold){for(const prefix of ['DB_FIELD ','HTTP_FIELD '])record(prefix+row+' '+operation,[row],'BLOQUEADO',{positive:'Existing native parent version'},{reason:'Missing native '+(isEvent?'asset':'incident')+' parent GET/version for '+path},{controlPositive:'Native parent GET '+path});continue;}
  const negative=edit(base,field.ruta_input,operation),db=dbPair('DB_FIELD '+row+' '+operation,[row],workflow(action,base,ctx),workflow(action,negative,ctx),false);
  const positive=await request(path,a,base),n=await request(path,a,negative);
  record('HTTP_FIELD '+row+' '+operation,[row],![200,201].includes(positive.http)?'BLOQUEADO':n.http===400?'PASS':'DIFERENCIA',{positiveHttp:isEvent||isHold?201:200,negativeHttp:400},{positiveHttp:positive.http,negativeHttp:n.http,positiveError:positive.body.error??null,error:n.body.error??null},{controlPositive:'Fresh native '+action+' full audit payload',inputPath:field.ruta_input});
  if(isHold&&positive.http===201){const expected=field.atributo==='source'?{reference:base.evidence.reference,verifiedAt:base.evidence.observedAt,validUntil:base.evidence.validUntil,provenanceStatus:base.evidence.provenanceStatus}:get(base,field.ruta_input),actual=get(positive.body.data,field.ruta_output),dbValue=get(db.positive.value,field.ruta_output);record('FIELD roundtrip '+row+' native DB/HTTP '+operation,[row],db.positive.accepted&&sameValue(actual,expected)&&sameValue(dbValue,expected)?'PASS':'BLOQUEADO',{written:expected},{value:actual,dbValue},{controlPositive:'Independent native hold command under authenticated and real HTTP issuer',outputContractCitation:'supabase-v2/supabase/migrations/20261004154048_hac40_workflow.sql:1000',fieldMapping:'source.reference <- evidence.reference; source.verifiedAt <- evidence.observedAt; source.validUntil/provenanceStatus unchanged; provider is not part of this output schema'});}
  if([200,201].includes(positive.http)&&!isHold){const kind=isEvent?'asset-events':'incident-updates';const context={carrierId:carrier,requestId:null,parentId:isEvent?refs.asset.id:refs.incident.id,id:isEvent?positive.body.data.id:null};
   const filter=isEvent?`r->>'id'=${textSql(positive.body.data.id)}`:`r->'data'->>'note'=${textSql(base.note)}`;
   const query=`select r from jsonb_array_elements(public.read_v2_workflow('${ORGA}','${MEMA}',${textSql(kind)},${jsonSql(context)},100,0)) r where ${filter} limit 1`;
   const read=dbPair('DB_AUDIT_READ '+row+' '+operation,[row],query,query,true);
   const list=await request(path);const found=list.body.data?.find((r:any)=>isEvent?r.id===positive.body.data.id:r.data.note===base.note);const expected=get(base,field.ruta_input),dbValue=get(read.positive.value,field.ruta_output),actual=get(found,field.ruta_output);
   record('FIELD roundtrip '+row+' audit DB/HTTP '+operation,[row],read.positive.accepted&&list.http===200&&sameValue(actual,expected)&&sameValue(dbValue,expected)?'PASS':'BLOQUEADO',{written:expected},{value:actual,dbValue,listHttp:list.http},{controlPositive:'Native audit command committed; exact stored event matched by own ID/note'});
  }
 }
}
// Restore availability with a native event before eligibility/snapshot controls.
{const current=await request(`/carriers/${carrier}/assets/${refs.asset.id}`);if(current.body.data?.value.operatingStatus!=='AVAILABLE')setup.push({action:'Restore audit control availability',result:await request(`/carriers/${carrier}/assets/${refs.asset.id}/events`,a,{schemaVersion:'2.0',expectedVersion:current.body.data.version,next:'AVAILABLE',reason:'Restore positive eligibility control',note:'Synthetic restore',evidence:ev})});}
// Embedded offer references are validated through the actual offer command.
const offerRecipe=byAction('offers.create');
for(const [field,relation] of [['coveredAssignmentIds','DK0aJlq7bGL-fGDcFSUt-1'],['coveredServiceIds','cm-v2fix-8']] as const){
 const base=structuredClone(offerRecipe.payload);
 for(const invalid of ['empty','nonexistent'] as const){const bad={...base,[field]:invalid==='empty'?[]:[randomUUID()]};dbPair('RELATION '+relation+' JSON '+invalid,[relation],workflow('offers.create',base,offerRecipe.ctx),workflow('offers.create',bad,offerRecipe.ctx),false);const p=await request(`/carriers/${carrier}/opportunities/${offerRecipe.ctx.parentId}/offers`,a,base),n=await request(`/carriers/${carrier}/opportunities/${offerRecipe.ctx.parentId}/offers`,a,bad);record('RELATION '+relation+' HTTP JSON '+invalid,[relation],p.http!==201?'BLOQUEADO':[400,404].includes(n.http)?'PASS':'DIFERENCIA',{positiveHttp:201,foreignOrAbsentRejected:true},{positiveHttp:p.http,negativeHttp:n.http,error:n.body.error??null},{controlPositive:'Native same-plan own assignment/service JSON references'});}
}
{const base=structuredClone(offerRecipe.payload);const bad={...base,breakdown:[]};dbPair('RELATION 72KwxI-JqKkcPOP_kNa3-1 JSON empty',['72KwxI-JqKkcPOP_kNa3-1'],workflow('offers.create',base,offerRecipe.ctx),workflow('offers.create',bad,offerRecipe.ctx),false);}
// Zero and many are both valid at uncapped UML ends. Fresh native parents avoid
// counting an unrelated tenant's empty table as a positive cardinality control.
const carrierPayload=structuredClone(sources.carriers.record.value);if(carrierPayload.code)carrierPayload.code='F02_'+randomUUID().replaceAll('-','').toUpperCase();if(carrierPayload.registeredName)carrierPayload.registeredName+=' F02 '+randomUUID();
const newCarrier=await request('/carriers',a,carrierPayload);
record('PRECONDITION native cardinality carrier',['Carrier'],newCarrier.http===201?'PASS':'BLOQUEADO',{http:201},newCarrier,{controlPositive:'Clone of current valid native carrier DTO; own issuer creates operator grant'});
if(newCarrier.http===201){
 const c=newCarrier.body.data.id,service=await request(`/carriers/${c}/services`,a,sources.services.record.value);
 if(service.http===201){
  const s=service.body.data.id,assetPath=`/carriers/${c}/assets`,driverPath=`/carriers/${c}/drivers`,lanePath=`/carriers/${c}/services/${s}/lanes`,poolPath=`/carriers/${c}/capacity-pools`;
  const groups=[['O3AsrRVXhiO8iDlZrkKS-188',assetPath,'transport_assets','carrier_id',c],['O3AsrRVXhiO8iDlZrkKS-212',driverPath,'drivers','carrier_id',c],['O3AsrRVXhiO8iDlZrkKS-176',lanePath,'service_lanes','carrier_service_id',s],['O3AsrRVXhiO8iDlZrkKS-197',poolPath,'capacity_pools','carrier_service_id',s]];
  const zero:any={};for(const [id,path] of groups)zero[id]=(await request(path)).body.data;
  const areaTemplate=(await request(catPaths.areas)).body.data;const areas:any={};for(const role of ['PICKUP','DELIVERY']){const template=areaTemplate.find((r:any)=>r.value.role===role);areas[role]=template?await request(`/carriers/${c}/services/${s}/areas`,a,template.value):null;}
  const secondDelivery=areas.DELIVERY?.http===201?await request(`/carriers/${c}/services/${s}/areas`,a,areaTemplate.find((r:any)=>r.value.role==='DELIVERY').value):null;
  const laneTemplate=sources.lanes.record?.value,driverTemplate=sources.drivers.record?.value;
  for(const [id,path,table,column,parent] of groups){
   const created:any[]=[];
   for(let i=0;i<2;i++){let v:any;
    if(table==='transport_assets'){v={...assetValue,serviceId:s,homeDepotId:null,provenance:'OWN',partnerId:null,code:'F02_'+randomUUID().replaceAll('-','').toUpperCase(),roadVehicle:{...assetValue.roadVehicle,plate:'F02-'+randomUUID().slice(0,12).toUpperCase()}};}
    if(table==='drivers'&&driverTemplate)v={...driverTemplate,serviceId:s,portalAccountId:null,fullName:'Synthetic cardinality driver '+randomUUID()};
    if(table==='service_lanes'&&laneTemplate&&areas.PICKUP?.http===201&&areas.DELIVERY?.http===201)v={...laneTemplate,pickupAreaId:areas.PICKUP.body.data.id,deliveryAreaId:i===1&&secondDelivery?.http===201?secondDelivery.body.data.id:areas.DELIVERY.body.data.id};
    if(table==='capacity_pools')v={...captured.catalogFixtures['capacity-pools'],serviceId:s,code:'F02_'+randomUUID().replaceAll('-','').toUpperCase(),provenance:'OWN',partnerId:null};
    if(v)created.push(await request(path,a,v));else created.push({http:null,body:{error:{code:'QA_NATIVE_TEMPLATE_MISSING'}}});
   }
   const many=await request(path),p=created[0],payload=p.http===201?p.body.data.value:null,denial=payload?await request(path,b,payload):null;
   const query=table==='drivers'?`select jsonb_build_object('parentId','${parent}','children',jsonb_array_length(public.read_v2_catalog('${ORGA}','${MEMA}','drivers','${c}',null,null,100,0)))`:`select jsonb_build_object('parentId','${parent}','children',(select count(*) from public.${table} where ${column}='${parent}'))`;
   const db=dbPair('RELATION '+id+' DB many',[id],query,query,true);
   const ok=Array.isArray(zero[id])&&zero[id].length===0&&created.every(r=>r.http===201)&&many.http===200&&many.body.data.length>=2&&db.positive.value?.children>=2&&denial&&[403,404].includes(denial.http);
   record('RELATION '+id+' native 0 and 2 belonging',[id],p.http!==201?'BLOQUEADO':ok?'PASS':'PARCIAL',{zero:0,manyAtLeast:2,foreignWriteDenied:true},{zero:zero[id]?.length,created:created.map(r=>({http:r.http,error:r.body.error??null})),many:many.body.data?.length,dbChildren:db.positive.value?.children,positiveHttp:p.http,negativeHttp:denial?.http},{controlPositive:'Fresh own native parent accepts zero then two valid native children; same issuer accepted, other verified issuer denied',umlRule:'0..*; no invented maximum'});
  }
  const ownAssets=(await request(assetPath)).body.data??[];
  if(ownAssets.length>=2){
   const eventAsset=await request(catPaths.assets,a,{...assetValue,code:'F02_'+randomUUID().replaceAll('-','').toUpperCase(),roadVehicle:{...assetValue.roadVehicle,plate:'F02-'+randomUUID().slice(0,12).toUpperCase()}});
   const eventDetail=catPaths.assets+'/'+eventAsset.body.data?.id,eventPath=eventDetail+'/events',z=await request(eventPath),created:any[]=[];for(const next of ['IN_SERVICE','AVAILABLE']){const current=await request(eventDetail);created.push(await request(eventPath,a,{schemaVersion:'2.0',expectedVersion:current.body.data?.version,next,note:'Synthetic zero/two event',reason:'Synthetic cardinality event',evidence:ev}));}
   const current=await request(eventDetail),payload={schemaVersion:'2.0',expectedVersion:current.body.data?.version,next:'IN_SERVICE',note:'Synthetic foreign negative',reason:'Synthetic permission probe',evidence:ev},denial=await request(eventPath,b,payload),many=await request(eventPath);
   record('RELATION O3AsrRVXhiO8iDlZrkKS-209 native 0 and 2 belonging',['O3AsrRVXhiO8iDlZrkKS-209'],created[0].http!==201?'BLOQUEADO':z.http===200&&z.body.data.length===0&&created.every(r=>r.http===201)&&many.body.data.length>=2&&[403,404].includes(denial.http)?'PASS':'PARCIAL',{zero:0,manyAtLeast:2,foreignWriteDenied:true},{zero:z.body.data?.length,many:many.body.data?.length,positiveHttp:created[0].http,negativeHttp:denial.http,errors:created.map(r=>r.body.error??null)},{controlPositive:'Fresh native asset with no events accepts two native transitions; foreign issuer rejected'});
   // The actual deferred lower bound is evaluated after returning to authenticated.
   const comboBase={schemaVersion:'2.0',serviceId:s,kind:'SYNTHETIC_PAIR',configuration:'Synthetic cardinality control',assetIds:[ownAssets[0].id],coupledWindow:null,evidence:[],combinedTareKg:null,grossWeightLimitKg:null,status:'PROPOSED',compatibilityEvidence:null};
   const native=(v:any)=>`select public.command_v2_catalog('${ORGA}','${MEMA}','vehicle-combinations','${c}',null,null,gen_random_uuid(),null,${jsonSql(v)})->'record'`;
   const deletionHelpers=`create function pg_temp.cp1b_remove_members(i uuid,ids uuid[]) returns jsonb language plpgsql security definer as $$declare backed jsonb;n integer;after_n integer;begin
    if exists(select 1 from pg_constraint where contype='f' and confrelid='public.vehicle_combination_assets'::regclass) then raise exception 'QA_INCOMING_FK_REQUIRES_REVIEW';end if;
    select jsonb_agg(to_jsonb(t)),count(*) into backed,n from public.vehicle_combination_assets t where combination_id=i and transport_asset_id=any(ids);
    if n<>cardinality(ids) then raise exception 'QA_EXPLICIT_MEMBER_BACKUP_MISMATCH';end if;
    delete from public.vehicle_combination_assets where combination_id=i and transport_asset_id=any(ids);select count(*) into after_n from public.vehicle_combination_assets where combination_id=i;
    return jsonb_build_object('backup',backed,'before',n,'after',after_n,'incomingFKs',0);end;$$;grant execute on function pg_temp.cp1b_remove_members(uuid,uuid[]) to authenticated;
    create function pg_temp.cp1b_empty_combination(v jsonb) returns jsonb language plpgsql security invoker as $$declare r jsonb;backup jsonb;begin select public.command_v2_catalog('${ORGA}','${MEMA}','vehicle-combinations','${c}',null,null,gen_random_uuid(),null,v)->'record' into r;select pg_temp.cp1b_remove_members((r->>'id')::uuid,array(select jsonb_array_elements_text(v->'assetIds')::uuid)) into backup;return r||jsonb_build_object('exactMemberBackup',backup);end;$$;grant execute on function pg_temp.cp1b_empty_combination(jsonb) to authenticated;`;
   dbPair('RELATION bR8ZHdLwjZc_sJT4jZ76-1 deferred empty',['bR8ZHdLwjZc_sJT4jZ76-1'],native(comboBase),`select pg_temp.cp1b_empty_combination(${jsonSql(comboBase)})`,false,deletionHelpers);
   const ids=ownAssets.map((r:any)=>r.id);while(ids.length<21){const value={...assetValue,serviceId:s,homeDepotId:null,provenance:'OWN',partnerId:null,code:'F02_'+randomUUID().replaceAll('-','').toUpperCase(),roadVehicle:{...assetValue.roadVehicle,plate:'F02-'+randomUUID().slice(0,12).toUpperCase()}};const created=await request(assetPath,a,value);if(created.http!==201){record('PRECONDITION combination 21 native assets',['VehicleCombination'],'BLOQUEADO',{http:201},created,{controlPositive:'Unique own ROAD asset command'});break;}ids.push(created.body.data.id);}
   if(ids.length===21){dbPair('RELATION bR8ZHdLwjZc_sJT4jZ76-1 maximum 20 vs 21',['bR8ZHdLwjZc_sJT4jZ76-1'],native({...comboBase,assetIds:ids.slice(0,20)}),native({...comboBase,assetIds:ids}),false);dbPair('RELATION bR8ZHdLwjZc_sJT4jZ76-1 foreign asset',['bR8ZHdLwjZc_sJT4jZ76-1'],native(comboBase),native({...comboBase,assetIds:[refs.asset.id]}),false);}
  }
  const zeroOffers=await request(`/carriers/${referenceCarrier?.id}/offers`,b),manyOffers=await request(`/carriers/${carrier}/offers`),pOffer=await request(`/carriers/${carrier}/opportunities/${offerRecipe.ctx.parentId}/offers`,a,offerRecipe.payload),nOffer=await request(`/carriers/${carrier}/opportunities/${offerRecipe.ctx.parentId}/offers`,b,offerRecipe.payload);
  record('RELATION O3AsrRVXhiO8iDlZrkKS-260 native 0 and 2 belonging',['O3AsrRVXhiO8iDlZrkKS-260'],pOffer.http!==201?'BLOQUEADO':zeroOffers.http===200&&zeroOffers.body.data.length===0&&manyOffers.http===200&&manyOffers.body.data.length>=2&&[403,404].includes(nOffer.http)?'PASS':'PARCIAL',{zero:0,manyAtLeast:2,foreignWriteDenied:true},{zero:zeroOffers.body.data?.length,many:manyOffers.body.data?.length,positiveHttp:pOffer.http,negativeHttp:nOffer.http},{controlPositive:'Fresh own carrier has no offers; original own carrier has >=2 native offers and rejects other issuer'});
 }else record('PRECONDITION native cardinality service',['CarrierService'],'BLOQUEADO',{http:201},service,{controlPositive:'Current valid service DTO for freshly created own carrier'});
}
{const plan=await request(`/freight/requests/${refs.request.id}/plans`,a,{...planRecipe.payload,routeId:refs.route.id});if(plan.http===201&&plan.body.data.status==='eligible'){
 const path=`/freight/requests/${refs.request.id}/opportunities`,filter=(r:any)=>r.data.planId===plan.body.data.id||r.parentId===plan.body.data.id,zero=(await request(path)).body.data.filter(filter),payload={...byAction('opportunities.create').payload,planId:plan.body.data.id,assignmentIds:plan.body.data.data.legAssignments.map((r:any)=>r.id)},created=[await request(path,a,payload),await request(path,a,payload)],many=(await request(path)).body.data.filter(filter),denial=await request(path,b,payload);
 record('RELATION O3AsrRVXhiO8iDlZrkKS-251 native 0 and 2 belonging',['O3AsrRVXhiO8iDlZrkKS-251'],created[0].http!==201?'BLOQUEADO':zero.length===0&&many.length>=2&&created.every(r=>r.http===201)&&[403,404].includes(denial.http)?'PASS':'PARCIAL',{zero:0,manyAtLeast:2,foreignWriteDenied:true},{zero:zero.length,many:many.length,positiveHttp:created[0].http,negativeHttp:denial.http,errors:created.map(r=>r.body.error??null)},{controlPositive:'Fresh eligible native plan initially has zero opportunities, then two own invitations; foreign actor denied'});
 }else record('RELATION O3AsrRVXhiO8iDlZrkKS-251 native 0 and 2 belonging',['O3AsrRVXhiO8iDlZrkKS-251'],'BLOQUEADO',{planEligible:true},plan,{controlPositive:'Native plan before invitations'});}
const saved=await request('/freight/requests/'+refs.request.id);
const find=await request(`/freight/requests/${refs.request.id}/route-alternatives`,a,{schemaVersion:'2.0',policyId:routeRecipe.payload.policyId,expectedDraftVersion:saved.body.data.draftVersion,maxLegs:8,maxAlternatives:20});
const search=find.body.data?.search,alternatives=find.body.data?.alternatives;
const findOk=find.http===201&&search?.algorithmVersion==='BOUNDED_SIMPLE_PATHS_V1'&&search.universe==='ACTIVE_PUBLISHED_DIRECTED_NETWORK'&&search.completeWithinBounds===true&&search.maxLegs===8&&search.returnedPaths===alternatives.length&&alternatives.length<=20&&alternatives.every((r:any)=>r.data.legs.length<=8&&r.data.planner.search.algorithmVersion===search.algorithmVersion&&r.data.planner.search.corridorVersions.length>0);
record('METHOD RoutePlanner.findAlternatives',['RoutePlanner','RoutePlan','RoutePlanningPolicy'],find.http!==201?'BLOQUEADO':findOk?'PASS':'DIFERENCIA',{http:201,algorithm:'BOUNDED_SIMPLE_PATHS_V1',universe:'ACTIVE_PUBLISHED_DIRECTED_NETWORK',maxLegs:8,maxAlternatives:20,completeWithinBounds:true},find,{controlPositive:'Persisted own request, policy and published connected native corridor',certifiesOnly:'Bounded network search result; no claim about arbitrary unbounded optimality'});
for(const actor of [b,null]){const denial=await request(`/freight/requests/${refs.request.id}/route-alternatives`,actor,{schemaVersion:'2.0',policyId:routeRecipe.payload.policyId,expectedDraftVersion:saved.body.data.draftVersion,maxLegs:8,maxAlternatives:20});record('METHOD findAlternatives isolation '+(actor?'B':'anonymous'),['RoutePlanner'],!findOk?'BLOQUEADO':denial.http===(actor?404:401)?'PASS':'DIFERENCIA',{positiveHttp:201,negativeHttp:actor?404:401},{positiveHttp:find.http,negativeHttp:denial.http},{controlPositive:'METHOD RoutePlanner.findAlternatives'});}
const explain=await request('/routes/'+refs.route.id+'/explanation');
const routeRead=await request('/routes/'+refs.route.id);
record('METHOD RoutePlanner.explain',['RoutePlanner','RoutePlan'],explain.http===200&&JSON.stringify(explain.body.data.legs)===JSON.stringify(routeRead.body.data.data.legs)?'PASS':'BLOQUEADO',{http:200,scope:'PERSISTED_ROUTE_SNAPSHOT'},explain,{controlPositive:'Own native route GET HTTP '+routeRead.http});
for(const actor of [b,null]){
 const denial=await request('/routes/'+refs.route.id+'/explanation',actor);
 record('METHOD explain isolation '+(actor?'B':'anonymous'),['RoutePlanner'],explain.http!==200?'BLOQUEADO':denial.http===(actor?404:401)?'PASS':'DIFERENCIA',{http:actor?404:401},{http:denial.http},{controlPositive:'METHOD RoutePlanner.explain'});
}

// Bounds measured at their valid maxima and one step outside, each with a fresh HTTP control.
for(const [field,max] of [['maxLegs',8],['maxAlternatives',20]] as const){
 const input={schemaVersion:'2.0',policyId:routeRecipe.payload.policyId,expectedDraftVersion:saved.body.data.draftVersion,maxLegs:8,maxAlternatives:20};
 const positive=await request(`/freight/requests/${refs.request.id}/route-alternatives`,a,input);
 for(const invalid of [0,max+1]){const negative=await request(`/freight/requests/${refs.request.id}/route-alternatives`,a,{...input,[field]:invalid});record('BOUNDS RoutePlanner '+field+' '+invalid,['RoutePlanner','RoutePlanningPolicy'],positive.http!==201?'BLOQUEADO':negative.http===400?'PASS':'DIFERENCIA',{positiveHttp:201,negativeHttp:400,validMaximum:max},{positiveHttp:positive.http,negativeHttp:negative.http,error:negative.body.error??null},{controlPositive:'Real bounded-network search at '+max});}
}
const corridorRecipe=byAction('corridors.publish');
const restrictions100=Array.from({length:100},(_,i)=>({code:'QA_'+i,description:'Synthetic restriction '+i,required:false,evidence:null}));
dbPair('CARDINALITY restrictions max 100 vs 101',['RouteCorridor.restrictions','RouteCorridor'],workflow('corridors.publish',{...corridorRecipe.payload,restrictions:restrictions100},corridorRecipe.ctx),workflow('corridors.publish',{...corridorRecipe.payload,restrictions:[...restrictions100,{code:'QA_100',description:'One beyond bound',required:false,evidence:null}]},corridorRecipe.ctx),false);
const waypoint100=Array.from({length:100},(_,i)=>({...corridorRecipe.payload.waypoints[0],kind:i%2?'REST':'FUEL'}));
dbPair('CARDINALITY waypoints max 100 vs 101',['RouteWaypoint','RouteLeg','RouteCorridor'],workflow('corridors.publish',{...corridorRecipe.payload,waypoints:waypoint100},corridorRecipe.ctx),workflow('corridors.publish',{...corridorRecipe.payload,waypoints:[...waypoint100,waypoint100[0]]},corridorRecipe.ctx),false);
// A revision of mutable inputs must leave previously persisted route/plan/offer snapshots unchanged.
const beforeSnapshots:any={};for(const [k,path] of Object.entries({route:'/routes/'+refs.route.id,plan:'/plans/'+refs.plan.id,offer:'/offers/'+refs.offer.id})){beforeSnapshots[k]=await request(path);}
async function snapshotMutation(name:string,mutate:()=>Promise<any>){
 const paths={route:'/routes/'+refs.route.id,plan:'/plans/'+refs.plan.id,offer:'/offers/'+refs.offer.id};
 const before:any={};for(const [kind,path] of Object.entries(paths))before[kind]=await request(path);
 const mutation=await mutate();
 for(const [kind,path] of Object.entries(paths)){
  const after=await request(path),unchanged=before[kind].http===200&&after.http===200&&JSON.stringify(before[kind].body.data)===JSON.stringify(after.body.data);
  record('IMMUTABLE '+kind+' after '+name+' mutation',[kind==='route'?'RoutePlan':kind==='plan'?'TransportPlanCandidate':'CarrierOffer'],mutation.http!==200&&mutation.http!==201||before[kind].http!==200?'BLOQUEADO':unchanged?'PASS':'DIFERENCIA',{successfulSourceMutation:true,snapshotIdVersionAndContentUnchanged:true},{mutationHttp:mutation.http,mutationError:mutation.body.error??null,before:before[kind],after,unchanged},{controlPositive:'Native source mutation accepted and own prior snapshot read'});
 }
}
// A partner snapshot must reference the partner through an actual native asset.
const partnerCreated=await request(`/carriers/${carrier}/partners`,a,{schemaVersion:'2.0',registeredName:'Synthetic snapshot partner '+randomUUID(),partnerCarrierRef:null,agreementValidFrom:'2026-01-01T00:00:00Z',agreementValidUntil:'2030-01-01T00:00:00Z',status:'ACTIVE',coverageEvidence:'fixture:f02-linked-partner'});
let partnerPlan:any,partnerOffer:any,partnerAsset:any;
if(partnerCreated.http===201){
 const assetNow=await request(`/carriers/${carrier}/assets/${refs.asset.id}`);
 partnerAsset=await request(`/carriers/${carrier}/assets/${refs.asset.id}/revisions`,a,{expectedVersion:assetNow.body.data.version,value:{...assetNow.body.data.value,provenance:'PARTNER',partnerId:partnerCreated.body.data.id}});
 if(partnerAsset.http===200){
  partnerPlan=await request(`/freight/requests/${refs.request.id}/plans`,a,{...planRecipe.payload,routeId:refs.route.id});
  if(partnerPlan.http===201&&partnerPlan.body.data.status==='eligible'){
   const ids=partnerPlan.body.data.data.legAssignments.map((x:any)=>x.id);
   const opp=await request(`/freight/requests/${refs.request.id}/opportunities`,a,{...byAction('opportunities.create').payload,planId:partnerPlan.body.data.id,assignmentIds:ids});
   if(opp.http===201)partnerOffer=await request(`/carriers/${carrier}/opportunities/${opp.body.data.id}/offers`,a,{...byAction('offers.create').payload,planCandidateId:partnerPlan.body.data.id,coveredAssignmentIds:ids});
  }
 }
}
const partnerOk=partnerCreated.http===201&&partnerAsset?.http===200&&partnerAsset.body.data.value.partnerId===partnerCreated.body.data.id&&partnerPlan?.body.data.status==='eligible'&&partnerOffer?.http===201;
record('PRECONDITION partner linked snapshot',['FulfilmentPartner','TransportPlanCandidate'],partnerOk?'PASS':'BLOQUEADO',{partnerLinked:true,planEligible:true,offerHttp:201},{partnerHttp:partnerCreated.http,assetHttp:partnerAsset?.http,planHttp:partnerPlan?.http,planStatus:partnerPlan?.body.data?.status,offerHttp:partnerOffer?.http,errors:[partnerCreated.body.error,partnerAsset?.body.error,partnerPlan?.body.error,partnerOffer?.body.error].filter(Boolean)},{controlPositive:'Native partner -> asset provenance -> eligible plan -> offer; no booking'});
if(partnerOk){const savedPlan=refs.plan,savedOffer=refs.offer;refs.plan=partnerPlan.body.data;refs.offer=partnerOffer.body.data;
 await snapshotMutation('partner',async()=>{const path=`/carriers/${carrier}/partners/${partnerCreated.body.data.id}`;const current=await request(path);return request(path+'/revisions',a,{expectedVersion:current.body.data.version,value:{...current.body.data.value,coverageEvidence:'fixture:f02-valid-partner-revision'}});});refs.plan=savedPlan;refs.offer=savedOffer;
}else for(const kind of ['route','plan','offer'])record('IMMUTABLE '+kind+' after partner mutation',[kind==='route'?'RoutePlan':kind==='plan'?'TransportPlanCandidate':'CarrierOffer'],'BLOQUEADO',{linkedEligiblePartnerControl:true},{reason:'Native linked-partner prerequisite failed; see PRECONDITION partner linked snapshot'},{controlPositive:'PRECONDITION partner linked snapshot'});
await snapshotMutation('source',async()=>{const path=`/carriers/${carrier}/assets/${refs.asset.id}`,current=await request(path);return request(path+'/revisions',a,{expectedVersion:current.body.data.version,value:{...current.body.data.value,evidence:'fixture:f02-source-revision'}});});
{const {cargoUnitTotalsV2}=await import(pathToFileURL(root+'/cargomesh/src/shared/schemas/v2/freight-request.ts').href);const units=captured.requestPayload.cargoSpecification.units.map((u:any)=>({...u,quantity:u.quantity+1})),totals=cargoUnitTotalsV2(units),value={...captured.requestPayload,cargoSpecification:{...captured.requestPayload.cargoSpecification,units,totalWeightKg:totals.weightKg,totalVolumeM3:totals.volumeM3}};
 const draft=await request('/freight/requests',a,captured.requestPayload),positive=draft.http===201?await request('/freight/requests/'+draft.body.data.id+'/revisions',a,{expectedDraftVersion:draft.body.data.draftVersion,value}):draft;
 const published=await request('/freight/requests/'+refs.request.id),negative=await request('/freight/requests/'+refs.request.id+'/revisions',a,{expectedDraftVersion:published.body.data.draftVersion,value});
 record('LOAD_REVISION_CONTROL native DRAFT vs published boundary',['FreightRequest','CargoSpecification'],positive.http!==200?'BLOQUEADO':negative.http===409&&negative.body.error?.code==='INVALID_TRANSITION'?'PASS':'DIFERENCIA',{positiveHttp:200,publishedRevisionRejected:true},{positiveHttp:positive.http,negativeHttp:negative.http,totals,error:negative.body.error??null},{controlPositive:'Native new DRAFT accepts coherent revised cargo; published source rejects REVISE per lifecycle, so no snapshot mutation is claimed',contractCitation:'supabase-v2/supabase/migrations/20261004025720_hac40_full_request_contract.sql:1046'});
}
await snapshotMutation('load',async()=>{const path='/freight/requests/'+refs.request.id,current=await request(path);const {cargoUnitTotalsV2}=await import(pathToFileURL(root+'/cargomesh/src/shared/schemas/v2/freight-request.ts').href);const units=captured.requestPayload.cargoSpecification.units.map((u:any)=>({...u,quantity:u.quantity+1}));const totals=cargoUnitTotalsV2(units);return request(path+'/revisions',a,{expectedDraftVersion:current.body.data.draftVersion,value:{...captured.requestPayload,cargoSpecification:{...captured.requestPayload.cargoSpecification,units,totalWeightKg:totals.weightKg,totalVolumeM3:totals.volumeM3}}});});
const corridorCurrent=await request('/routing/corridors/'+refs.corridor.id);
const reviseCorridor=await request('/routing/corridors/'+refs.corridor.id+'/revisions',a,{expectedVersion:corridorCurrent.body.data.version,value:{...corridorCurrent.body.data.data,estimatedDistanceKm:corridorCurrent.body.data.data.estimatedDistanceKm+1}});
for(const [k,path] of Object.entries({route:'/routes/'+refs.route.id,plan:'/plans/'+refs.plan.id,offer:'/offers/'+refs.offer.id})){
 const after=await request(path);const unchanged=JSON.stringify(beforeSnapshots[k].body.data)===JSON.stringify(after.body.data);
 record('IMMUTABLE '+k+' after corridor revision',[k==='route'?'RoutePlan':k==='plan'?'TransportPlanCandidate':'CarrierOffer'],reviseCorridor.http!==200||beforeSnapshots[k].http!==200?'BLOQUEADO':unchanged?'PASS':'DIFERENCIA',{revisionHttp:200,snapshotUnchanged:true},{revisionHttp:reviseCorridor.http,revisionError:reviseCorridor.body.error??null,before:beforeSnapshots[k],after,unchanged},{controlPositive:'Successful mutable corridor revision and own prior snapshot GET'});
}
let condition:any;
await snapshotMutation('condition',async()=>{condition=await request('/routing/conditions',a,{schemaVersion:'2.0',active:true,corridorId:refs.corridor.id,kind:'CLOSURE',location:corridorRecipe.payload.waypoints[0].location,observedAt:ev.observedAt,validUntil:null,source:ev,confidence:'SIMULATED'});return condition;});
if(condition.http===201){const replan=await request('/routes/'+refs.route.id+'/replans',a,{schemaVersion:'2.0',expectedVersion:refs.route.version,conditionId:condition.body.data.id,maxLegs:8,maxAlternatives:20});
 record('METHOD RoutePlanner.replan CLOSURE',['RoutePlanner','RouteCondition','RoutePlan'],replan.http!==201?'BLOQUEADO':replan.body.data.decision?.requiresSelection===true&&replan.body.data.alternatives.every((r:any)=>!r.data.corridorIds.includes(refs.corridor.id)||r.status==='ineligible'&&r.data.reasons.includes('ROUTE_CLOSED'))&&(!replan.body.data.decision.recommendedRouteId||replan.body.data.alternatives.find((r:any)=>r.id===replan.body.data.decision.recommendedRouteId)?.status==='eligible')?'PASS':'DIFERENCIA',{http:201,closedCorridorNeverEligibleOrRecommended:true,retainsRejectedSnapshots:true,requiresSelection:true},replan,{controlPositive:'Published closure plus existing own route',precondition:condition});
}else record('METHOD RoutePlanner.replan CLOSURE',['RoutePlanner','RouteCondition'],'BLOQUEADO',{preconditionHttp:201},condition);
for(const actor of [b,null]){const denial=await request('/routes/'+refs.route.id+'/replans',actor,{schemaVersion:'2.0',expectedVersion:refs.route.version,conditionId:condition?.body.data?.id??refs.corridor.id,maxLegs:8,maxAlternatives:20});record('METHOD replan isolation '+(actor?'B':'anonymous'),['RoutePlanner'],condition.http!==201?'BLOQUEADO':denial.http===(actor?404:401)?'PASS':'DIFERENCIA',{positiveHttp:201,negativeHttp:actor?404:401},{positiveHttp:condition.http,negativeHttp:denial.http},{controlPositive:'METHOD RoutePlanner.replan CLOSURE'});}

write('CP2_RESULTADOS.json',{sha:process.env.HAC44_SOURCE_SHA,evidence,complete:true,matricesChanged:false,hostedAccess:false,passwordsPersisted:false});
complete=true;
}finally{for(const client of clients)await client.auth.signOut({scope:'local'});await transport.stop();}
console.log('Coverage campaign completed; individual results preserved');
