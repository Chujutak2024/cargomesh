import {IntakeRoadQuery,IntakeRoadResponse} from '@/shared/schemas/v2/intake-road-preview';
import {ProviderRoadCalculationV2Schema} from '@/shared/schemas/v2/carrier-road-routing';
import {facilityLandPolicy} from '@/shared/lib/land-network';
import {calculateRoadRoutes} from '@/server/maps/road-routing';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {IntakeActor,IntakeOptionsRepository} from './get-intake-options';

/** Read-only geographic preview. No commercial eligibility, reservation or mutation. */
export function createFacilityRoadPreview(config:{provider?:typeof calculateRoadRoutes;apiKey?:string;now?:()=>number}={}){
 const cache=new Map<string,{expires:number;points:number;value:ReturnType<typeof IntakeRoadResponse.parse>}>();
 const pending=new Map<string,Promise<ReturnType<typeof IntakeRoadResponse.parse>>>();
 const calls=new Map<string,number[]>();
 return async(actor:IntakeActor,repository:Pick<IntakeOptionsRepository,'listActiveFacilities'>,raw:unknown)=>{
  const query=IntakeRoadQuery.parse(raw),now=(config.now??Date.now)();
  if(!actor.memberId||!actor.organizationId)throw new V2DraftError('FORBIDDEN_TENANT','Active organization required.',403);
  // Always authorize against current records, even when geometry is cached.
  const facilities=await repository.listActiveFacilities(actor.organizationId);
  if(facilities.some(f=>f.organization_id!==actor.organizationId))throw new V2DraftError('FORBIDDEN_TENANT','Facility scope mismatch.',403);
  const origin=facilities.find(f=>f.active&&f.id===query.originId),destination=facilities.find(f=>f.active&&f.id===query.destinationId);
  if(!origin||!destination)throw new V2DraftError('FACILITY_NOT_FOUND','Select two current authorized facilities.',404);
  const response=(result:unknown)=>IntakeRoadResponse.parse({schemaVersion:'2.0',data:{...query,result}});
  if(origin.id===destination.id)return response({status:'blocked',reason:'SAME_FACILITY'});
  const valid=(f:typeof origin)=>f.latitude!==null&&f.longitude!==null&&Number.isFinite(f.latitude)&&Number.isFinite(f.longitude)&&Math.abs(f.latitude)<=90&&Math.abs(f.longitude)<=180;
  if(!valid(origin)||!valid(destination))return response({status:'unavailable',reason:'COORDINATES_REQUIRED'});
  if(facilityLandPolicy({countryCode:origin.country_code,lat:origin.latitude,lng:origin.longitude},{countryCode:destination.country_code,lat:destination.latitude,lng:destination.longitude})==='disconnected')return response({status:'blocked',reason:'DISCONNECTED_NETWORKS'});
  const key=JSON.stringify([actor.organizationId,origin.id,origin.latitude,origin.longitude,destination.id,destination.latitude,destination.longitude]);
  for(const [id,entry] of cache)if(entry.expires<=now)cache.delete(id);
  const cached=cache.get(key);if(cached)return cached.value;
  const existing=pending.get(key);if(existing)return existing;
  for(const [id,times] of calls){const recent=times.filter(at=>now-at<60000);if(recent.length)calls.set(id,recent);else calls.delete(id);}
  const recent=calls.get(actor.organizationId)??[];
  if(recent.length>=10||pending.size>=20||calls.size>=100&&!calls.has(actor.organizationId))return response({status:'unavailable',reason:'RATE_LIMITED'});
  calls.set(actor.organizationId,[...recent,now]);
  const calculation=(async()=>{
   const waypoint=(f:typeof origin)=>({lat:f.latitude!,lng:f.longitude!,maxSnapMeters:5000});
   const calculation=ProviderRoadCalculationV2Schema.parse(await (config.provider??calculateRoadRoutes)({origin:waypoint(origin),destination:waypoint(destination),objective:'FASTEST',traffic:'TRAFFIC_UNAWARE',apiKey:config.apiKey}));
   if(calculation.status!=='estimated')return response({status:calculation.reason==='NO_ROUTE'?'blocked':calculation.status,reason:calculation.reason});
   const selected=calculation.alternatives.find(route=>route.id===calculation.selectedId)!;
   const value=response({status:'estimated',source:calculation.source,calculatedAt:calculation.calculatedAt,truckAccess:'UNVERIFIED',distanceMeters:selected.distanceMeters,durationSeconds:selected.durationSeconds,points:selected.points});
   // Bound geometry memory as well as entry count. A long route is still returned intact.
   if(selected.points.length<=50000){
    let storedPoints=[...cache.values()].reduce((sum,entry)=>sum+entry.points,0);
    while(cache.size&&(cache.size>=64||storedPoints+selected.points.length>100000)){
     const oldest=cache.keys().next().value!;storedPoints-=cache.get(oldest)!.points;cache.delete(oldest);
    }
    cache.set(key,{expires:(config.now??Date.now)()+300000,points:selected.points.length,value});
   }
   return value;
  })();
  pending.set(key,calculation);
  try{return await calculation;}finally{if(pending.get(key)===calculation)pending.delete(key);}
 };
}
