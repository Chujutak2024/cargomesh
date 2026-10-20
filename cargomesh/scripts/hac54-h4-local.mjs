// Twelve explicit dated synthetic cases. Native authenticated commands only; no hosted rollout or guard bypass.
import assert from 'node:assert/strict';
import {localHarness,localRecipe} from './hac54-local-harness.mjs';
import {CreateFreightRequestV2InputSchema} from '../src/shared/schemas/v2/freight-request.ts';
import {WorkflowInputsV2} from '../src/shared/schemas/v2/workflow.ts';
import {requestToRevisionInput} from '../src/features/shipper-portal/shipper-model.ts';
import {collectTrackingDetail} from '../src/features/shipper-portal/tracking-data.ts';
import {collectOperationsPages} from '../src/server/services/v2-workspace/operations-collection.ts';
import {opportunityTargets} from '../src/features/shipper-portal/commercial-context.ts';
import {buildTrackingJourney} from '../src/features/shipper-portal/tracking-journey.ts';
import {trackingStatus,matchesTrackingFilter} from '../src/features/shipper-portal/tracking-presentation.ts';
const h=await localHarness('HAC54-H4-2026-10-20',{setupAdmin:true}),recipe=localRecipe('v2-hac54-commercial'),baseRecipe=localRecipe('v2-hac54-h2');
assert.equal(process.env.HAC54_LOCAL_AUTHORIZE_SYNTHETIC_BOOKING,'1','Explicit synthetic local test consent required.');
assert.ok(Date.now()>Date.parse(recipe.clock)&&Date.now()<Date.parse(recipe.expiresAt),'This dated recipe expired; do not silently move historical dates.');
const clone=value=>structuredClone(value),base=await h.get('/freight/requests/'+baseRecipe.refs.baseRequest),root='/carriers/'+baseRecipe.refs.carrier;
const evidence={reference:'fixture:'+recipe.package,provider:'[SYNTHETIC] HAC54 H4 local test',observedAt:recipe.clock,validUntil:recipe.validUntil,provenanceStatus:'SIMULATED'};
const crewEvidence={reference:evidence.reference,verifiedAt:recipe.clock,validUntil:recipe.validUntil,provenanceStatus:'SIMULATED'};
const baseService=await h.get(root+'/services/'+baseRecipe.refs.service),baseLane=await h.get(root+'/services/'+baseRecipe.refs.service+'/lanes/'+baseRecipe.refs.lane);
const policy=await h.save('policy','/scoring/policies',{...baseRecipe.scoringPolicy,policy:{...baseRecipe.scoringPolicy.policy,version:recipe.package}});
const registry=[],resources=new Map();
async function createResource(code,{temperature=null,unknown=false}={}){
 let serviceId=baseRecipe.refs.service,laneId=baseRecipe.refs.lane,pickupAreaId=baseRecipe.calendar.readyPickupAreaId;
 if(temperature){
  const service=await h.save(code+':service',root+'/services',{...baseService.value,temperatureRange:{minCelsius:0,maxCelsius:20},admittedCargoTypes:[baseRecipe.definition.categoryId]});serviceId=service.id;
  const area=(role,city)=>({schemaVersion:'2.0',role,inclusion:'INCLUDE',geography:{granularity:'CITY',countryCode:'PE',region:null,city,postalCode:null},source:'OWN',partnerId:null,evidence:evidence.reference,verifiedAt:recipe.clock,validFrom:recipe.clock,validUntil:recipe.validUntil,active:true});
  const pickup=await h.save(code+':pickup',`${root}/services/${serviceId}/areas`,area('PICKUP','Lima'));
  const delivery=await h.save(code+':delivery',`${root}/services/${serviceId}/areas`,area('DELIVERY','Arequipa'));pickupAreaId=pickup.id;
  const lane=await h.save(code+':lane',`${root}/services/${serviceId}/lanes`,{...baseLane.value,pickupAreaId:pickup.id,deliveryAreaId:delivery.id,verifiedAt:recipe.clock,validFrom:recipe.clock,validUntil:recipe.validUntil,evidence:evidence.reference});laneId=lane.id;
 }
 const assetValue={...clone(baseRecipe.asset),serviceId,code:'H54_'+code,registeredAt:undefined,evidence:evidence.reference,equipmentType:temperature?'REEFER_TRUCK':'BOX_TRUCK'};delete assetValue.registeredAt;
 assetValue.roadVehicle={...assetValue.roadVehicle,plate:'H54-'+code,registrationCode:'H54-'+code,model:'Synthetic H4 '+code};
 const asset=await h.save(code+':asset',root+'/assets',assetValue);
 const definition=await h.save(code+':definition',root+'/capability-definitions',{...baseRecipe.definition,serviceId,requirements:temperature?['TEMP_CONTROLLED']:[],temperatureRange:temperature,evidence:evidence.reference,verifiedAt:recipe.clock,validUntil:recipe.validUntil});
 const {requirements:_requirements,maxWeightKg:_weight,...capability}=definition.value;
 await h.save(code+':capability',root+'/asset-capabilities',{...capability,assetId:asset.id,definitionId:definition.id});
 const calendar=await h.save(code+':calendar',root+'/calendars',{...baseRecipe.calendar,serviceId,assetId:asset.id,source:evidence.reference,lastVerifiedAt:unknown?null:recipe.clock,
  horizon:{startsAt:recipe.clock,endsAt:recipe.validUntil},availableWindows:[{startsAt:recipe.clock,endsAt:recipe.validUntil}],freshness:unknown?'UNKNOWN':'SIMULATED',complete:!unknown,validUntil:unknown?null:recipe.validUntil,readyPickupAreaId:pickupAreaId});
 await h.save(code+':limits',root+'/route-limits',{...baseRecipe.limits,serviceId,assetId:asset.id,source:evidence},'setup');
 return {asset,calendar,serviceId,laneId};
}
async function planFor(code,request,route,resource){
 return h.save(code+':plan',`/freight/requests/${request.id}/plans`,WorkflowInputsV2['plans.create'].parse({schemaVersion:'2.0',routeId:route.id,assignments:[{
  legSequence:1,serviceId:resource.serviceId,laneId:resource.laneId,window:recipe.planWindow,resources:[{calendarId:resource.calendar.id,assetId:resource.asset.id,capacityPoolId:null,combinationId:null,role:'LOAD_BEARING',allocations:[{unitIndex:0,quantity:1}]}]}]}));
}
async function quoteFor(code,request,plan,amount){
 const prefix=`/freight/requests/${request.id}`;
 const opportunity=await h.save(code+':opportunity',prefix+'/opportunities',{schemaVersion:'2.0',planId:plan.id,carrierId:baseRecipe.refs.carrier,assignmentIds:plan.data.legAssignments.map(row=>row.id),responseDeadline:recipe.expiresAt,responseChannel:'MANUAL'});
 await h.save(code+':accept',`${root}/opportunities/${opportunity.id}/responses`,{schemaVersion:'2.0',expectedVersion:1,response:'ACCEPTED',note:'Synthetic local operator review, not an external commercial commitment.',evidence},'carrier');
 const value={...clone(baseRecipe.quote),carrierReference:'H54-'+code,planCandidateId:plan.id,coveredServiceIds:[plan.data.legAssignments[0].serviceId],coveredAssignmentIds:plan.data.legAssignments.map(row=>row.id),
  validity:{startsAt:recipe.clock,endsAt:recipe.expiresAt},issuedAt:recipe.clock,estimatedPickupAt:recipe.pickupWindow.startsAt,estimatedDeliveryAt:recipe.deliveryWindow.startsAt,
  source:{channel:'MANUAL',evidence},evidence:[evidence],price:{amount,currency:'USD'},supersedesOfferId:null};
 value.breakdown[0]={...value.breakdown[0],amount:{amount,currency:'USD'},source:evidence,observedAt:recipe.clock};
 const offer=await h.save(code+':offer',`${root}/opportunities/${opportunity.id}/offers`,WorkflowInputsV2['offers.create'].parse(value),'carrier');
 return {opportunity,offer};
}
for(const scenario of recipe.cases){
 const code=scenario.code,input=requestToRevisionInput(clone(base));input.pickupWindow=recipe.pickupWindow;input.deliveryWindow=recipe.deliveryWindow;input.cargoSpecification.description=`[SYNTHETIC ${recipe.package}] ${code}`;
 if(scenario.temperature){input.requiredEquipment='REEFER_TRUCK';input.preferredEquipment='REEFER_TRUCK';input.cargoSpecification.requirements=['TEMP_CONTROLLED'];input.cargoSpecification.temperatureRange={minCelsius:2,maxCelsius:6};}
 if(scenario.outcome==='NO_COVERAGE')input.destination={facilityId:null,label:'[SYNTHETIC] No published lane',countryCode:'PE',region:null,city:'Piura',lat:-5.1945,lng:-80.6328};
 const request=await h.save(code+':request','/freight/requests',CreateFreightRequestV2InputSchema.parse(input));
 await h.save(code+':submit',`/freight/requests/${request.id}/submissions`,{expectedDraftVersion:1});
 const record={code,outcome:scenario.outcome,requestId:request.id,reference:request.referenceCode};registry.push(record);
 if(scenario.outcome==='NO_COVERAGE'){
  const serviceability=await h.get(`/freight/requests/${request.id}/serviceability`);assert.equal(serviceability.overallStatus,'ineligible');
  record.serviceability=serviceability.overallStatus;console.log(JSON.stringify(record));continue;
 }
 const resource=scenario.outcome==='BUSY'?resources.get('01_PLANNED'):await createResource(code,{temperature:scenario.temperature,unknown:scenario.outcome==='UNKNOWN'});assert.ok(resource);resources.set(code,resource);
 const route=await h.save(code+':route',`/freight/requests/${request.id}/routes`,{schemaVersion:'2.0',corridorIds:[baseRecipe.refs.corridor],policyId:baseRecipe.refs.routePolicy});
 const plan=await planFor(code,request,route,resource);record.planId=plan.id;record.eligibility=plan.data.eligibility;
 if(['BUSY','UNKNOWN','COLD_BAD'].includes(scenario.outcome)){
  assert.notEqual(plan.data.eligibility,'eligible',`${code} must never become a commercial success`);record.reasons=plan.data.exclusionReasons;record.pendingRequirements=plan.data.pendingRequirements;
  if(scenario.outcome==='UNKNOWN')assert.equal(plan.data.eligibility,'unknown');
  if(scenario.outcome==='BUSY'){assert.ok(plan.data.exclusionReasons.includes('RESOURCE_OCCUPIED'));assert.deepEqual(plan.data.pendingRequirements,[]);}
  if(scenario.outcome==='COLD_BAD')assert.ok(plan.data.pendingRequirements.includes('TEMPERATURE_CAPABILITY_UNKNOWN'));
  // Native review invitations can exist for non-eligible plans. They are not an eligible alternative or a booking.
  const currentRequest=await h.get(`/freight/requests/${request.id}`);
  const targets=opportunityTargets({request:currentRequest,plans:[plan],opportunities:[],offers:[],ranking:null});
  assert.ok(targets.length&&targets.every(target=>!target.current));
  const denied=await h.call(`/freight/requests/${request.id}/decisions`,'client',{schemaVersion:'2.0',planId:plan.id,
   selectedOfferIds:[registry[0].offerId],consideredOfferIds:[registry[0].offerId],policyId:policy.id,rationale:'Explicit negative local test; must not select a non-eligible plan.',evidence:[evidence]},code+':blocked-selection');
  assert.equal(denied.status,409);assert.equal(denied.body.error.code,'PLAN_NOT_ELIGIBLE');
  record.selectionError=denied.body.error.code;
  for(const child of ['offers','bookings'])assert.deepEqual(await h.get(`/freight/requests/${request.id}/${child}`),[]);
  console.log(JSON.stringify(record));continue;
 }
 assert.equal(plan.data.eligibility,'eligible',`${code}: ${JSON.stringify(plan.data)}`);
 let quote=await quoteFor(code,request,plan,350),chosenPlan=plan,chosenResource=resource;
 const considered=[quote.offer.id];
 if(scenario.outcome==='COMPARE'){
  const alternativeResource=await createResource(code+'_B'),alternativePlan=await planFor(code+'_B',request,route,alternativeResource);assert.equal(alternativePlan.data.eligibility,'eligible');
  const other=await quoteFor(code+'_B',request,alternativePlan,325);considered.push(other.offer.id);quote=other;chosenPlan=alternativePlan;chosenResource=alternativeResource;
 }
 const ranking=await h.save(code+':ranking',`/freight/requests/${request.id}/ranking`,{schemaVersion:'2.0',policyId:policy.id});
 assert.equal(ranking.data.options.length,scenario.outcome==='COMPARE'?2:1);
 const decision=await h.save(code+':decision',`/freight/requests/${request.id}/decisions`,{schemaVersion:'2.0',planId:chosenPlan.id,selectedOfferIds:[quote.offer.id],consideredOfferIds:considered,policyId:policy.id,rationale:'Explicit synthetic Client selection for '+code,evidence:[evidence]});
 const booking=await h.save(code+':booking','/bookings',{schemaVersion:'2.0',decisionId:decision.id,offerId:quote.offer.id,authorization:'AUTHORIZE',evidence});
 Object.assign(record,{offerId:quote.offer.id,opportunityId:quote.opportunity.id,decisionId:decision.id,bookingId:booking.id,offerIds:considered,selectedPlanId:chosenPlan.id});
 if(scenario.outcome==='REJECTED'){
  await h.save(code+':reject',`${root}/bookings/${booking.id}/confirmations`,{schemaVersion:'2.0',expectedVersion:1,note:'Synthetic local rejection: Carrier declines commitment.',evidence,carrierReference:'H54-'+code,confirmation:'REJECTED'},'carrier');
  record.bookingStatus=(await h.get('/bookings/'+booking.id)).data.carrierConfirmationStatus;assert.equal(record.bookingStatus,'REJECTED');console.log(JSON.stringify(record));continue;
 }
 const execution=await h.save(code+':execution','/executions',{schemaVersion:'2.0',bookingId:booking.id,serviceId:chosenResource.serviceId});record.executionId=execution.id;
 const assignment=chosenPlan.data.legAssignments[0];
 const hold=await h.save(code+':hold','/capacity/holds',{schemaVersion:'2.0',bookingId:booking.id,assignmentId:assignment.id,planResourceId:assignment.resources[0].resourceId,expiresAt:recipe.expiresAt,consolidationId:null,evidence});record.holdId=hold.id;
 await h.save(code+':hold-confirm',`${root}/capacity/holds/${hold.id}/confirmations`,{schemaVersion:'2.0',expectedVersion:1,note:'Synthetic native capacity confirmation',evidence},'carrier');
 await h.save(code+':confirm',`${root}/bookings/${booking.id}/confirmations`,{schemaVersion:'2.0',expectedVersion:1,note:'Synthetic native booking confirmation',evidence,carrierReference:'H54-'+code,confirmation:'CONFIRMED'},'carrier');
 if(scenario.outcome==='CANCELLED')await h.save(code+':cancel',`${root}/executions/${execution.id}/cancellations`,{schemaVersion:'2.0',expectedVersion:1,note:'Explicit synthetic Carrier cancellation; no replacement booking.',evidence},'carrier');
 if(['IN_PROGRESS','COMPLETED','INCIDENT'].includes(scenario.outcome)){
  const driver=await h.save(code+':driver',root+'/drivers',{...recipe.driver,serviceId:chosenResource.serviceId,fullName:recipe.driver.fullName+' '+code,evidence:crewEvidence,availableWindows:[{startsAt:recipe.clock,endsAt:recipe.validUntil}],dutyWindow:recipe.planWindow});
  await h.save(code+':driver-assignment',root+'/driver-assignments',{schemaVersion:'2.0',serviceId:chosenResource.serviceId,executionId:execution.id,window:recipe.planWindow,status:'CONFIRMED',evidence:crewEvidence,driverId:driver.id,role:'PRIMARY',acceptedLicenseClasses:['H54_QA'],requiredQualifications:[],policyEvidence:crewEvidence});
  await h.save(code+':vehicle-assignment',root+'/vehicle-assignments',{schemaVersion:'2.0',serviceId:chosenResource.serviceId,executionId:execution.id,window:recipe.planWindow,status:'CONFIRMED',evidence:crewEvidence,assetId:chosenResource.asset.id,combinationId:null,reservationId:hold.id,capacityCommitted:{weightKg:1000,volumeM3:2}});
  const started=await h.save(code+':start',`${root}/executions/${execution.id}/starts`,{schemaVersion:'2.0',expectedVersion:1,note:'Synthetic local departure event, not a physical vehicle.',evidence},'carrier');
  const position=await h.save(code+':position',`${root}/executions/${execution.id}/positions`,{schemaVersion:'2.0',expectedVersion:2,note:'Synthetic discrete position; not live GPS.',evidence,
   location:{label:'[SYNTHETIC] Ica checkpoint',countryCode:'PE',region:null,city:'Ica',lat:-14.0678,lng:-75.7286},observedAt:started.data.actualStartedAt,correlationId:recipe.package+':'+code},'carrier');
  if(scenario.outcome==='COMPLETED')await h.save(code+':complete',`${root}/executions/${execution.id}/completions`,{schemaVersion:'2.0',expectedVersion:position.version,note:'Synthetic local delivery confirmation, not a real shipment.',evidence},'carrier');
  if(scenario.outcome==='INCIDENT'){
   const incident=await h.save(code+':incident',`${root}/executions/${execution.id}/incidents`,{schemaVersion:'2.0',kind:'SYNTHETIC_INSPECTION',severity:'CRITICAL',occurredAt:started.data.actualStartedAt,
    location:{label:'[SYNTHETIC] Ica checkpoint',countryCode:'PE',region:null,city:'Ica',lat:-14.0678,lng:-75.7286},description:'[SYNTHETIC] Local inspection needs operator review. No revised ETA provided.',evidence:[evidence]},'carrier');record.incidentId=incident.id;
  }
 }
 const final=await h.get('/executions/'+execution.id);record.executionStatus=final.status;record.bookingStatus=(await h.get('/bookings/'+booking.id)).data.carrierConfirmationStatus;
 const expected={PLANNED:'PLANNED',IN_PROGRESS:'IN_PROGRESS',COMPLETED:'COMPLETED',INCIDENT:'IN_PROGRESS',CANCELLED:'CANCELLED',COMPARE:'PLANNED',COLD_OK:'PLANNED'}[scenario.outcome];assert.equal(final.status,expected);
 assert.deepEqual((await h.get(`${root}/executions/${execution.id}`,'carrier')),final);console.log(JSON.stringify(record));
}
const source={
 record:(kind,id)=>h.get(`/${kind}/${id}`),request:id=>h.get(`/freight/requests/${id}`),
 children:(kind,id)=>collectOperationsPages(async({limit,offset})=>{
  const r=await h.call(`/executions/${id}/${kind==='execution-events'?'events':'incidents'}?limit=${limit}&offset=${offset}`);
  assert.equal(r.status,200);return r.body;
 },row=>assert.equal(row.kind,kind)),
};
for(const record of registry.filter(row=>row.executionId)){
 const detail=await collectTrackingDetail(record.executionId,base.organizationId,source),{item}=detail;
 assert.equal(detail.request.id,record.requestId);assert.equal(item.booking.id,record.bookingId);assert.equal(detail.offer.id,record.offerId);
 assert.ok(item.eventsComplete&&item.incidentsComplete);assert.deepEqual(detail.issues,[]);
 const journey=buildTrackingJourney(item.execution,item.booking,item.events,item.incidents);
 if(record.outcome==='CANCELLED'){assert.ok(journey.cancelled);assert.equal(detail.route,null);assert.equal(detail.canView3D,false);}
 else {assert.ok(detail.presentation.paths.length>0);assert.equal(detail.canView3D,true);assert.equal(detail.route.data.confidence,'SIMULATED');}
 if(record.outcome==='PLANNED'){assert.equal(trackingStatus(item.execution,item.booking,item.events,item.incidents,(es)=>es).label,'Por iniciar');assert.ok(matchesTrackingFilter(item,'active'));assert.equal(journey.lastKnownPosition,null);}
 if(record.outcome==='IN_PROGRESS'){assert.equal(journey.lastReportedStage,'transit');assert.ok(journey.lastKnownPosition);}
 if(record.outcome==='COMPLETED')assert.ok(journey.completed);
 if(record.outcome==='INCIDENT'){assert.ok(journey.criticalOpen);assert.ok(matchesTrackingFilter(item,'attention'));}
 for(const path of [`/executions/${record.executionId}`,`/executions/${record.executionId}/events`,`/executions/${record.executionId}/incidents`]){
  assert.equal((await h.call(path,'foreign')).status,404);assert.equal((await h.call(path,'anonymous')).status,401);
 }
 record.trackingVerified=true;
}
const transit=registry.find(row=>row.outcome==='IN_PROGRESS'),ended=registry.find(row=>row.outcome==='COMPLETED');
for(const [record,action,key] of [[transit,'positions','stale-position'],[ended,'starts','cannot-restart-delivered']]){
 const body=action==='positions'?{schemaVersion:'2.0',expectedVersion:1,note:'Synthetic stale update; must fail.',evidence,
  location:{label:'[SYNTHETIC] Invalid stale report',countryCode:'PE',region:null,city:'Ica',lat:-14.0678,lng:-75.7286},observedAt:recipe.clock,correlationId:'negative-version'}
  :{schemaVersion:'2.0',expectedVersion:4,note:'Synthetic invalid restart; must fail.',evidence};
 const rejected=await h.call(`${root}/executions/${record.executionId}/${action}`,'carrier',body,key);assert.equal(rejected.status,409);
}
assert.equal((await h.get('/executions/'+ended.executionId)).status,'COMPLETED');
console.log('HAC54_RESULT='+JSON.stringify({localOnly:true,package:recipe.package,clock:recipe.clock,expiresAt:recipe.expiresAt,cases:registry}));
