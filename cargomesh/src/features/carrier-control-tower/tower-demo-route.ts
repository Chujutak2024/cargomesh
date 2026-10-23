"use client";
import {useEffect,useState} from 'react';
import {loadGoogleMaps} from '@/features/v2-road-map/google-maps-loader';
import {browserRoadResult} from '@/shared/lib/browser-road-result';
import type {Point} from './tower-model';
export type DemoRoadPath={points:readonly Point[];distances:readonly number[];length:number};
const origin={lat:-12.0464,lng:-77.0428},destination={lat:-16.409,lng:-71.5375};
let cached:Promise<DemoRoadPath|null>|null=null;
function meters(a:Point,b:Point){const rad=Math.PI/180,h=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)));}
/** One fixed public demo corridor; no carrier data, credentials or GPS are cached. */
function demoRoute(){
 if(cached)return cached;
 cached=(async()=>{
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();if(!key)return null;
  await loadGoogleMaps(key);
  const {Route}=await google.maps.importLibrary('routes') as google.maps.RoutesLibrary;
  const calculation=Route.computeRoutes({origin,destination,travelMode:'DRIVING',routingPreference:'TRAFFIC_UNAWARE',computeAlternativeRoutes:false,polylineQuality:'HIGH_QUALITY',routeModifiers:{avoidFerries:true},fields:['path','distanceMeters','durationMillis','legs.steps.travelMode','legs.steps.maneuver']});
  let timer:ReturnType<typeof setTimeout>|undefined;
  const response=await Promise.race([calculation,new Promise<never>((_r,reject)=>{timer=setTimeout(()=>reject(new Error('DEMO_ROUTE_TIMEOUT')),12000);})]).finally(()=>clearTimeout(timer));
  const route=response.routes?.[0];if(!route)return null;
  const result=browserRoadResult({distanceMeters:route.distanceMeters,durationMillis:route.durationMillis,points:route.path?.map(p=>({lat:p.lat,lng:p.lng})),legs:route.legs?.map(leg=>({steps:leg.steps.map(step=>({travelMode:step.travelMode,maneuver:step.maneuver}))}))},origin,destination,new Date().toISOString());
  if(result.status!=='estimated')return null;
  const distances=[0];for(let i=1;i<result.points.length;i++)distances.push(distances[i-1]+meters(result.points[i-1],result.points[i]));
  const length=distances[distances.length-1];return length>0?{points:result.points,distances,length}:null;
 })().catch(()=>null);
 return cached;
}
export function useTowerDemoRoute(enabled:boolean){
 const [state,setState]=useState<{path:DemoRoadPath|null;loaded:boolean}>({path:null,loaded:false});
 useEffect(()=>{if(!enabled)return;let closed=false;void demoRoute().then(path=>{if(!closed)setState({path,loaded:true});});return()=>{closed=true;};},[enabled]);
 return state;
}
