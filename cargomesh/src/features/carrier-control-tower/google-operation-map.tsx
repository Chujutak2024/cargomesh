'use client';
import { useEffect,useRef,useState } from 'react';
import { Crosshair,Globe2,MapPin,Minus,Plus,RefreshCw } from 'lucide-react';
import { loadGoogleMaps,onGoogleMapsAuthFailure } from '@/features/v2-road-map/google-maps-loader';
import { depots,exceptions,type Shipment } from './demo-model';
import s from './tower.module.css';
type Props={items:Shipment[];selected:Shipment|null;onSelect:(id:string)=>void;showSites:boolean};
const truckSvg='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h14v14H1zM15 8h4l3 4v5h-7"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/></svg>';
const depotSvg='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 9 9-6 9 6v12H3zM8 21v-9h8v9M8 15h8M8 18h8"/></svg>';
export function GoogleOperationMap({items,selected,onSelect,showSites}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<google.maps.Map|null>(null),fit=useRef(false),markers=useRef<google.maps.marker.AdvancedMarkerElement[]>([]),paths=useRef<google.maps.Polyline[]>([]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[cameraTick,setCameraTick]=useState(0);
 useEffect(()=>{let cancelled=false;const listeners:google.maps.MapsEventListener[]=[];setReady(false);setError('');const off=onGoogleMapsAuthFailure(()=>{setReady(false);setError('Google Maps could not authorize this preview. The shipment list remains available.');});
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();
  if(!key){setError('Google Maps is not configured for this preview.');return off;}
  void loadGoogleMaps(key).then(async()=>{await google.maps.importLibrary('marker');if(cancelled||!host.current)return;
   map.current=new google.maps.Map(host.current,{center:{lat:-10.8,lng:-76.8},zoom:5,renderingType:google.maps.RenderingType.VECTOR,mapId:'DEMO_MAP_ID',disableDefaultUI:true,gestureHandling:'cooperative',clickableIcons:false,keyboardShortcuts:true});
   for(const event of ['zoom_changed','projection_changed'])listeners.push(map.current.addListener(event,()=>{if(!cancelled)setCameraTick(n=>n+1);}));fit.current=false;setReady(true);
  }).catch(()=>{if(!cancelled)setError('Google Maps is unavailable. You can still use the shipment list.');});
  const observer=new ResizeObserver(()=>{if(map.current)google.maps.event.trigger(map.current,'resize');});if(host.current)observer.observe(host.current);
  return()=>{cancelled=true;off();observer.disconnect();listeners.forEach(listener=>listener.remove());markers.current.forEach(m=>m.map=null);paths.current.forEach(p=>p.setMap(null));map.current=null;};
 },[retry]);
 useEffect(()=>{if(!ready||!map.current)return;markers.current.forEach(m=>m.map=null);paths.current.forEach(p=>p.setMap(null));markers.current=[];paths.current=[];
  const bounds=new google.maps.LatLngBounds();
  // Separate nearby symbols in screen space without changing any recorded coordinates.
  const projection=map.current.getProjection(),scale=2**(map.current.getZoom()??5);
  const groups:Array<Array<{id:string;x:number;y:number}>>=[];
  items.forEach(item=>{const p=projection?.fromLatLngToPoint(new google.maps.LatLng(item.position));const point={id:item.id,x:p?p.x*scale:item.position.lng*100,y:p?p.y*scale:item.position.lat*100};const group=groups.find(group=>group.some(other=>Math.hypot(other.x-point.x,other.y-point.y)<44));if(group)group.push(point);else groups.push([point]);});
  items.forEach(item=>{
   const chosen=item.id===selected?.id,alert=exceptions.some(e=>e.shipmentId===item.id),pin=document.createElement('button');pin.type='button';pin.className=`${s.mapPin} ${chosen?s.pinSelected:''}`;pin.setAttribute('aria-label',`${item.vehicle} · ${item.id} · ${item.status}${alert?' · Attention required':''}`);pin.setAttribute('aria-pressed',String(chosen));pin.innerHTML=truckSvg;
   const group=groups.find(group=>group.some(point=>point.id===item.id));if(group&&group.length>1)pin.style.transform=`translateX(${(group.findIndex(point=>point.id===item.id)-(group.length-1)/2)*48}px)`;
   if(alert){const dot=document.createElement('span');dot.className=s.pinAlert;dot.textContent='!';pin.appendChild(dot);}
   const marker=new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:item.position,content:pin,title:`${item.vehicle} · ${item.id}`,zIndex:chosen?20:10});
   marker.addListener('click',()=>onSelect(item.id));markers.current.push(marker);bounds.extend(item.position);
   if(chosen){const label=document.createElement('div');label.className=s.mapLabel;label.textContent=`${item.vehicle} · ${item.origin} → ${item.destination}`;pin.appendChild(label);}
   paths.current.push(new google.maps.Polyline({map:map.current!,path:item.route,strokeColor:chosen?'#345bea':'#8296ab',strokeOpacity:0,strokeWeight:chosen?3:1.5,icons:[{icon:{path:'M 0,-1 0,1',strokeOpacity:chosen?1:.45,scale:chosen?2:1},offset:'0',repeat:chosen?'12px':'9px'}],zIndex:chosen?3:1}));
  });
  if(showSites)depots.forEach(depot=>{const pin=document.createElement('div');pin.className=s.depotPin;pin.innerHTML=depotSvg;pin.setAttribute('aria-label',depot.name);markers.current.push(new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:depot.position,content:pin,title:depot.name,zIndex:5}));bounds.extend(depot.position);});
  if(!fit.current&&!bounds.isEmpty()){map.current.fitBounds(bounds,75);fit.current=true;}
  return()=>{markers.current.forEach(m=>m.map=null);paths.current.forEach(p=>p.setMap(null));};
 },[ready,items,selected?.id,onSelect,showSites,cameraTick]);
 const focus=()=>{if(map.current&&selected){map.current.panTo(selected.position);map.current.setZoom(8);}};
 const region=()=>{if(!map.current)return;const bounds=new google.maps.LatLngBounds();items.forEach(item=>item.route.forEach(point=>bounds.extend(point)));if(!bounds.isEmpty())map.current.fitBounds(bounds,60);};
 return <div className={s.mapSurface}>
  <div className={s.googleMap} ref={host} role="region" aria-label="Google Maps · simulated Carrier operation"/>
  {!ready?<div className={s.mapState} role={error?'alert':'status'}><MapPin size={27}/><strong>{error?'Map unavailable':'Loading Google Maps…'}</strong><p>{error||'Your shipment list is ready while the map loads.'}</p>{error?<button onClick={()=>setRetry(n=>n+1)}><RefreshCw size={14}/> Retry Google Maps</button>:null}</div>:null}
  <div className={s.mapTools} aria-label="Map controls"><button disabled={!ready} aria-label="Zoom in" onClick={()=>map.current?.setZoom((map.current.getZoom()??5)+1)}><Plus size={19}/></button><button disabled={!ready} aria-label="Zoom out" onClick={()=>map.current?.setZoom((map.current.getZoom()??5)-1)}><Minus size={19}/></button><span/><button disabled={!ready} aria-label="Show all demo routes" onClick={region}><MapPin size={18}/></button><button disabled={!ready||!selected} aria-label="Focus selected vehicle" onClick={focus}><Crosshair size={18}/></button><button disabled={!ready} aria-label="World overview" onClick={()=>{map.current?.setCenter({lat:10,lng:-40});map.current?.setZoom(2);}}><Globe2 size={18}/></button></div>
  <div className={s.mapLegend}><span className={s.legendDot}/> Sample vehicles <span className={s.legendSite}/> Demo hubs <span className={s.legendLine}/> Illustrative routes</div>
 </div>;
}
