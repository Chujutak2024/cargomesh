'use client';
import {useEffect,useRef,useState} from 'react';
import {Crosshair,Globe2,MapPin,Minus,Plus,RefreshCw} from 'lucide-react';
import {loadGoogleMaps,onGoogleMapsAuthFailure} from '@/features/v2-road-map/google-maps-loader';
import {towerDate,type TowerItem,type TowerSite} from './tower-model';
import {roadAlternatives,selectedRoad,type RoadDisplay} from './road-plan-client';
import s from './tower.module.css';
type Props={items:TowerItem[];sites:TowerSite[];selected:TowerItem|null;onSelect:(id:string)=>void;showSites:boolean;road?:RoadDisplay|null};
const operationSvg='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M1 3h14v14H1zM15 8h4l3 4v5h-7"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/></svg>';
const depotSvg='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 9 9-6 9 6v12H3zM8 21v-9h8v9M8 15h8M8 18h8"/></svg>';
export function GoogleOperationMap({items,sites,selected,onSelect,showSites,road=null}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<google.maps.Map|null>(null),fit=useRef(false),markers=useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[cameraTick,setCameraTick]=useState(0);
 useEffect(()=>{let cancelled=false;const listeners:google.maps.MapsEventListener[]=[];setReady(false);setError('');
  const off=onGoogleMapsAuthFailure(()=>{setReady(false);setError('Google Maps authorization failed. The operation list remains available.');});
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();if(!key){setError('Google Maps is not configured. The operation list remains available.');return off;}
  void loadGoogleMaps(key).then(async()=>{await google.maps.importLibrary('marker');if(cancelled||!host.current)return;
   map.current=new google.maps.Map(host.current,{center:{lat:10,lng:-40},zoom:2,renderingType:google.maps.RenderingType.VECTOR,mapId:'DEMO_MAP_ID',disableDefaultUI:true,gestureHandling:'cooperative',clickableIcons:false,keyboardShortcuts:true});
   for(const event of ['zoom_changed','projection_changed'])listeners.push(map.current.addListener(event,()=>{if(!cancelled)setCameraTick(n=>n+1);}));fit.current=false;setReady(true);
  }).catch(()=>{if(!cancelled)setError('Google Maps is unavailable. Use the operation list.');});
  const observer=new ResizeObserver(()=>{if(map.current)google.maps.event.trigger(map.current,'resize');});if(host.current)observer.observe(host.current);
  return()=>{cancelled=true;off();observer.disconnect();listeners.forEach(listener=>listener.remove());markers.current.forEach(marker=>marker.map=null);map.current=null;};
 },[retry]);
 useEffect(()=>{if(!ready||!map.current)return;markers.current.forEach(marker=>marker.map=null);markers.current=[];const listeners:google.maps.MapsEventListener[]=[];
  const bounds=new google.maps.LatLngBounds(),projection=map.current.getProjection(),scale=2**(map.current.getZoom()??2);
  const positioned=items.filter(item=>item.position!==null),groups:Array<Array<{id:string;x:number;y:number}>>=[];
  positioned.forEach(item=>{const p=projection?.fromLatLngToPoint(new google.maps.LatLng(item.position!)),position=item.position!;const pt={id:item.id,x:p?p.x*scale:position.lng*100,y:p?p.y*scale:position.lat*100};const group=groups.find(group=>group.some(other=>Math.hypot(other.x-pt.x,other.y-pt.y)<44));if(group)group.push(pt);else groups.push([pt]);});
  positioned.forEach(item=>{const chosen=item.id===selected?.id,pin=document.createElement('button');pin.type='button';pin.className=`${s.mapPin} ${chosen?s.pinSelected:''}`;
   const title=`Operation ${item.operationId?.slice(0,8)} · ${item.vehicle} · last recorded position · ${item.provenance} · ${towerDate(item.observedAt)}`;
   pin.setAttribute('aria-label',title);pin.setAttribute('aria-pressed',String(chosen));pin.innerHTML=operationSvg;
   const group=groups.find(group=>group.some(p=>p.id===item.id));if(group&&group.length>1)pin.style.transform=`translateX(${(group.findIndex(p=>p.id===item.id)-(group.length-1)/2)*48}px)`;
   const marker=new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:item.position!,content:pin,title,zIndex:chosen?20:10});listeners.push(marker.addListener('click',()=>onSelect(item.id)));markers.current.push(marker);bounds.extend(item.position!);
   if(chosen){const label=document.createElement('div');label.className=s.mapLabel;label.textContent=`${item.vehicle} · ${item.provenance} · Last recorded`;pin.appendChild(label);}
  });
  if(showSites)sites.filter(site=>site.position!==null).forEach(site=>{const pin=document.createElement('div');pin.className=s.depotPin;pin.innerHTML=depotSvg;const title=site.name+' · '+(site.active?'Active':'Inactive')+' site · no vehicle presence implied';pin.setAttribute('aria-label',title);markers.current.push(new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:site.position!,content:pin,title,zIndex:5}));bounds.extend(site.position!);});
  if(!fit.current&&!bounds.isEmpty()){map.current.fitBounds(bounds,75);const current=map.current;google.maps.event.addListenerOnce(current,'idle',()=>{if(current.getZoom()!>14)current.setZoom(14);});fit.current=true;}
  return()=>{listeners.forEach(listener=>listener.remove());markers.current.forEach(marker=>marker.map=null);};
 },[ready,items,sites,selected?.id,onSelect,showSites,cameraTick]);
 // Draw only the provider's ordered points. No smoothing, geodesic shortcuts or endpoint connectors.
 useEffect(()=>{if(!ready||!map.current)return;const routes=roadAlternatives(road),selected=selectedRoad(road);
  const paths=routes.map(route=>new google.maps.Polyline({map:map.current,path:route.points,geodesic:false,strokeColor:route.id===selected?.id?'#345bea':'#8296ab',strokeOpacity:route.id===selected?.id?1:.45,strokeWeight:route.id===selected?.id?5:3,zIndex:route.id===selected?.id?3:1}));
  const stopPins=road?.pointEvidence?[road.pointEvidence.originStop,road.pointEvidence.destinationStop].map((stop,index)=>{const pin=document.createElement('div');pin.className=s.depotPin;pin.textContent=index===0?'A':'B';const title=`${index===0?'Requested pickup':'Requested delivery'} · ${stop.label} · access unverified`;pin.setAttribute('aria-label',title);return new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:{lat:stop.lat,lng:stop.lng},content:pin,title,zIndex:25});}):[];
  if(selected){const bounds=new google.maps.LatLngBounds();selected.points.forEach(point=>bounds.extend(point));stopPins.forEach(pin=>{if(pin.position)bounds.extend(pin.position as google.maps.LatLngLiteral);});map.current.fitBounds(bounds,65);fit.current=true;}
  return()=>{paths.forEach(path=>path.setMap(null));stopPins.forEach(pin=>pin.map=null);};
 },[ready,road]);
 const fitRecords=()=>{if(!map.current)return;const bounds=new google.maps.LatLngBounds();items.forEach(item=>{if(item.position)bounds.extend(item.position);});selectedRoad(road)?.points.forEach(point=>bounds.extend(point));if(showSites)sites.forEach(site=>{if(site.position)bounds.extend(site.position);});if(!bounds.isEmpty())map.current.fitBounds(bounds,60);};
 return <div className={s.mapSurface}><div className={s.googleMap} ref={host} role="region" aria-label="Google Maps · recorded operation positions and Carrier sites"/>
  {!ready?<div className={s.mapState} role={error?'alert':'status'}><MapPin size={27}/><strong>{error?'Map unavailable':'Loading Google Maps…'}</strong><p>{error||'The operation list remains available.'}</p>{error?<button onClick={()=>setRetry(n=>n+1)}><RefreshCw size={14}/>Retry Google Maps</button>:null}</div>:null}
  <div className={s.mapTools} aria-label="Map controls"><button disabled={!ready} aria-label="Zoom in" onClick={()=>map.current?.setZoom((map.current.getZoom()??2)+1)}><Plus size={19}/></button><button disabled={!ready} aria-label="Zoom out" onClick={()=>map.current?.setZoom((map.current.getZoom()??2)-1)}><Minus size={19}/></button><span/><button disabled={!ready} aria-label="Show planning route, recorded positions and sites" onClick={fitRecords}><MapPin size={18}/></button><button disabled={!ready||!selected?.position} aria-label="Focus last recorded operation position" onClick={()=>{if(selected?.position){map.current?.panTo(selected.position);map.current?.setZoom(10);}}}><Crosshair size={18}/></button><button disabled={!ready} aria-label="World overview" onClick={()=>{map.current?.setCenter({lat:10,lng:-40});map.current?.setZoom(2);}}><Globe2 size={18}/></button></div>
  <div className={s.mapLegend}><span className={s.legendDot}/>Recorded operation positions<span className={s.legendSite}/>Carrier sites · no live GPS{selectedRoad(road)?<><span className={s.legendLine}/>Google planning route</>:null}</div>
 </div>;
}
