import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCarrierBriefing} from './carrier-briefing';
import {opportunity,offer,carrier,org,request,period,id,ev} from '@/features/carrier-portal/commercial-test-fixtures';

function input(){const row=opportunity();return {carrierId:carrier,opportunityId:row.id,role:'ADMIN',now:Date.parse('2026-10-16T00:00:00Z'),offersComplete:true,policiesAvailable:false,policies:[],offers:[offer()],opportunity:{...row,data:{...row.data,cargoSpecification:{categoryCode:'GENERAL',description:'Industrial parts',totalWeightKg:12000,totalVolumeM3:15.552,divisible:true,units:[{packageType:'CRATE',quantity:2,weightPerUnitKg:6000,volumePerUnitM3:7.776,indivisible:true}]},requestBrief:{requestId:request,customerRef:org,requestVersion:2,currentRequestVersion:2,isCurrent:true,canReview:true,pickupWindow:period,deliveryWindow:period,planEligibility:'eligible'},assignmentSnapshots:row.data.assignmentSnapshots.map(a=>({...a,resources:[{resource:{role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:1}},{resource:{role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:1}}]}))}}};}

test('Carrier briefing preserves total and per-unit cargo, both trucks, native offer and explicit capacity limits',()=>{
 const text=buildCarrierBriefing(input());
 for(const fact of ['12000 kg','6000 kg','2 CRATE','indivisible true','1 BOX_TRUCK, 1 BOX_TRUCK','USD 100','not a fresh capacity check','native CargoMesh commands'])assert.ok(text.includes(fact),fact);
 assert.ok(!text.includes('operatingCosts'));
});
test('Carrier context rejects cross-carrier, cross-organization and cross-request data',()=>{
 const x=input();
 assert.throws(()=>buildCarrierBriefing({...x,carrierId:id(99)}));
 for(const field of ['carrierId','organizationId','requestId'] as const)assert.throws(()=>buildCarrierBriefing({...x,offers:[{...offer(),[field]:id(99)}]}));
});
test('stale projection and expired or unrelated offers do not become a recommended price',()=>{
 const x=input();x.opportunity.data.requestBrief.currentRequestVersion=3;
 const stale=buildCarrierBriefing(x);assert.match(stale,/stale or unverified/);assert.ok(!stale.includes('USD 100'));
 const expired=buildCarrierBriefing({...input(),now:Date.parse('2026-10-21T00:00:00Z')});assert.match(expired,/No current issued offer/);
 const other=offer();other.data.planCandidateId=id(98);assert.ok(!buildCarrierBriefing({...input(),offers:[other]}).includes('USD 100'));
});
test('partial reads remain unknown and non-admin sessions never consume private policy inputs',()=>{
 const text=buildCarrierBriefing({...input(),role:'DISPATCHER',policies:[{operatingCosts:'private'}] as never[],offers:[],offersComplete:false});
 assert.match(text,/read is incomplete/);assert.ok(!text.includes('private'));assert.ok(!text.includes('Approved policy'));
});
test('native cost snapshot is restricted to the current exact offer, its price and the ADMIN role',()=>{
 const calculation={offerId:offer().id,policyVersion:1,parameters:null,snapshot:{distanceKm:100,operatingProfile:{version:'ROAD_COST_INPUT_V1',drivingSeconds:7200,tollAmount:0,stops:[],source:ev},restLocations:[],calculation:{status:'READY',formulaVersion:'COST_PLUS_V1',operatingCents:9000,markupCents:1000,taxCents:0,totalCents:10000,resourceCount:2,drivingSeconds:7200,restSeconds:0,paidDriverSeconds:7200,transportSeconds:7200,restStopCount:0,litres:50,provenance:'SIMULATED',components:[{code:'DRIVER',kind:'TRANSPORT',cents:3000}]}}};
 assert.match(buildCarrierBriefing({...input(),calculation}),/Private Carrier calculation/);
 for(const changes of [{role:'DISPATCHER'},{calculation:{...calculation,offerId:id(97)}},{calculation:{...calculation,snapshot:{...calculation.snapshot,calculation:{...calculation.snapshot.calculation,totalCents:20000}}}}])assert.ok(!buildCarrierBriefing({...input(),calculation,...changes}).includes('Private Carrier calculation'));
});
test('privacy-safe allocation summary identifies each carrying binding without raw resource snapshots',()=>{
 const x=input(),first=x.opportunity.data.assignmentSnapshots[0];
 x.opportunity.data.assignmentSnapshots=[{id:first.id,serviceId:first.serviceId,allocationSummary:{role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:[{unitIndex:0,quantity:1,weightKg:6000,volumeM3:7.776}]}} as never,{id:id(91),serviceId:first.serviceId,allocationSummary:{role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:[{unitIndex:0,quantity:1,weightKg:6000,volumeM3:7.776}]}} as never];
 const text=buildCarrierBriefing(x);assert.equal((text.match(/1 BOX_TRUCK carrying 6000 kg/g)??[]).length,2);assert.ok(!text.includes(id(91)));
});
