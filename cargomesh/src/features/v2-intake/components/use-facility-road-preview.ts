"use client";
import {useEffect,useRef,useState} from 'react';
import {facilityLandPolicy} from '@/shared/lib/land-network';
import type {IntakeRoadResult} from '@/shared/schemas/v2/intake-road-preview';
import {createFacilityRouter} from './browser-facility-routing';
import type {IntakeFacilityOption} from '../contracts';
import {locatedFacility} from './facility-selection-model';

export function useFacilityRoadPreview(origin:IntakeFacilityOption|null,destination:IntakeFacilityOption|null){
 const key=JSON.stringify([origin?.facilityId,origin?.lat,origin?.lng,destination?.facilityId,destination?.lat,destination?.lng]);
 const [state,setState]=useState<{key:string;result:IntakeRoadResult}|null>(null);
 const router=useRef<ReturnType<typeof createFacilityRouter>|null>(null);
 if(!router.current)router.current=createFacilityRouter();
 const complete=Boolean(origin&&destination),located=Boolean(origin&&destination&&locatedFacility(origin)&&locatedFacility(destination));
 const disconnected=Boolean(origin&&destination&&facilityLandPolicy(origin,destination)==='disconnected');
 useEffect(()=>{
  if(!origin||!destination||!located||disconnected)return;
  const controller=new AbortController();
  // Do not calculate intermediate pairs during rapid selections or example loading.
  const timer=setTimeout(()=>{
   void router.current!(origin,destination).then(result=>{
    if(!controller.signal.aborted)setState({key,result});
   }).catch(()=>{if(!controller.signal.aborted)setState({key,result:{status:'unavailable',reason:'PROVIDER_UNAVAILABLE'}});});
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[key,located,disconnected]);
 if(!complete)return {status:'empty' as const,result:null};
 if(!located)return {status:'unavailable' as const,result:{status:'unavailable',reason:'COORDINATES_REQUIRED'} as IntakeRoadResult};
 if(disconnected)return {status:'blocked' as const,result:{status:'blocked',reason:'DISCONNECTED_NETWORKS'} as IntakeRoadResult};
 if(state?.key===key)return {status:state.result.status,result:state.result};
 return {status:'checking' as const,result:null};
}
