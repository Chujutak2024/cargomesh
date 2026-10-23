"use client";
import {loadGoogleMaps} from '@/features/v2-road-map/google-maps-loader';
import {browserRoadResult} from '@/shared/lib/browser-road-result';
import {IntakeRoadResponse,type IntakeRoadResult} from '@/shared/schemas/v2/intake-road-preview';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import type {IntakeFacilityOption} from '../contracts';

/** Private to one mounted selector. The website-restricted key stays in its intended browser channel. */
export function createFacilityRouter(){
 const cache=new Map<string,{expires:number;result:IntakeRoadResult}>(),pending=new Map<string,Promise<IntakeRoadResult>>();
 let browserOnly=false;
 let browserCalls:number[]=[];
 const browserRoute=async(origin:IntakeFacilityOption,destination:IntakeFacilityOption):Promise<IntakeRoadResult>=>{
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();
  if(!key)return {status:'unavailable',reason:'PROVIDER_UNAVAILABLE'};
  await loadGoogleMaps(key);
  const {Route}=await google.maps.importLibrary('routes') as google.maps.RoutesLibrary;
  browserCalls=browserCalls.filter(at=>Date.now()-at<60000);
  if(browserCalls.length>=10)return {status:'unavailable',reason:'RATE_LIMITED'};
  browserCalls.push(Date.now());
  const a={lat:origin.lat!,lng:origin.lng!},b={lat:destination.lat!,lng:destination.lng!};
  const calculation=Route.computeRoutes({origin:a,destination:b,travelMode:'DRIVING',routingPreference:'TRAFFIC_UNAWARE',
   computeAlternativeRoutes:false,polylineQuality:'HIGH_QUALITY',routeModifiers:{avoidFerries:true},
   fields:['path','distanceMeters','durationMillis','legs.steps.travelMode','legs.steps.maneuver'],
  });
  let timer:ReturnType<typeof setTimeout>|undefined;
  const response=await Promise.race([calculation,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('ROUTE_TIMEOUT')),12000);})]).finally(()=>clearTimeout(timer));
  const route=response.routes?.[0];
  if(!route)return {status:'blocked',reason:'NO_ROUTE'};
  return browserRoadResult({distanceMeters:route.distanceMeters,durationMillis:route.durationMillis,
   points:route.path?.map(p=>({lat:p.lat,lng:p.lng})),legs:route.legs?.map(leg=>({steps:leg.steps.map(step=>({travelMode:step.travelMode,maneuver:step.maneuver}))})),
  },a,b,new Date().toISOString());
 };
 return (origin:IntakeFacilityOption,destination:IntakeFacilityOption)=>{
  const key=JSON.stringify([origin.facilityId,origin.lat,origin.lng,destination.facilityId,destination.lat,destination.lng]);
  for(const [id,value] of cache)if(value.expires<=Date.now())cache.delete(id);
  const previous=cache.get(key);if(previous)return Promise.resolve(previous.result);
  const active=pending.get(key);if(active)return active;
  const calculate=(async()=>{
   let result:IntakeRoadResult;
   if(!browserOnly){
    const response=await workspaceFetch('/api/v2/intake/options/road-preview?'+new URLSearchParams({originId:origin.facilityId,destinationId:destination.facilityId}),{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('ROAD_PREVIEW_UNAVAILABLE');
    const payload=IntakeRoadResponse.parse(await response.json());
    if(payload.data.originId!==origin.facilityId||payload.data.destinationId!==destination.facilityId)throw new Error('ROUTE_CORRELATION');
    result=payload.data.result;
    if(result.status==='unavailable'&&result.reason==='SERVER_KEY_MISSING'){browserOnly=true;result=await browserRoute(origin,destination);}
   }else result=await browserRoute(origin,destination);
   if(result.status==='estimated'&&result.points.length<=50000){
    let stored=[...cache.values()].reduce((sum,value)=>sum+(value.result.status==='estimated'?value.result.points.length:0),0);
    while(cache.size&&(cache.size>=16||stored+result.points.length>100000)){const id=cache.keys().next().value!,value=cache.get(id)!;stored-=value.result.status==='estimated'?value.result.points.length:0;cache.delete(id);}
    cache.set(key,{expires:Date.now()+300000,result});
   }
   return result;
  })();
  pending.set(key,calculate);
  void calculate.then(()=>pending.delete(key),()=>pending.delete(key));return calculate;
 };
}
