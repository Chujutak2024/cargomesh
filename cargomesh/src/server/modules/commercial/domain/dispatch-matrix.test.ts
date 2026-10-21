import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {RoadRequest,RoadService} from '../../road-serviceability/domain/evaluate-road';
import type {DispatchOption,DispatchPreferences} from '@/shared/schemas/v2/dispatch';
import type {CarrierOperatingCosts} from '@/shared/schemas/v2/operating-costs';
import {proposeDispatchAlternatives,compareDispatchPlans} from './dispatch-alternatives';
import {calculateFleetOperatingCosts} from './operating-costs';

// User matrix 2026-10-21: synthetic internal costs, never production tariffs.
// No legal class is inferred from payload, and no PEN commercial offer is emitted.
const now=Date.parse('2026-10-21T00:00:00Z');
const window={startsAt:'2026-10-23T00:00:00Z',endsAt:'2026-10-25T00:00:00Z'};
const pickup={startsAt:'2026-10-23T08:00:00Z',endsAt:'2026-10-23T12:00:00Z'};
const delivery={startsAt:'2026-10-23T09:00:00Z',endsAt:'2026-10-23T20:00:00Z'};
const specs=[
 ['L1',1100,7,300,170],['L2',1100,7,300,170],
 ['M1',4000,22,450,380],['M2',4000,22,450,380],['H1',12000,55,650,700],
] as const;
const assetId=(i:number)=>`a0000001-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
const labels=new Map(specs.map((s,i)=>[assetId(i),s[0]]));
const policy:CarrierOperatingCosts={version:'COST_PLUS_V1',fuelLitresPer100Km:0,
 fuelPricePerLitre:0,driverHourlyCost:0,vehicleCostPerKm:0,fixedCostPerVehicle:0,
 handlingCostPerShipment:0,maxContinuousDrivingMinutes:720,breakMinutes:30,
 maxDailyDrivingMinutes:720,dailyRestMinutes:600,payRestTime:true,markupPercent:0,taxPercent:0,
 fleet:{version:'TRUCK_PROFILES_V1',profiles:specs.map(s=>({id:s[0],label:s[0],
 equipmentCode:'BOX_TRUCK',fuelLitresPer100Km:0,driverHourlyCost:0,vehicleCostPerKm:0,
 fixedCostPerVehicle:s[4],maxSpeedKph:100})),
 assets:specs.map((s,i)=>({assetId:assetId(i),profileId:s[0],overrides:{}}))}};
const evidence={reference:'fixture:carrier-matrix',provider:'Synthetic matrix',
 observedAt:'2026-01-01T00:00:00Z',validUntil:'2027-01-01T00:00:00Z',provenanceStatus:'SIMULATED'};
const route={distanceKm:50,waypoints:[],operatingProfile:{version:'ROAD_COST_INPUT_V1',
 drivingSeconds:3600,tollAmount:0,stops:[],source:evidence}};
const preferences:DispatchPreferences={urgency:'SCHEDULED',loadSize:null,timeZone:'UTC',
 pickupWindows:[pickup],deliveryWindows:[delivery]};
const option:DispatchOption={admissions:specs.map((_,i)=>({assetId:assetId(i),limitId:assetId(i),version:1,compatibilityConfirmed:true,admission:null,source:{...evidence,provenanceStatus:'SIMULATED'}})),serviceId:'service',laneId:'lane',routeId:'route',policyVersion:1,
 transitSeconds:3600,provenance:'SIMULATED',costMode:'COST_PLUS',maxResources:2,
 policy:{allowedPriorities:['SCHEDULED','URGENT'],minNoticeMinutes:0,loadingMinutes:0,
 unloadingMinutes:0,autoConfirm:false,maxBookingAmount:null,acknowledgeSchedulingAuthority:false}};
function service():RoadService{return {id:'service',carrierId:'carrier',mode:'ROAD',serviceClass:'FTL',
 active:true,supportedCargoCategoryCodes:['GENERAL'],maxWeightKg:20000,maxVolumeM3:100,
 areas:[['pick','PICKUP','A'],['drop','DELIVERY','B']].map(([id,role,city])=>({id,
 role:role as 'PICKUP'|'DELIVERY',coverage:'INCLUDE',granularity:'CITY',location:{countryCode:'PE',city},
 active:true,validFrom:'2026-01-01T00:00:00Z',validUntil:'2027-01-01T00:00:00Z'})),
 lanes:[{id:'lane',pickupAreaId:'pick',deliveryAreaId:'drop',active:true,
 validFrom:'2026-01-01T00:00:00Z',validUntil:'2027-01-01T00:00:00Z',
 plannedTransitMinutes:60,transitProvenanceStatus:'SIMULATED'}],
 capacities:specs.map((s,i)=>({id:assetId(i),calendarId:`calendar-${i}`,sourceType:'TRANSPORT_ASSET',
 role:'CARRIER',equipmentCode:'BOX_TRUCK',cargoCategoryCodes:['GENERAL'],maxWeightKg:s[1],maxVolumeM3:s[2],
 usableDimensionsCm:{length:s[3],width:240,height:350},
 calendar:{complete:true,validUntil:'2027-01-01T00:00:00Z',readyPickupAreaId:'pick',
 provenanceStatus:'SIMULATED',availableWindows:[window],reservations:[],maintenance:[],repositioning:[]}}))};}
function input(quantity:number,weight:number,volume=.64,dimensions={length:100,width:80,height:80}){
 const units=[{quantity,weightPerUnitKg:weight,volumePerUnitM3:volume,dimensionsCm:dimensions,
 indivisible:true,packageType:'BOX' as const,stackable:false}];
 const request={cargoSpecification:{units,divisible:true}};
 const road:RoadRequest={origin:{countryCode:'PE',city:'A'},destination:{countryCode:'PE',city:'B'},
 operationWindow:window,pickupWindow:pickup,deliveryWindow:delivery,cargoCategoryCode:'GENERAL',
 totalWeightKg:quantity*weight,totalVolumeM3:quantity*volume,unitDimensionsCm:[dimensions],
 indivisibleUnits:[{weightKg:weight,volumeM3:volume}],requiredEquipmentCode:'BOX_TRUCK',unverifiedRequirements:[]};
 return {request,road};
}
function solve(c:ReturnType<typeof input>,svc=service(),prefs=preferences,opt=option,costs=policy){
 const result=proposeDispatchAlternatives(c.request,prefs,c.road,svc,opt,now);
 if(result.status!=='FOUND')return {result,priced:[]};
 const priced=result.plans.flatMap(plan=>{
  const trucks=plan.resources.map(r=>({assetId:r.assetId,equipmentCode:'BOX_TRUCK'}));
  const cost=calculateFleetOperatingCosts(costs,route,trucks,0,0,now,Date.parse(plan.schedule.operationWindow.endsAt));
  return cost.status==='READY'?[{plan,totalCents:cost.totalCents,schedule:plan.schedule}]:[];
 }).sort((a,b)=>compareDispatchPlans(a,b,prefs.urgency));
 return {result,priced};
}
function expectPlan(c:ReturnType<typeof input>,assets:string[],cents:number,svc=service()){
 const solved=solve(c,svc);assert.equal(solved.result.status,'FOUND');
 assert.deepEqual(solved.priced[0]?.plan.resources.map(r=>labels.get(r.assetId)),assets);
 assert.equal(solved.priced[0]?.totalCents,cents);
 assert.ok(solved.priced.every(p=>p.plan.resources.length<=2));
 // No piece is split or assigned twice, regardless of the selected combination.
 for(const p of solved.priced){const counts=c.request.cargoSpecification.units.map(()=>0);
  for(const r of p.plan.resources)for(const a of r.allocations)counts[a.unitIndex]+=a.quantity;
  assert.deepEqual(counts,c.request.cargoSpecification.units.map(u=>u.quantity));}
}
const cases=[
 ['A-01',input(1,900,2),['L1'],17000],
 ['A-02',input(2,1000),['L1','L2'],34000],
 ['A-03',input(1,2000),['M1'],38000],
 ['A-04',input(3,1000),['M1'],38000],
 ['A-05',input(5,1000),['L1','M1'],55000],
 ['A-06',input(7,1000),['H1'],70000],
 ['A-07',input(1,4500),['H1'],70000],
 ['A-08',input(1,900,9,{length:300,width:200,height:150}),['M1'],38000],
 ['A-09',input(1,900,4.4,{length:550,width:80,height:100}),['H1'],70000],
] as const;
for(const [id,c,assets,cents] of cases)test(`${id}: feasible plan minimizes synthetic whole-trip internal cost`,()=>expectPlan(c,[...assets],cents));
test('A-10: a maintained small truck invalidates the cheaper two-truck plan',()=>{
 const svc=service();svc.capacities[1].calendar!.maintenance=[window];expectPlan(input(2,1000),['M1'],38000,svc);
});
test('A-11: a fully known occupied fleet cannot supply 3t with only two 1.1t trucks',()=>{
 const svc=service();for(const c of svc.capacities.slice(2))c.calendar!.reservations=[window];
 assert.notEqual(solve(input(3,1000),svc).result.status,'FOUND');
});
test('A-12: denied heavy truck yields two admitted medium trucks, never a manufactured calendar block',()=>{
 const admissions=structuredClone(option.admissions);admissions[4].compatibilityConfirmed=false;
 admissions[4].admission={decision:'DENIED',reasonCode:'LOCAL_ACCESS_RESTRICTION'};
 const solved=solve(input(7,1000),service(),preferences,{...option,admissions});
 assert.deepEqual(solved.priced[0]?.plan.resources.map(r=>labels.get(r.assetId)),['M1','M2']);
 assert.equal(solved.priced[0]?.totalCents,76000);
 assert.ok(solved.priced.every(p=>p.plan.resources.every(r=>r.assetId!==assetId(4))));
});
test('A-12 missing or expired admission cannot validate the only physically compatible truck',()=>{
 for(const state of ['missing','expired'] as const){const admissions=structuredClone(option.admissions);
  if(state==='missing')admissions.pop();else admissions[4].source!.validUntil='2026-10-22T00:00:00Z';
  assert.equal(solve(input(1,4500),service(),preferences,{...option,admissions}).result.status,'REQUIRES_REVIEW');}
});
test('A-13: reject cheap trucks arriving after receiving closes',()=>{
 const svc=service();svc.lanes[0].plannedTransitMinutes=660;
 for(const c of svc.capacities.slice(0,2))c.calendar!.availableWindows=[{startsAt:'2026-10-23T11:00:00Z',endsAt:window.endsAt}];
 const solved=solve(input(1,900),svc,preferences,{...option,transitSeconds:39600});
 assert.deepEqual(solved.priced[0]?.plan.resources.map(r=>labels.get(r.assetId)),['M1']);
 assert.equal(solved.priced[0]?.totalCents,38000);
});
test('A-14: stale calendars yield review, and expired costs cannot yield a priced plan',()=>{
 const svc=service();for(const c of svc.capacities)c.calendar!.validUntil='2026-10-22T00:00:00Z';
 assert.equal(solve(input(2,1000),svc).result.status,'REQUIRES_REVIEW');
 const expired=calculateFleetOperatingCosts(policy,{...route,operatingProfile:{...route.operatingProfile,
 source:{...evidence,validUntil:'2026-10-20T00:00:00Z'}}},[{assetId:assetId(0),equipmentCode:'BOX_TRUCK'}],0,0,now,now+3600000);
 assert.equal(expired.status,'REQUIRES_REVIEW');
});
test('C-02: a 10t service limit applies to the whole 12t request despite two free trucks',()=>{
 const svc=service();svc.maxWeightKg=10000;assert.notEqual(solve(input(2,6000),svc).result.status,'FOUND');
});
test('C-01 allocation only: a 20t service can allocate two indivisible 6t crates to two 10t trucks',()=>{
 const svc=service();svc.capacities=svc.capacities.slice(0,2).map(c=>({...c,maxWeightKg:10000,maxVolumeM3:30}));
 const solved=solve(input(2,6000,7.776,{length:240,width:180,height:180}),svc);
 assert.equal(solved.result.status,'FOUND');
 assert.deepEqual(solved.priced[0]?.plan.resources.map(r=>r.allocations),[
  [{unitIndex:0,quantity:1}],[{unitIndex:0,quantity:1}]]);
 // Route A-B is synthetic. This is not Lima-Arequipa ETA, commercial issuance or booking evidence.
});
test('C-03: only one available 10t truck cannot carry two indivisible 6t units',()=>{
 const svc=service();svc.capacities=svc.capacities.slice(0,2).map(c=>({...c,maxWeightKg:10000,maxVolumeM3:30}));
 svc.capacities[1].calendar!.maintenance=[window];assert.notEqual(solve(input(2,6000),svc).result.status,'FOUND');
});
test('C-04: a transit longer than the accepted delivery window cannot be accelerated',()=>{
 assert.notEqual(solve(input(1,900),service(),preferences,{...option,transitSeconds:48*3600}).result.status,'FOUND');
});
test('C-05: unsupported route provenance never becomes an approved calculated cost',()=>{
 const cost=calculateFleetOperatingCosts(policy,{...route,operatingProfile:{...route.operatingProfile,
 source:{...evidence,provenanceStatus:'ESTIMATED'}}},[{assetId:assetId(0),equipmentCode:'BOX_TRUCK'}],0,0,now,now+3600000);
 assert.equal(cost.status,'REQUIRES_REVIEW');
});
