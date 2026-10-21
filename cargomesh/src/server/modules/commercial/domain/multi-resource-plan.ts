import {evaluateRoad,type RoadRequest,type RoadService,type Capacity} from '../../road-serviceability/domain/evaluate-road';
type Unit={quantity:number;weightPerUnitKg:number;volumePerUnitM3:number;dimensionsCm:{length:number;width:number;height:number};indivisible:boolean};
type Resource={calendarId:string;assetId:string;poolId:null;allocations:Array<{unitIndex:number;quantity:number}>};
export type ResourcePlanSearch={status:'FOUND';laneId:string;resources:Resource[];algorithm:'WHOLE_PACKAGE_BACKTRACK_V1';visited:number}|{status:'NO_PLAN'|'REQUIRES_REVIEW';reason:string;visited:number};
/** Bounded deterministic feasibility, not global cost/3D packing optimization. Native SQL revalidates every proposal. */
export function planWholePackages(request:RoadRequest,units:Unit[],divisible:boolean,service:RoadService):ResourcePlanSearch{
 let visited=0,checks=0,limitReached=false;
 const fail=(status:'NO_PLAN'|'REQUIRES_REVIEW',reason:string):ResourcePlanSearch=>({status,reason,visited});
 if(service.mode!=='ROAD'||service.serviceClass!=='FTL'||!service.active)return fail('NO_PLAN','AUTOMATIC_ADAPTER_UNSUPPORTED');
 if((service.maxWeightKg!=null&&request.totalWeightKg>service.maxWeightKg)||(service.maxVolumeM3!=null&&request.totalVolumeM3>service.maxVolumeM3))return fail('NO_PLAN','SERVICE_CAPACITY_LIMIT_EXCEEDED');
 if(units.reduce((n,u)=>n+u.quantity,0)>200)return fail('REQUIRES_REVIEW','PLAN_SEARCH_PACKAGE_LIMIT');
 const capacities=service.capacities.filter(c=>c.role==='CARRIER'&&c.sourceType==='TRANSPORT_ASSET'&&!!c.calendarId).sort((a,b)=>a.id.localeCompare(b.id));
 if(capacities.length>64)return fail('REQUIRES_REVIEW','PLAN_SEARCH_RESOURCE_LIMIT');
 const assess=(c:Capacity,allocations:number[])=>{
  if(++checks>50000){limitReached=true;return undefined;}
  const present=units.flatMap((u,i)=>allocations[i]>0?[u]:[]);
  const weight=units.reduce((n,u,i)=>n+u.weightPerUnitKg*allocations[i],0),volume=units.reduce((n,u,i)=>n+u.volumePerUnitM3*allocations[i],0);
  return evaluateRoad({...request,totalWeightKg:weight,totalVolumeM3:volume,unitDimensionsCm:present.map(u=>u.dimensionsCm),indivisibleUnits:present.filter(u=>u.indivisible).map(u=>({weightKg:u.weightPerUnitKg,volumeM3:u.volumePerUnitM3}))},[{...service,capacities:[c]}]).candidates[0];
 };
 const resources=capacities.filter(c=>units.some((_,i)=>assess(c,units.map((__,j)=>j===i?1:0))?.status==='eligible'));
 if(limitReached)return fail('REQUIRES_REVIEW','PLAN_SEARCH_WORK_LIMIT');
 const pieces=units.flatMap((u,i)=>Array.from({length:u.quantity},()=>i)).sort((a,b)=>units[b].weightPerUnitKg-units[a].weightPerUnitKg||units[b].volumePerUnitM3-units[a].volumePerUnitM3||a-b);
 const allocations=resources.map(()=>units.map(()=>0));let chosen:number[]|null=null,laneId='';

 const search=(piece:number,limit:number):boolean=>{
  if(++visited>50000){limitReached=true;return false;}
  if(piece===pieces.length){const active=allocations.map((a,i)=>a.some(n=>n>0)?i:-1).filter(i=>i>=0);const lanes=active.map(i=>assess(resources[i],allocations[i])?.evidence.lane.laneId);if(!lanes[0]||lanes.some(l=>l!==lanes[0]))return false;chosen=active;laneId=lanes[0];return true;}
  const unit=pieces[piece],used=allocations.filter(a=>a.some(n=>n>0)).length;
  for(let i=0;i<resources.length;i++){
   if(!allocations[i].some(n=>n>0)&&used>=limit)continue;
   allocations[i][unit]++;
   const ok=assess(resources[i],allocations[i])?.status==='eligible';
   if(ok&&search(piece+1,limit))return true;
   allocations[i][unit]--;if(limitReached)return false;
  }
  return false;
 };
 for(let count=1;count<=Math.min(divisible?8:1,resources.length);count++){
  if(search(0,count))break;
  if(limitReached)return fail('REQUIRES_REVIEW','PLAN_SEARCH_WORK_LIMIT');
 }
 if(!chosen)return fail('REQUIRES_REVIEW','NO_VERIFIED_WHOLE_PACKAGE_PLAN');
 return {status:'FOUND',laneId,resources:(chosen as number[]).map(i=>({calendarId:resources[i].calendarId!,assetId:resources[i].id,poolId:null,allocations:allocations[i].flatMap((quantity,unitIndex)=>quantity>0?[{unitIndex,quantity}]:[])})),algorithm:'WHOLE_PACKAGE_BACKTRACK_V1',visited};
}
