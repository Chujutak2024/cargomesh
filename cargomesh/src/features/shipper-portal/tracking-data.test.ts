import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import type { OperationsCollection } from "@/server/services/v2-workspace/operations-collection";
import { commercialFixture, id, org, at } from "./commercial-context.test-fixtures";
import { booking, execution, location } from "@/features/carrier-portal/commercial-test-fixtures";
import { trackingQaItem } from "./tracking-qa-fixtures";
import { collectTrackingDetail, collectTrackingItem, TrackingScopeError, type TrackingSource } from "./tracking-data";
import { parseTrackingQuery, trackingSearch } from "./tracking-query";
import { trackingStatus, matchesTrackingFilter } from "./tracking-presentation";
import type { WorkflowRecordV2 } from "./shipper-model";

const complete = (data: WorkflowRecordV2[] = []): OperationsCollection<WorkflowRecordV2> => ({data,offset:0,batchSize:500,nextOffset:null,complete:true,error:null});
function fixture() {
  const context=commercialFixture(), b=booking(), ex=execution();
  b.data.carrierConfirmationStatus="CONFIRMED";
  const metadata={organizationId:org,carrierId:null,requestId:ex.requestId,version:1,createdAt:at,updatedAt:at};
  const decision=WorkflowRecordV2Schema.parse({...metadata,id:b.data.decisionId,kind:"decisions",status:"SELECTED",data:{
    planId:context.plans[0].id,selectedPlanId:context.plans[0].id,selectedOfferIds:[context.offers[0].id],consideredOfferIds:[context.offers[0].id],
    rationale:"Explicit unit-test selection",policyId:null,policyVersion:null,evidence:[],selectedAt:at,selectedBy:id(99),status:"SELECTED",
  }});
  const {facilityId:_,...point}=location;
  const route=WorkflowRecordV2Schema.parse({...metadata,id:context.plans[0].data.routeId,kind:"routes",status:"SIMULATED",data:{
    origin:point,destination:point,corridorIds:[],policyId:id(90),policyVersion:1,estimatedDistanceKm:null,estimatedDurationSeconds:null,
    geographicSource:{kind:"PUBLISHED_CORRIDORS",references:[]},planner:{algorithmVersion:"PUBLISHED_ITINERARY_VALIDATOR_V1",graphVersion:"a".repeat(64),source:{kind:"PUBLISHED_CORRIDORS",scope:"SELECTED_ITINERARY_SNAPSHOT",references:[]}},
    confidence:"UNKNOWN",estimatedTolls:null,borderCostEstimate:null,reasons:[],legs:[],
  }});
  const records:WorkflowRecordV2[]=[ex,b,decision,...context.plans,...context.offers,route],calls:string[]=[];
  const source:TrackingSource={
    record:async(kind,recordId)=>{calls.push(`${kind}:${recordId}`);return records.find(row=>row.kind===kind&&row.id===recordId);},
    request:async()=>context.request,children:async()=>complete(),
  };
  return {context,b,ex,decision,route,records,source,calls};
}
test("detail uses exact execution and booking-selected chain, not a capped tenant list",async()=>{
  const f=fixture(),detail=await collectTrackingDetail(f.ex.id,org,f.source);
  assert.equal(detail.item.execution.id,f.ex.id);assert.equal(detail.item.booking?.id,f.b.id);
  assert.equal(detail.offer?.id,f.context.offers[0].id);assert.equal(detail.route?.id,f.route.id);
  assert.equal(detail.canView3D,false);assert.deepEqual(detail.presentation.paths,[]);
  assert.deepEqual(detail.issues,[]);assert.equal(f.calls[0],`executions:${f.ex.id}`);
  assert.equal(f.calls.length,6);
});
test("PLANNED remains active but does not assert departure or location",async()=>{
  const f=fixture(),{item}=await collectTrackingItem(f.ex,org,f.source);
  assert.equal(trackingStatus(item.execution,item.booking,[],[],es=>es).label,"Por iniciar");
  assert.equal(matchesTrackingFilter(item,"active"),true);assert.equal(item.execution.data.lastKnownPosition,null);
});
test("foreign tenant, carrier, request, wrong IDs and child scope fail closed",async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.ex.organizationId=id(999);},
    (f:ReturnType<typeof fixture>)=>{f.b.carrierId=id(999);},
    (f:ReturnType<typeof fixture>)=>{f.route.requestId=id(999);},
    (f:ReturnType<typeof fixture>)=>{f.context.request.organizationId=id(999);},
    (f:ReturnType<typeof fixture>)=>{f.decision.id=id(999);f.source.record=async()=>f.decision;},
    (f:ReturnType<typeof fixture>)=>{f.source.children=async()=>complete(trackingQaItem("transit").events);},
  ]){
    const f=fixture();mutate(f);await assert.rejects(collectTrackingDetail(f.ex.id,org,f.source),TrackingScopeError);
  }
});
test("selected offer and service/assignment mismatches cannot authorize route/3D",async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{if(f.decision.kind==="decisions")f.decision.data.selectedOfferIds=[id(999)];},
    (f:ReturnType<typeof fixture>)=>{f.context.offers[0].data.planCandidateId=id(999);},
    (f:ReturnType<typeof fixture>)=>{f.context.offers[0].data.coveredServiceIds=[id(999)];},
    (f:ReturnType<typeof fixture>)=>{f.context.offers[0].data.coveredAssignmentIds=[id(999)];},
    (f:ReturnType<typeof fixture>)=>{f.context.plans[0].data.legAssignments[0].carrierId=id(999);},
  ]){
    const f=fixture();mutate(f);await assert.rejects(collectTrackingDetail(f.ex.id,org,f.source),TrackingScopeError);
  }
});
test("legacy booking without exact offer disables route, not the whole execution",async()=>{
  const f=fixture();delete f.b.data.offerId;
  const detail=await collectTrackingDetail(f.ex.id,org,f.source);
  assert.equal(detail.route,null);assert.equal(detail.offer,null);assert.equal(detail.canView3D,false);
  assert.deepEqual(detail.issues,[{resource:"booking-offer",reason:"partial"}]);
});
test("failed/partial child collections stay incomplete, never become a verified zero",async()=>{
  const f=fixture();f.source.children=async kind=>({...complete(),complete:false,nextOffset:100,error:kind==="incidents"?{code:"OPERATIONS_READ_UNAVAILABLE"}:null});
  const detail=await collectTrackingDetail(f.ex.id,org,f.source);
  assert.equal(detail.item.eventsComplete,false);assert.equal(detail.item.incidentsComplete,false);
  assert.deepEqual(detail.issues,[{resource:"execution-events",reason:"partial"},{resource:"incidents",reason:"unavailable"}]);
});
test("authentication, contract and exact-read backend failures propagate without fallback",async()=>{
  for(const message of ["401 UNAUTHORIZED","403 FORBIDDEN","404 NOT_FOUND","NETWORK"]){
    const f=fixture();f.source.record=async()=>{throw new Error(message);};
    await assert.rejects(collectTrackingDetail(f.ex.id,org,f.source),new RegExp(message));
  }
  const f=fixture();f.source.record=async()=>({});await assert.rejects(collectTrackingDetail(f.ex.id,org,f.source),{name:"ZodError"});
});
test("tracking query round-trips local filters/page and discards arbitrary navigation",()=>{
  const query=parseTrackingQuery(new URLSearchParams("q=L%C3%ADma&filter=attention&sort=oldest&offset=25&returnTo=https://foreign.invalid"));
  assert.deepEqual(parseTrackingQuery(new URLSearchParams(trackingSearch(query))),query);
  assert.equal(trackingSearch(query).includes("returnTo"),false);
  for(const offset of ["NaN","-1","100001","0.5"])assert.equal(parseTrackingQuery(new URLSearchParams({offset})).offset,0);
  assert.equal(parseTrackingQuery(new URLSearchParams({q:"x".repeat(300),filter:"REJECTED"})).q.length,200);
});
