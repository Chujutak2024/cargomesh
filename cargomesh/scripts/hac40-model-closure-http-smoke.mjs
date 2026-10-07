// Real authenticated HTTP against a disposable LOCAL V2 fixture; never hosted.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { WorkflowRecordV2Schema } from "../src/shared/schemas/v2/workflow.ts";
import { RoutePlannerResultV2Schema } from "../src/shared/schemas/v2/route-planner.ts";
const root=resolve(import.meta.dirname,"../..");
const app=process.env.HAC40_APP_URL ?? "http://127.0.0.1:3184";
const api=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password=process.env.HAC12_LOCAL_QA_PASSWORD;
if (!api || !anon || !password || [app,api].some(u=>!["localhost","127.0.0.1"].includes(new URL(u).hostname))) throw new Error("Dedicated local stack required.");
const statePath=resolve(root,"tmp/hac40-model-closure-http-state.json");
if(existsSync(statePath)) throw new Error("Fixture state exists; cleanup before retry.");
const python=process.env.HAC40_PYTHON ?? "python";
const auth=createClient(api,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const other=createClient(api,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const a=await auth.auth.signInWithPassword({email:"qa-v2-a@cargomesh.test",password});assert.equal(a.error,null);
const b=await other.auth.signInWithPassword({email:"qa-v2-b@cargomesh.test",password});assert.equal(b.error,null);
const token=a.data.session.access_token,otherToken=b.data.session.access_token;
const results=[];let state;
function fixture(action){execFileSync(python,[resolve(root,"scripts/hac40_workflow_local_fixture.py"),action,"--state",statePath],{cwd:root,stdio:"pipe"});}
function remember(name,record){state.refs[name]=record;writeFileSync(statePath,JSON.stringify(state,null,2));return record;}
async function call(path,body,key=crypto.randomUUID(),access=token){
 const response=await fetch(new URL("/api/v2"+path,app),{method:body?"POST":"GET",headers:{...(access?{Authorization:`Bearer ${access}`} :{}),
  ...(body?{"Content-Type":"application/json","Idempotency-Key":key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json()};
}
function check(name,r,expected){assert.equal(r.status,expected,`${name}: ${JSON.stringify(r.body)}`);results.push({name,status:"PASS",http:r.status});return r.body;}
const carrier="c2340000-0000-4000-8000-000000000001";
const evidence={reference:"fixture:model-closure",provider:"Synthetic local QA",observedAt:"2020-01-01T00:00:00Z",validUntil:"2030-01-01T00:00:00Z",provenanceStatus:"SIMULATED"};
const audit={schemaVersion:"2.0",expectedVersion:1,note:"Model closure QA",evidence};
try{
 fixture("prepare");state=JSON.parse(readFileSync(statePath,"utf8"));const refs=state.refs;
 const searchPath=`/freight/requests/${refs.request.id}/route-alternatives`;
 const searchInput={schemaVersion:"2.0",policyId:refs.policy.id,expectedDraftVersion:2,maxLegs:3,maxAlternatives:10};const searchKey=crypto.randomUUID();
 const searches=await Promise.all([call(searchPath,searchInput,searchKey),call(searchPath,searchInput,searchKey)]);
 assert.deepEqual(searches.map(r=>r.status).sort(),[200,201],JSON.stringify(searches));
 const search=check("find alternatives",searches.find(r=>r.status===201),201);RoutePlannerResultV2Schema.parse(search.data);
 const concurrentSearch=check("concurrent search same key",searches.find(r=>r.status===200),200);
 assert.deepEqual(concurrentSearch.data,search.data);
 assert.ok(search.data.alternatives.length);const route=search.data.alternatives[0];assert.equal(route.kind,"routes");
 check("search replay",await call(searchPath,searchInput,searchKey),200);
 check("search conflict",await call(searchPath,{...searchInput,maxLegs:2},searchKey),409);
 check("search tenant B",await call(searchPath,searchInput,crypto.randomUUID(),otherToken),404);
 check("search anonymous",await call(searchPath,searchInput,crypto.randomUUID(),null),401);
 const duplicateCorridor=check('B01 corridor source',await call(`/routing/corridors/${refs.route.data.corridorIds[0]}`),200).data;
 remember('alternative-corridor',check('B01 second path',await call('/routing/corridors',duplicateCorridor.data),201).data);
 const limited=check('search maxAlternatives=1',await call(searchPath,{...searchInput,maxAlternatives:1}),201);
 assert.equal(limited.data.alternatives.length,1);assert.ok(limited.data.search.evaluatedPaths>=2);assert.equal(limited.data.search.presentationTruncated,true);
 check('search stale request',await call(searchPath,{...searchInput,expectedDraftVersion:999}),409);
 const {expectedDraftVersion:discardedVersion,...unversionedSearch}=searchInput;
 check('search missing request version',await call(searchPath,unversionedSearch),400);
 const explanation=check("explain selected route",await call(`/routes/${route.id}/explanation`),200);
 assert.equal(explanation.data.planner.graphVersion,route.data.planner.graphVersion);assert.equal(explanation.data.currentAvailabilityConfirmed,false);
 assert.equal(explanation.data.planner.search.graphVersion,search.data.search.graphVersion);
 assert.equal(explanation.data.planner.search.algorithmVersion,"BOUNDED_SIMPLE_PATHS_V1");
 check("explanation tenant B",await call(`/routes/${route.id}/explanation`,null,undefined,otherToken),404);
 const assignments=refs.plan.data.legAssignments.map(g=>({legSequence:g.sequence,serviceId:g.serviceId,
  laneId:refs.plan.data.assignments.find(a=>a.legAssignmentId===g.id)?.resource.laneId ?? "c2380000-0000-4000-8000-000000000001",
  window:g.window,resources:g.resources.map(r=>({calendarId:r.resource.calendarId,assetId:r.resource.assetId,
   capacityPoolId:r.resource.poolId,combinationId:r.resource.combinationId,role:r.resource.role,
   allocations:r.allocations.map(l=>({unitIndex:l.unitIndex,quantity:l.quantity}))}))}));
 const planBody=check("new plan for partner",await call(`/freight/requests/${refs.request.id}/plans`,{schemaVersion:"2.0",routeId:refs.route.id,assignments}),201);
 const plan=remember("model-plan",planBody.data);WorkflowRecordV2Schema.parse(plan);
 async function partner(name,c=carrier,ends="2030-01-01T00:00:00Z"){
  const value={schemaVersion:"2.0",registeredName:name,partnerCarrierRef:null,agreementValidFrom:"2020-01-01T00:00:00Z",agreementValidUntil:ends,status:"ACTIVE",coverageEvidence:"fixture:agreement"};
  return remember(name,check(name,await call(`/carriers/${c}/partners`,value),201).data);
 }
 const p=await partner("model-partner"),expired=await partner("expired-partner",carrier,"2020-02-01T00:00:00Z"),foreign=await partner("foreign-partner","c2390000-0000-4000-8000-000000000001");
 const partnerPath=`/plans/${plan.id}/assignments/${plan.data.legAssignments[0].id}/partner`,key=crypto.randomUUID();
 const linked=check("assign partner",await call(partnerPath,{...audit,partnerId:p.id},key),200);
 assert.equal(linked.data.data.legAssignments[0].fulfilmentPartnerId,p.id);
 check("partner replay",await call(partnerPath,{...audit,partnerId:p.id},key),200);
 check("partner conflict",await call(partnerPath,{...audit,partnerId:null},key),409);
 check("partner expired",await call(partnerPath,{...audit,expectedVersion:2,partnerId:expired.id}),409);
 check("partner foreign carrier",await call(partnerPath,{...audit,expectedVersion:2,partnerId:foreign.id}),400);
 check("partner stale",await call(partnerPath,{...audit,partnerId:null}),409);
 check("partner tenant B",await call(partnerPath,{...audit,expectedVersion:2,partnerId:p.id},undefined,otherToken),404);
 const readPlan=check("partner persisted GET",await call(`/plans/${plan.id}`),200);
 assert.equal(readPlan.data.data.legAssignments[0].fulfilmentPartnerId,p.id);assert.equal(readPlan.data.version,2);
 const partnerRace=await Promise.all([call(partnerPath,{...audit,expectedVersion:2,partnerId:p.id}),
  call(partnerPath,{...audit,expectedVersion:2,partnerId:p.id})]);
 check("concurrent partner winner",partnerRace.find(r=>r.status===200),200);
 check("concurrent partner stale",partnerRace.find(r=>r.status===409),409);
 const condition=remember("model-condition",check("publish route condition",await call("/routing/conditions",{schemaVersion:"2.0",active:true,
  corridorId:refs.corridor.id,kind:"CLOSURE",location:refs.route.data.origin,observedAt:new Date(Date.now()-60000).toISOString(),
  validUntil:new Date(Date.now()+86400000).toISOString(),source:evidence,confidence:"SIMULATED"}),201).data);
 const incident=remember("model-incident",check("create incident",await call(`/carriers/${carrier}/executions/${refs.execution.id}/incidents`,{
  schemaVersion:"2.0",kind:"ROAD_CLOSURE",severity:"WARNING",occurredAt:new Date().toISOString(),location:null,
  description:"Synthetic closure on execution route",evidence:[evidence]}),201).data);
 const incidentPath=`/carriers/${carrier}/incidents/${incident.id}/conditions`,incidentKey=crypto.randomUUID();
 const inc=check("associate condition",await call(incidentPath,{...audit,conditionIds:[condition.id]},incidentKey),200);
 assert.deepEqual(inc.data.data.routeConditionIds,[condition.id]);
 check("condition replay",await call(incidentPath,{...audit,conditionIds:[condition.id]},incidentKey),200);
 check("condition conflict",await call(incidentPath,{...audit,conditionIds:[]},incidentKey),409);
 check("condition unknown",await call(incidentPath,{...audit,expectedVersion:2,conditionIds:[crypto.randomUUID()]}),400);
 check("condition tenant B",await call(incidentPath,{...audit,expectedVersion:2,conditionIds:[condition.id]},undefined,otherToken),403);
 const incRead=check("condition rollback GET",await call(`/carriers/${carrier}/executions/${refs.execution.id}/incidents/${incident.id}`),200);
 assert.deepEqual(incRead.data.data.routeConditionIds,[condition.id]);assert.equal(incRead.data.version,2);
 const conditionRaceKey=crypto.randomUUID();
 const conditionRace=await Promise.all([call(incidentPath,{...audit,expectedVersion:2,conditionIds:[condition.id]},conditionRaceKey),
  call(incidentPath,{...audit,expectedVersion:2,conditionIds:[condition.id]},conditionRaceKey)]);
 check("concurrent condition commit",conditionRace[0],200);check("concurrent condition replay",conditionRace[1],200);
 assert.deepEqual(conditionRace[0].body.data,conditionRace[1].body.data);
 assert.equal(conditionRace.filter(r=>r.body.meta.idempotentReplay).length,1);
 const replanPath=`/routes/${refs.route.id}/replans`,replanInput={schemaVersion:"2.0",expectedVersion:1,conditionId:condition.id,maxLegs:3,maxAlternatives:10},replanKey=crypto.randomUUID();
 const replan=check("replan current condition",await call(replanPath,replanInput,replanKey),201);RoutePlannerResultV2Schema.parse(replan.data);
 assert.equal(replan.data.decision.requiresSelection,true);assert.equal(replan.data.decision.originalRouteId,refs.route.id);
 check("replan replay",await call(replanPath,replanInput,replanKey),200);
 check("replan stale",await call(replanPath,{...replanInput,expectedVersion:99}),409);
 check("replan unknown condition",await call(replanPath,{...replanInput,conditionId:crypto.randomUUID()}),400);
 check("replan tenant B",await call(replanPath,replanInput,undefined,otherToken),404);
 // Corridor payload regressions use real authenticated revisions and search commits.
 const payloadSource=check('payload corridor GET',await call(`/routing/corridors/${refs.route.data.corridorIds[0]}`),200).data;
 const corridor=remember('payload-test-corridor',check('payload isolated corridor',await call('/routing/corridors',payloadSource.data),201).data);
 const corridorId=corridor.id;
 let corridorVersion=corridor.version;
 for(const [name,limit,reason] of [['overweight',100,'ROUTE_PAYLOAD_LIMIT_EXCEEDED'],['equal',1000,null],['missing',null,'ROUTE_PAYLOAD_LIMIT_UNKNOWN'],['expired',10000,'ROUTE_PAYLOAD_LIMIT_UNKNOWN'],['unproven',10000,'ROUTE_PAYLOAD_LIMIT_UNKNOWN']]) {
  const revision=check(`payload ${name} revision`,await call(`/routing/corridors/${corridorId}/revisions`,
   {expectedVersion:corridorVersion,value:{...corridor.data,payloadLimitKg:limit,...(name==='expired'?{validUntil:'2020-01-01T00:00:00Z'}:{}),...(name==='unproven'?{limitsEvidence:null}:{})}}),200);
  corridorVersion=revision.data.version;
  const found=check(`payload ${name} search`,await call(searchPath,searchInput),201);
  const affected=found.data.alternatives.filter(r=>r.data.corridorIds.includes(corridorId));
  assert.ok(affected.length);
  for(const route of affected){
   if(reason){assert.ok(route.data.reasons.includes(reason));assert.notEqual(route.status,'eligible');if(name==='overweight')assert.equal(route.status,'ineligible');}
   else {assert.ok(!route.data.reasons.includes('ROUTE_PAYLOAD_LIMIT_EXCEEDED'));assert.equal(route.status,'eligible');}
  }
 }
 console.log(`PASS: ${results.length}/${results.length} authenticated HTTP controls for partners, incident conditions, find/replan/explain.`);
 writeFileSync(resolve(root,"tmp/model-closure-http-results.json"),JSON.stringify(results,null,2));
}finally{
 if(state){fixture("cleanup");unlinkSync(statePath);}
 await auth.auth.signOut({scope:"global"});await other.auth.signOut({scope:"global"});
}
