import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RoutePlannerServiceV2, type RoutePlannerRepositoryV2 } from "./route-planner-service";
import { WorkflowServiceV2 } from "./workflow-service";

const id="00000000-0000-4000-8000-000000000001", org="00000000-0000-4000-8000-000000000002";
const actor={organizationId:org,memberId:id};
const input={schemaVersion:"2.0",policyId:id,maxLegs:3,maxAlternatives:2};
const result=()=>({alternatives:[],decision:null,search:{algorithmVersion:"BOUNDED_SIMPLE_PATHS_V1",
 requestId:id,policyId:id,graphVersion:"a".repeat(64),maxLegs:3,evaluatedPaths:0,returnedPaths:0,
 completeWithinBounds:true,presentationTruncated:false,universe:"ACTIVE_PUBLISHED_DIRECTED_NETWORK",evaluatedAt:"2026-10-07T12:00:00Z"}});
const workflow=new WorkflowServiceV2({async read(){return []},async command(){throw new Error("UNEXPECTED_WRITE")} });
describe("RoutePlanner authenticated boundary",()=>{
 it("rejects injected scope, missing key and unbounded search before database access",async()=>{
  const repo:RoutePlannerRepositoryV2={async command(){throw new Error("UNEXPECTED_DATABASE_ACCESS")}};
  const service=new RoutePlannerServiceV2(repo,workflow);
  for(const body of [{...input,organizationId:org},{...input,maxLegs:9},{...input,maxAlternatives:21}])
   await assert.rejects(service.command(actor,"find",id,body,id),{name:"ZodError"});
  await assert.rejects(service.command(actor,"find",id,input),{name:"ZodError"});
 });
 it("preserves an explicit empty universe and authorized replay",async()=>{
  const repo:RoutePlannerRepositoryV2={async command(received,action,target,key,value){
   assert.deepEqual(received,actor);assert.equal(action,"find");assert.equal(target,id);assert.equal(key,id);
   assert.deepEqual(value,input);return {result:result(),replay:true};}};
  const response=await new RoutePlannerServiceV2(repo,workflow).command(actor,"find",id,input,id);
  assert.deepEqual(response.data.alternatives,[]);assert.equal(response.meta.idempotentReplay,true);
 });
 it("rejects inconsistent path counts and response metadata",async()=>{
  for(const search of [{...result().search,requestId:org},{...result().search,returnedPaths:1},
   {...result().search,maxLegs:8},{...result().search,policyId:org}]) {
   const repo:RoutePlannerRepositoryV2={async command(){return {result:{...result(),search},replay:false}}};
   await assert.rejects(new RoutePlannerServiceV2(repo,workflow).command(actor,"find",id,input,id),/metadata mismatch/);
  }
 });
 it("cannot advertise an exhaustive search when the stored result says otherwise",async()=>{
  const repo:RoutePlannerRepositoryV2={async command(){return {result:{...result(),search:{...result().search,completeWithinBounds:false}},replay:false}}};
  await assert.rejects(new RoutePlannerServiceV2(repo,workflow).command(actor,"find",id,input,id),{name:"ZodError"});
 });
 it("checks replan decision correlation instead of accepting an unrelated condition",async()=>{
  const repo:RoutePlannerRepositoryV2={async command(){return {result:{...result(),decision:{originalRouteId:id,
   conditionId:org,recommendedRouteId:null,action:"NO_ALTERNATIVE",requiresSelection:true}},replay:false}}};
  await assert.rejects(new RoutePlannerServiceV2(repo,workflow).command(actor,"replan",id,
   {schemaVersion:"2.0",expectedVersion:1,conditionId:id,maxLegs:3,maxAlternatives:2},id),/metadata mismatch/);
 });
 it("explanation cannot fabricate an absent route",async()=>{
  const repo:RoutePlannerRepositoryV2={async command(){throw new Error("UNEXPECTED_WRITE")}};
  await assert.rejects(new RoutePlannerServiceV2(repo,workflow).explain(actor,id),/Resource not found/);
 });
});
