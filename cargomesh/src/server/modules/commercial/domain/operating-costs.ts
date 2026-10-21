import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/commercial';
import {CarrierOperatingCostsSchema,RouteOperatingProfileSchema,type CarrierOperatingCosts} from '@/shared/schemas/v2/operating-costs';
type Failure={status:'REQUIRES_REVIEW';reason:string};
type Component={code:string;kind:'FUEL'|'TOLL'|'HANDLING'|'TRANSPORT'|'OTHER'|'TAX';cents:number};
export type CostRoute={distanceKm:number|null;operatingProfile:unknown;waypoints:readonly {kind:string;source:unknown}[]};
/** Rates are approved by Carrier; cents use integer arithmetic. Route facts are never model guesses. */
export function calculateOperatingCosts(rawPolicy:CarrierOperatingCosts,route:CostRoute,resourceCount:number,minimumAmount:number,additionalDutySeconds:number,now:number,validThrough:number){
 const fail=(reason:string):Failure=>({status:'REQUIRES_REVIEW',reason});
 const parsed=CarrierOperatingCostsSchema.safeParse(rawPolicy),profile=RouteOperatingProfileSchema.safeParse(route.operatingProfile);
 if(!Number.isFinite(now)||!Number.isFinite(validThrough)||validThrough<now)return fail('COST_INPUT_INVALID');
 if(!parsed.success)return fail('COST_POLICY_INVALID');
 if(!profile.success)return fail('ROUTE_OPERATING_PROFILE_REQUIRED');
 const p=parsed.data,r=profile.data,ev=r.source;
 if(p.fleet)return fail('COST_RESOURCE_IDENTITIES_REQUIRED');
 if(!['VERIFIED','SIMULATED'].includes(ev.provenanceStatus)||Date.parse(ev.observedAt)>now||!ev.validUntil||Date.parse(ev.validUntil)<=now||Date.parse(ev.validUntil)<validThrough)return fail('COST_ROUTE_EVIDENCE_REQUIRED');
 if(route.distanceKm===null||!Number.isFinite(route.distanceKm)||route.distanceKm<=0||route.distanceKm>1e6)return fail('COST_DISTANCE_REQUIRED');
 if(!Number.isInteger(resourceCount)||resourceCount<1||resourceCount>8||!Number.isInteger(additionalDutySeconds)||additionalDutySeconds<0||additionalDutySeconds>2592000||!Number.isFinite(minimumAmount)||minimumAmount<0||minimumAmount>1e8)return fail('COST_INPUT_INVALID');
 let previous=0,continuous=0,daily=0,restSeconds=0,restFees=0;
 for(const stop of [...r.stops,{waypointIndex:-1,afterDrivingSeconds:r.drivingSeconds,restMinutes:0,feeAmount:0}]){
  const segment=stop.afterDrivingSeconds-previous;continuous+=segment;daily+=segment;
  if(continuous>p.maxContinuousDrivingMinutes*60||daily>p.maxDailyDrivingMinutes*60)return fail('DRIVER_REST_PLAN_REQUIRED');
  if(stop.waypointIndex>=0){const w=route.waypoints[stop.waypointIndex],e=CommercialEvidenceV2Schema.safeParse(w?.source);if(!w||w.kind!=='REST'||!e.success||!['VERIFIED','SIMULATED'].includes(e.data.provenanceStatus)||Date.parse(e.data.observedAt)>now||!e.data.validUntil||Date.parse(e.data.validUntil)<=now||Date.parse(e.data.validUntil)<validThrough)return fail('REST_LOCATION_EVIDENCE_REQUIRED');}
  if(stop.restMinutes>=p.breakMinutes)continuous=0;if(stop.restMinutes>=p.dailyRestMinutes)daily=0;
  restSeconds+=stop.restMinutes*60;restFees+=Math.round(stop.feeAmount*100);previous=stop.afterDrivingSeconds;
 }
 const n=BigInt(resourceCount),distance=BigInt(Math.round(route.distanceKm*1e6)),rate=(v:number)=>BigInt(Math.round(v*1e4));
 const rounded=(a:bigint,b:bigint)=>Number((a+b/BigInt('2'))/b),paid=r.drivingSeconds+additionalDutySeconds+(p.payRestTime?restSeconds:0);
 const components:Component[]=[
  {code:'FUEL',kind:'FUEL',cents:rounded(distance*rate(p.fuelLitresPer100Km)*rate(p.fuelPricePerLitre)*n,BigInt('100000000000000'))},
  {code:'DRIVER',kind:'OTHER',cents:rounded(rate(p.driverHourlyCost)*BigInt(paid)*n,BigInt('360000'))},
  {code:'VEHICLE',kind:'TRANSPORT',cents:rounded(distance*rate(p.vehicleCostPerKm)*n,BigInt('100000000'))},
  {code:'FIXED_PER_VEHICLE',kind:'TRANSPORT',cents:Math.round(p.fixedCostPerVehicle*100)*resourceCount},
  {code:'TOLLS',kind:'TOLL',cents:Math.round(r.tollAmount*100)*resourceCount},
  {code:'REST_FACILITIES',kind:'OTHER',cents:restFees*resourceCount},
  {code:'HANDLING_PER_SHIPMENT',kind:'HANDLING',cents:Math.round(p.handlingCostPerShipment*100)},
 ];
 const operatingCents=components.reduce((s,c)=>s+c.cents,0),markupCents=rounded(BigInt(operatingCents)*rate(p.markupPercent),BigInt('1000000'));
 components.push({code:'CARRIER_MARKUP',kind:'OTHER',cents:markupCents});
 const floor=Math.max(0,Math.round(minimumAmount*100)-operatingCents-markupCents);components.push({code:'MINIMUM_ADJUSTMENT',kind:'OTHER',cents:floor});
 const beforeTax=operatingCents+markupCents+floor,taxCents=rounded(BigInt(beforeTax)*rate(p.taxPercent),BigInt('1000000'));components.push({code:'TAX',kind:'TAX',cents:taxCents});
 const totalCents=beforeTax+taxCents;if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>1e12)return fail('COST_TOTAL_INVALID');
 return {status:'READY' as const,formulaVersion:p.version,operatingCents,markupCents,taxCents,totalCents,components,resourceCount,drivingSeconds:r.drivingSeconds,restSeconds,paidDriverSeconds:paid,transportSeconds:r.drivingSeconds+restSeconds,restStopCount:r.stops.length,litres:Number(distance)/1e6*p.fuelLitresPer100Km/100*resourceCount,provenance:ev.provenanceStatus};
}

export type CostTruck={assetId:string;equipmentCode:string};
/** Sum separately rounded truck costs; apply shipment handling, markup, minimum and tax only once. */
export function calculateFleetOperatingCosts(policy:CarrierOperatingCosts,route:CostRoute,trucks:CostTruck[],minimumAmount:number,additionalDutySeconds:number,now:number,validThrough:number){
 const fail=(reason:string):Failure=>({status:'REQUIRES_REVIEW',reason});
 const parsed=CarrierOperatingCostsSchema.safeParse(policy);if(!parsed.success)return fail('COST_POLICY_INVALID');
 if(!Number.isFinite(minimumAmount)||minimumAmount<0||minimumAmount>1e8)return fail('COST_INPUT_INVALID');
 const p=parsed.data;if(!trucks.length||trucks.length>8||new Set(trucks.map(t=>t.assetId)).size!==trucks.length)return fail('COST_RESOURCE_IDENTITIES_REQUIRED');
 if(!p.fleet)return calculateOperatingCosts(p,route,trucks.length,minimumAmount,additionalDutySeconds,now,validThrough);
 const components:Component[]=[],resources:import('zod').infer<typeof import('@/shared/schemas/v2/operating-costs').ResourceCostResultSchema>[]=[];
 let litres=0,reference:Extract<ReturnType<typeof calculateOperatingCosts>,{status:'READY'}>|undefined;
 for(const truck of [...trucks].sort((a,b)=>a.assetId.localeCompare(b.assetId))){
  const binding=p.fleet.assets.find(a=>a.assetId===truck.assetId),profile=p.fleet.profiles.find(v=>v.id===binding?.profileId);
  if(!binding||!profile)return fail('TRUCK_COST_PROFILE_REQUIRED');if(profile.equipmentCode!==truck.equipmentCode)return fail('TRUCK_COST_EQUIPMENT_MISMATCH');
  const effective={...profile,...binding.overrides};
  const driving=(route.operatingProfile as {drivingSeconds?:number}|null)?.drivingSeconds;
  // A speed cap is a lower bound on time, not a promise that the truck can maintain this speed.
  if(!driving||route.distanceKm===null||driving<Math.ceil(route.distanceKm/effective.maxSpeedKph*3600))return fail('TRUCK_DRIVING_TIME_INCONSISTENT');
  const {fleet:_,...base}=p;
  const cost=calculateOperatingCosts({...base,fuelLitresPer100Km:effective.fuelLitresPer100Km,driverHourlyCost:effective.driverHourlyCost,vehicleCostPerKm:effective.vehicleCostPerKm,fixedCostPerVehicle:effective.fixedCostPerVehicle,handlingCostPerShipment:0,markupPercent:0,taxPercent:0},route,1,0.01,additionalDutySeconds,now,validThrough);
  if(cost.status!=='READY')return cost;reference=cost;litres+=cost.litres;
  resources.push({assetId:truck.assetId,profileId:profile.id,label:profile.label,equipmentCode:profile.equipmentCode,operatingCents:cost.operatingCents,litres:cost.litres,maxSpeedKph:effective.maxSpeedKph,drivingSeconds:cost.drivingSeconds});
  for(const c of cost.components.filter(v=>!['CARRIER_MARKUP','MINIMUM_ADJUSTMENT','TAX','HANDLING_PER_SHIPMENT'].includes(v.code))){const old=components.find(x=>x.code===c.code);if(old)old.cents+=c.cents;else components.push({...c});}
 }
 components.push({code:'HANDLING_PER_SHIPMENT',kind:'HANDLING',cents:Math.round(p.handlingCostPerShipment*100)});
 const operatingCents=components.reduce((n,c)=>n+c.cents,0),percent=(amount:number,value:number)=>Number((BigInt(amount)*BigInt(Math.round(value*10000))+BigInt('500000'))/BigInt('1000000'));
 const markupCents=percent(operatingCents,p.markupPercent),floor=Math.max(0,Math.round(minimumAmount*100)-operatingCents-markupCents),taxCents=percent(operatingCents+markupCents+floor,p.taxPercent),totalCents=operatingCents+markupCents+floor+taxCents;
 if(!Number.isFinite(minimumAmount)||minimumAmount<0||minimumAmount>1e8||!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>1e12)return fail('COST_TOTAL_INVALID');
 components.push({code:'CARRIER_MARKUP',kind:'OTHER',cents:markupCents},{code:'MINIMUM_ADJUSTMENT',kind:'OTHER',cents:floor},{code:'TAX',kind:'TAX',cents:taxCents});
 return {...reference!,operatingCents,markupCents,taxCents,totalCents,components,resourceCount:trucks.length,resources,litres};
}
