import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorkflowServiceV2, type WorkflowRepositoryV2 } from "./workflow-service";
import { WorkflowInputsV2, WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
const id="00000000-0000-4000-8000-000000000001", org="00000000-0000-4000-8000-000000000002";
const actor={organizationId:org,memberId:id};
const context={requestId:null,carrierId:null,parentId:null,id:null};
const evidence={reference:"inspection:one",provider:"QA",observedAt:"2026-01-01T00:00:00Z",validUntil:"2030-01-01T00:00:00Z",provenanceStatus:"SIMULATED"};
const node={schemaVersion:"2.0",active:true,kind:"HUB",name:"Synthetic",location:{label:"Lima",countryCode:"PE",region:null,city:"Lima",lat:null,lng:null},jurisdiction:"PE",source:evidence,verifiedAt:null};
const record={id,organizationId:null,carrierId:null,requestId:null,kind:"nodes",status:"ACTIVE",version:1,
 createdAt:"2026-10-04T00:00:00Z",updatedAt:"2026-10-04T00:00:00Z",data:node};
const repository=():WorkflowRepositoryV2=>({async read(){return [record]},async command(){return {record,replay:false}}});
describe("HAC-40 persistent workflow boundary",()=>{
 it("rejects keys and injected scope before committing a command",async()=>{
  const repo=repository();repo.command=async()=>{throw new Error("UNEXPECTED_DATABASE_ACCESS")};const service=new WorkflowServiceV2(repo);
  await assert.rejects(service.command(actor,"nodes.publish",context,{...node,organizationId:org},id),{name:"ZodError"});
  await assert.rejects(service.command(actor,"nodes.publish",context,node,"bad-key"),{name:"ZodError"});
 });
 it("revision forwards actor, expected version and idempotency to one command",async()=>{
  const repo=repository();repo.command=async(received,action,scope,key,input)=>{
   assert.deepEqual(received,actor);assert.equal(action,"nodes.publish");assert.equal(scope.id,id);assert.equal(key,id);
   assert.equal("expectedVersion" in input && input.expectedVersion,1);return {record:{...record,version:2},replay:true};
  };
  const result=await new WorkflowServiceV2(repo).command(actor,"nodes.publish",{...context,id},{expectedVersion:1,value:node},id);
  assert.equal(result.data.version,2);assert.equal(result.meta.idempotentReplay,true);
 });
 it("rejects malformed stored nested output instead of passing it to consumers",async()=>{
  const repo=repository();repo.read=async()=>[{...record,data:{...node,source:{...evidence,provenanceStatus:"LIVE"}}}];
  await assert.rejects(new WorkflowServiceV2(repo).read(actor,"nodes",context,{}),{name:"ZodError"});
  assert.equal(WorkflowRecordV2Schema.safeParse({...record,kind:"arbitrary-table"}).success,false);
 });
 it("blocks a returned record outside the tenant or requested carrier",async()=>{
  const repo=repository();repo.read=async()=>[{...record,organizationId:id}];
  await assert.rejects(new WorkflowServiceV2(repo).read(actor,"nodes",context,{}),/Resource scope mismatch/);
  await assert.rejects(new WorkflowServiceV2(repository()).read(actor,"nodes",{...context,carrierId:id},{}),/Resource scope mismatch/);
 });
 it("returns absent resource without generating a default and bounds pagination",async()=>{
  const repo=repository();repo.read=async()=>[];const service=new WorkflowServiceV2(repo);
  await assert.rejects(service.read(actor,"nodes",{...context,id},{}),/Resource not found/);
  await assert.rejects(service.read(actor,"nodes",context,{limit:101}),{name:"ZodError"});
 });
 it("rejects empty allocation plans and false weighted objectives",()=>{
  assert.equal(WorkflowInputsV2["plans.create"].safeParse({schemaVersion:"2.0",routeId:id,assignments:[]}).success,false);
  assert.equal(WorkflowInputsV2["scoring-policies.publish"].safeParse({schemaVersion:"2.0",active:true,policy:{version:"1",objective:"FASTEST",weights:{cost:1,transit:0,reliability:0},missingDataRule:"EXCLUDE",tieBreaker:"OFFER_ID_ASC"}}).success,false);
 });
});
