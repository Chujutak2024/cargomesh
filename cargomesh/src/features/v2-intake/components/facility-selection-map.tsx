"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {MapPin} from "lucide-react";
import {googleMapsAuthFailed,loadGoogleMaps,onGoogleMapsAuthFailure,retryGoogleMaps} from "@/features/v2-road-map/google-maps-loader";
import {displayDemoText} from "@/shared/lib/demo-presentation";
import {useReducedMotionPreference} from "@/features/product-motion/use-motion-preference";
import type {IntakeRoadResult} from '@/shared/schemas/v2/intake-road-preview';
import type {IntakeFacilityOption} from "../contracts";
import {locatedFacility,type FacilityViewport} from "./facility-selection-model";
import styles from "./facility-selection-workspace.module.css";
type CameraTarget={sequence:number;facilities:IntakeFacilityOption[]};
type Props={origin:IntakeFacilityOption|null;destination:IntakeFacilityOption|null;preview:IntakeFacilityOption|null;focus:IntakeFacilityOption|null;cameraTarget:CameraTarget|null;route:IntakeRoadResult|null;onPreview:(id:string)=>void;onViewport:(viewport:FacilityViewport)=>void;t:(es:string,en:string)=>string};
export default function FacilitySelectionMap({origin,destination,preview,focus,cameraTarget,route,onPreview,onViewport,t}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<google.maps.Map|null>(null);
 const reduced=useReducedMotionPreference();
 const initialCamera=useRef<google.maps.Map|null>(null);
 const lastFrame=useRef<CameraTarget|null>(null);
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const callbacks=useRef({onPreview,onViewport});callbacks.current={onPreview,onViewport};
 const points=useMemo(()=>[...new Map<string,IntakeFacilityOption>([origin,destination,preview].filter((f):f is IntakeFacilityOption=>f!==null).filter(locatedFacility).map(f=>[f.facilityId,f] as const)).values()],[origin,destination,preview]);
 useEffect(()=>{
  let disposed=false,failedAttempt=false,timer:ReturnType<typeof setTimeout>|undefined;
  const listeners:google.maps.MapsEventListener[]=[];
  setLoading(true);setFailed(false);setReady(false);
  const fail=()=>{if(disposed||failedAttempt)return;failedAttempt=true;clearTimeout(timer);setLoading(false);setFailed(true);setReady(false);};
  const off=onGoogleMapsAuthFailure(fail);
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();
  if(!key||googleMapsAuthFailed())fail();
  else{
   timer=setTimeout(fail,12000);
   void loadGoogleMaps(key).then(async()=>{
    if(disposed||failedAttempt||!host.current)return;
    await google.maps.importLibrary('marker');
    if(disposed||failedAttempt||googleMapsAuthFailed()||!host.current)return;
    const instance=new google.maps.Map(host.current,{center:{lat:-9.2,lng:-75},zoom:5,maxZoom:16,mapId:'DEMO_MAP_ID',disableDefaultUI:true,zoomControl:true,gestureHandling:'cooperative',clickableIcons:false});
    map.current=instance;setReady(true);
    listeners.push(google.maps.event.addListenerOnce(instance,'tilesloaded',()=>{if(!disposed&&!failedAttempt){clearTimeout(timer);setLoading(false);}}));
    listeners.push(instance.addListener('idle',()=>{if(disposed||failedAttempt)return;const bounds=instance.getBounds();if(bounds)callbacks.current.onViewport(bounds.toJSON());}));
   }).catch(fail);
  }
  const observer=new ResizeObserver(()=>{if(map.current&&!disposed&&!failedAttempt)google.maps.event.trigger(map.current,'resize');});if(host.current)observer.observe(host.current);
  return()=>{disposed=true;clearTimeout(timer);off();observer.disconnect();listeners.forEach(listener=>listener.remove());if(map.current)google.maps.event.clearInstanceListeners(map.current);map.current=null;};
 },[attempt]);
 useEffect(()=>{
  if(!ready||!map.current||googleMapsAuthFailed())return;
  const markers:google.maps.marker.AdvancedMarkerElement[]=[];
  for(const facility of points){
   const isOrigin=facility.facilityId===origin?.facilityId,isDestination=facility.facilityId===destination?.facilityId;
   const button=document.createElement('button');button.type='button';button.className=styles.mapMarker;button.dataset.role=isOrigin?'origin':isDestination?'destination':'facility';button.textContent=isOrigin?'A':isDestination?'B':'•';button.setAttribute('aria-label',displayDemoText(facility.label)||facility.city);button.addEventListener('click',()=>callbacks.current.onPreview(facility.facilityId));
   markers.push(new google.maps.marker.AdvancedMarkerElement({map:map.current,position:{lat:facility.lat!,lng:facility.lng!},content:button,title:displayDemoText(facility.label)||facility.city,zIndex:isOrigin||isDestination?3:1}));
  }
  return()=>markers.forEach(marker=>{marker.map=null;});
 },[ready,points,origin?.facilityId,destination?.facilityId]);
 useEffect(()=>{
  if(!ready||!map.current||!origin||!destination||!locatedFacility(origin)||!locatedFacility(destination)||route?.status==='blocked')return;
  const estimated=route?.status==='estimated';
  const path=estimated?route.points:[{lat:origin.lat!,lng:origin.lng!},{lat:destination.lat!,lng:destination.lng!}];
  const line=new google.maps.Polyline({map:map.current,path,clickable:false,geodesic:!estimated,strokeOpacity:0,zIndex:1,icons:[{
   icon:{path:'M 0,-1 0,1',strokeColor:estimated?'#00777c':'#718096',strokeOpacity:1,scale:estimated?2:1.5},offset:'0',repeat:estimated?'8px':'14px',
  }]});
  return()=>line.setMap(null);
 },[ready,origin,destination,route]);
 // Marker updates do not reset the camera. Each explicit action owns one movement.
 useEffect(()=>{
  const instance=map.current;
  if(!ready||!instance||googleMapsAuthFailed())return;
  const target=preview??focus;
  if(!target||!locatedFacility(target))return;
  const center={lat:target.lat!,lng:target.lng!},start=instance.getCenter()?.toJSON()??center;
  const zoom=11,startZoom=instance.getZoom()??zoom;
  if(reduced){instance.moveCamera({center,zoom});return;}
  let frame=0;
  const started=performance.now(),longitudeDelta=((center.lng-start.lng+540)%360)-180;
  const animate=(now:number)=>{
   const progress=Math.min(1,(now-started)/520),ease=1-Math.pow(1-progress,3);
   instance.moveCamera({center:{lat:start.lat+(center.lat-start.lat)*ease,lng:start.lng+longitudeDelta*ease},zoom:startZoom+(zoom-startZoom)*ease});
   if(progress<1)frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  const cancel=()=>cancelAnimationFrame(frame);
  const drag=instance.addListener('dragstart',cancel);
  return()=>{cancel();drag.remove();};
 },[ready,preview,focus,reduced,cameraTarget]);
 useEffect(()=>{
  const instance=map.current;
  if(!ready||!instance)return;
  const first=initialCamera.current!==instance;
  const explicit=cameraTarget!==null&&lastFrame.current!==cameraTarget;
  if(!explicit&&!first)return;
  const targets=(cameraTarget?.facilities??[origin,destination]).filter((f):f is IntakeFacilityOption=>f!==null).filter(locatedFacility);
  if(!targets.length)return;
  initialCamera.current=instance;
  if(explicit)lastFrame.current=cameraTarget;
  if(!explicit&&(focus||preview))return;
  if(targets.length===1){instance.moveCamera({center:{lat:targets[0].lat!,lng:targets[0].lng!},zoom:11});return;}
  const bounds=new google.maps.LatLngBounds();targets.forEach(f=>bounds.extend({lat:f.lat!,lng:f.lng!}));
  if(reduced){
   // Set the final camera directly; fitBounds may otherwise animate internally.
   const mercator=(latitude:number)=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,latitude))*Math.PI/360));
   const box=bounds.toJSON(),latitudeSpan=Math.abs(mercator(box.north)-mercator(box.south))/(2*Math.PI);
   const longitudeSpan=((box.east-box.west+360)%360)/360;
   const width=Math.max(1,instance.getDiv().clientWidth-128),height=Math.max(1,instance.getDiv().clientHeight-128);
   const zoom=Math.max(2,Math.min(11,Math.log2(width/(256*Math.max(longitudeSpan,1e-8))),Math.log2(height/(256*Math.max(latitudeSpan,1e-8)))));
   instance.moveCamera({center:bounds.getCenter(),zoom});
  }
  else instance.fitBounds(bounds,64);
 },[ready,cameraTarget,origin,destination,focus,preview,reduced]);
 return <>
  <div ref={host} className={styles.mapCanvas} role="region" aria-label={t('Ubicaciones de sedes en Google Maps','Facility locations on Google Maps')} hidden={failed}/>
  {failed?<div className={styles.mapStatus} role="status"><MapPin size={28} aria-hidden="true"/><strong>{t('El mapa no está disponible','Map unavailable')}</strong><p>{t('Puedes seguir eligiendo origen y destino en la lista.','You can still choose origin and destination from the list.')}</p><button type="button" onClick={()=>{retryGoogleMaps();setAttempt(value=>value+1);}}>{t('Reintentar mapa','Retry map')}</button></div>:loading?<div className={styles.mapStatus} role="status">{t('Cargando mapa…','Loading map…')}</div>:null}
 </>;
}
