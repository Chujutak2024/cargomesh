import {randomUUID} from 'node:crypto';
export async function extend(c:any){
 const {call,refs,fixture,records,roundtrips,modules,output,CARRIER,SERVICE,clone,evidence}=c;
 const schemas=modules['workflow.ts'].WorkflowInputsV2;
 function clean(value:any,s:any):any{while(s?._def&&['ZodEffects','ZodOptional','ZodNullable','ZodDefault'].includes(s._def.typeName))s=s._def.schema??s._def.innerType;if(value===null)return null;if(s?._def.typeName==='ZodObject')return Object.fromEntries(Object.entries(s.shape).filter(([k])=>k in value).map(([k,t])=>[k,clean(value[k],t)]));if(s?._def.typeName==='ZodArray')return value.map((v:any)=>clean(v,s._def.type));return value;}
 const created:any={};
 async function create(name:string,path:string,body:any){const key=randomUUID();const expected=name==='offers'?200:201;const r=await call('extended-'+name+'-create',path,body,key,1,expected);if(r.http!==expected)return null;const record=r.response.data;created[name]=record;output('extended-records.json',created);const readpath=name==='offers'?'/carriers/'+CARRIER+'/offers':path;const rd=await call('extended-'+name+'-read',readpath+'/'+record.id,undefined,undefined,1,200);await call('extended-'+name+'-list',readpath,undefined,undefined,1,200);roundtrips.push({kind:name,id:record.id,input:body,written:record,read:rd.response.data,status:JSON.stringify(record)===JSON.stringify(rd.response.data)?'PASS':'FAIL'});await call('extended-'+name+'-replay',path,body,key,1,200);await call('extended-'+name+'-foreign',readpath+'/'+record.id,undefined,undefined,2,[404,403,200]);return record;}
 const win=refs.plan.data.proposedWindow;
 const freshAsset=await create('assets','/carriers/'+CARRIER+'/assets',{...clean(refs.asset.value,modules['catalog.ts'].CatalogInputsV2.assets),code:'HAC44_HTTP_'+Date.now(),roadVehicle:{...refs.asset.value.roadVehicle,plate:'HAC44-'+Date.now()}});
 if(!freshAsset)return;refs.asset=freshAsset;
 await create('asset-capabilities','/carriers/'+CARRIER+'/asset-capabilities',{...refs.capability.value,assetId:freshAsset.id});
 const freshCalendar=await create('calendars','/carriers/'+CARRIER+'/calendars',{...clean(refs.calendar.value,modules['catalog.ts'].CatalogInputsV2.calendars),assetId:freshAsset.id});
 if(!freshCalendar)return;refs.calendar=freshCalendar;
 const assetState=await call('asset-availability-control','/carriers/'+CARRIER+'/assets/'+refs.asset.id,undefined,undefined,1,200);
 if(assetState.http===200&&assetState.response.data.value.operatingStatus!=='AVAILABLE')await call('asset-availability-restore','/carriers/'+CARRIER+'/assets/'+refs.asset.id+'/events',{schemaVersion:'2.0',expectedVersion:assetState.response.data.version,note:'HAC44 isolated fixture restore',evidence,next:'AVAILABLE',reason:'Independent positive workflow control'},undefined,1,201);
 const f={schemaVersion:'2.0',code:'HAC44_HTTP_FACILITY_'+Date.now(),name:'HAC44 synthetic facility',facilityType:'WAREHOUSE',location:refs.origin.data.location,active:true,accessRestrictions:[{code:'QA',description:'Synthetic requirement',evidenceReference:'fixture:qa'}],operatingHours:{timezone:'America/Lima',weekly:[{dayOfWeek:1,opensAt:'08:00',closesAt:'18:00'}]}};
 const facility=await create('facilities','/facilities',f);if(facility){await call('facility-revision','/facilities/'+facility.id+'/revisions',{expectedVersion:1,value:{...f,name:f.name+' revised'}},undefined,1,200);await call('facility-stale','/facilities/'+facility.id+'/revisions',{expectedVersion:1,value:f},undefined,1,409);}
 const req=clone(fixture.requestBody);req.pickupWindow=refs.request.snapshot.pickupWindow;req.deliveryWindow=refs.request.snapshot.deliveryWindow;req.cargoSpecification=clone(refs.request.snapshot.cargoSpecification);req.requiredEquipment=null;const request=await create('request','/freight/requests',req);if(!request){output('extended-records.json',created);return;}
 await call('extended-submit','/freight/requests/'+request.id+'/submissions',{expectedDraftVersion:1},undefined,1,200);
 const q='/freight/requests/'+request.id;const carrier='/carriers/'+CARRIER;
 const corridor=await create('corridors','/routing/corridors',{...clean(refs.corridor.data,schemas['corridors.publish']),waypoints:[{kind:'FUEL',location:refs.origin.data.location,source:evidence,verifiedAt:'2020-01-01T00:00:00Z'}]});if(!corridor)return;
 const policy=await create('route-policies','/routing/policies',{...refs.policy.data,version:'HAC44_HTTP_POLICY_'+Date.now()});if(!policy)return;
 const limits=await create('limits',carrier+'/route-limits',{...refs.limits.data,corridorId:corridor.id,assetId:refs.asset.id});
 const route=await create('routes',q+'/routes',{schemaVersion:'2.0',corridorIds:[corridor.id],policyId:policy.id});if(!route)return;
 const plan=await create('plans',q+'/plans',{schemaVersion:'2.0',routeId:route.id,assignments:[{legSequence:1,serviceId:SERVICE,laneId:'d4480000-0000-4000-8000-000000000001',calendarId:refs.calendar.id,assetId:refs.asset.id,capacityPoolId:null,combinationId:null,role:'LOAD_BEARING',window:win,allocations:[{unitIndex:0,quantity:1}]}]});if(!plan)return;
 const assignment=plan.data.assignments[0].id;
 const opportunity=await create('opportunities',q+'/opportunities',{schemaVersion:'2.0',planId:plan.id,carrierId:CARRIER,assignmentIds:[assignment],responseDeadline:new Date(Date.now()+7200000).toISOString(),responseChannel:'MANUAL'});if(!opportunity)return;
 await call('opportunity-respond',carrier+'/opportunities/'+opportunity.id+'/responses',{schemaVersion:'2.0',expectedVersion:1,note:'HAC44 acceptance',evidence,response:'ACCEPTED'},undefined,1,200);
 const offerInput=clean(refs.offer.data,schemas['offers.create']);Object.assign(offerInput,{schemaVersion:'2.0',planCandidateId:plan.id,coveredAssignmentIds:[assignment],supersedesOfferId:null,carrierReference:'HAC44-HTTP'});
 const offer=await create('offers',carrier+'/opportunities/'+opportunity.id+'/offers',offerInput);if(!offer)return;
 const metrics=await create('metrics',carrier+'/metrics',{schemaVersion:'2.0',period:{startsAt:'2020-01-01T00:00:00Z',endsAt:'2026-01-01T00:00:00Z'},corridorId:corridor.id,mode:'ROAD',sampleSize:50,onTimeRate:0.9,successfulDeliveryRate:0.98,source:evidence});
 const score=await create('scoring-policies','/scoring/policies',{...refs.scorepolicy.data,policy:{...refs.scorepolicy.data.policy,version:'HAC44_HTTP_SCORE_'+Date.now()}});if(!score)return;
 const ranking=await create('ranking',q+'/ranking',{schemaVersion:'2.0',policyId:score.id});
 const decision=await create('decisions',q+'/decisions',{schemaVersion:'2.0',planId:plan.id,selectedOfferIds:[offer.id],rationale:'HAC44 synthetic authorization',policyId:score.id,consideredOfferIds:[offer.id],evidence:[evidence]});if(!decision)return;
 const booking=await create('bookings','/bookings',{schemaVersion:'2.0',decisionId:decision.id,offerId:offer.id,authorization:'AUTHORIZE',evidence});if(!booking)return;
 const execution=await create('executions','/executions',{schemaVersion:'2.0',bookingId:booking.id,serviceId:SERVICE});if(!execution)return;
 const hold=await create('holds','/capacity/holds',{schemaVersion:'2.0',bookingId:booking.id,assignmentId:assignment,expiresAt:new Date(Date.now()+3600000).toISOString(),consolidationId:null,evidence});if(!hold)return;
 const audit=(version=1)=>({schemaVersion:'2.0',expectedVersion:version,note:'HAC44 transition',evidence});
 await call('extended-confirm-hold',carrier+'/capacity/holds/'+hold.id+'/confirmations',audit(),undefined,1,200);
 await call('extended-confirm-booking',carrier+'/bookings/'+booking.id+'/confirmations',{...audit(),carrierReference:'HAC44-BOOK',confirmation:'CONFIRMED'},undefined,1,200);
 const driverValue=clone(fixture.drivers);driverValue.availableWindows=[win];driverValue.dutyWindow=win;driverValue.maximumDutySeconds=86400;driverValue.fullName='HAC44 HTTP driver';
 const driver=await create('drivers',carrier+'/drivers',driverValue);
 if(driver){const da={...clone(fixture['driver-assignments']),driverId:driver.id,executionId:execution.id,window:win,status:'CONFIRMED'};await create('driver-assignments',carrier+'/driver-assignments',da);}
 const va={...clone(fixture['vehicle-assignments']),executionId:execution.id,assetId:refs.asset.id,combinationId:null,reservationId:hold.id,capacityCommitted:hold.data.capacityCommitted,window:win,status:'CONFIRMED'};await create('vehicle-assignments',carrier+'/vehicle-assignments',va);
 await call('execution-invalid-position',carrier+'/executions/'+execution.id+'/positions',{...audit(),location:refs.origin.data.location,observedAt:new Date().toISOString(),correlationId:'HAC44-before-start'},undefined,1,409);
 const start=await call('execution-start',carrier+'/executions/'+execution.id+'/starts',audit(),undefined,1,200);
 if(start.http===200){await call('execution-position',carrier+'/executions/'+execution.id+'/positions',{...audit(2),location:refs.origin.data.location,observedAt:new Date().toISOString(),correlationId:'HAC44-started'},undefined,1,200);}
 const incident=await create('incidents',carrier+'/executions/'+execution.id+'/incidents',{schemaVersion:'2.0',kind:'QA_DELAY',severity:'WARNING',occurredAt:new Date().toISOString(),location:refs.origin.data.location,description:'Synthetic HAC44 incident',evidence:[evidence]});
 if(incident){await call('incident-update',carrier+'/incidents/'+incident.id+'/updates',{...audit(),action:'RESOLVE'},undefined,1,200);await call('incident-updates-read',carrier+'/incidents/'+incident.id+'/updates',undefined,undefined,1,200);}
 if(start.http===200)await call('execution-complete',carrier+'/executions/'+execution.id+'/completions',audit(3),undefined,1,200);
 await create('conditions','/routing/conditions',{schemaVersion:'2.0',active:true,corridorId:corridor.id,kind:'DELAY',location:refs.origin.data.location,observedAt:'2020-01-01T00:00:00Z',validUntil:'2021-01-01T00:00:00Z',source:evidence,confidence:'SIMULATED'});
 await call('extended-cancel-booking','/bookings/'+booking.id+'/cancellations',audit(2),undefined,1,[200,409]);
 await call('extended-revoke-decision',q+'/decisions/'+decision.id+'/revocations',audit(),undefined,1,[200,409]);
 await call('extended-withdraw-offer',carrier+'/offers/'+offer.id+'/withdrawals',audit(),undefined,1,[200,409]);
 await call('asset-event',carrier+'/assets/'+refs.asset.id+'/events',{...audit(),next:'MAINTENANCE',reason:'Synthetic QA transition'},undefined,1,[201,409]);
 await call('missing-control-positive','/organizations/current',undefined,undefined,1,200);
 for(const path of ['/carriers/'+CARRIER+'/integrations','/carriers/'+CARRIER+'/operators','/organizations/current/members','/mcp/account-links'])await call('missing-proposal-probe',path,undefined,undefined,1,404);
 const cats=await call('new-category-positive','/cargo-categories',undefined,undefined,1,200);
 const createdCategory=cats.response.data?.find((r:any)=>r.value.code.startsWith('HAC44_API'));
 if(createdCategory){await call('new-category-request-negative','/freight/requests',{...req,cargoSpecification:{...req.cargoSpecification,categoryCode:'HAC44_UNREGISTERED'}},undefined,1,400);await call('new-category-request-positive','/freight/requests',{...req,cargoSpecification:{...req.cargoSpecification,categoryCode:createdCategory.value.code}},undefined,1,201);}
 output('extended-records.json',created);records.extended=created;
}
