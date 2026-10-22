'use client';
import {displayReference} from '@/shared/lib/display-identity';
import {Component,useEffect,useRef,useState,type ReactNode} from 'react';
import {Crosshair,Globe2,MapPin,Minus,Plus,RefreshCw} from 'lucide-react';
import {googleMapsAuthFailed,loadGoogleMaps,onGoogleMapsAuthFailure} from '@/features/v2-road-map/google-maps-loader';
import {towerDate,type TowerItem,type TowerSite} from './tower-model';
import {roadAlternatives,selectedRoad,type RoadDisplay} from './road-plan-client';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {useLocale} from '@/features/i18n/locale-provider';
import s from './tower.module.css';
type Props={items:TowerItem[];sites:TowerSite[];selected:TowerItem|null;onSelect:(id:string)=>void;showSites:boolean;road?:RoadDisplay|null};
const operationSvg='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M1 3h14v14H1zM15 8h4l3 4v5h-7"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/></svg>';
const depotSvg='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 9 9-6 9 6v12H3zM8 21v-9h8v9M8 15h8M8 18h8"/></svg>';
const safely=(dispose:()=>void)=>{try{dispose();}catch{/* Provider cleanup must not hide the operation workspace. */}};
function framePoints(instance:google.maps.Map,points:Array<{lat:number;lng:number}>,padding:number){
 if(!points.length)return;
 const first=points[0];
 if(points.every(point=>point.lat===first.lat&&point.lng===first.lng)){instance.setCenter(first);instance.setZoom(12);return;}
 const bounds=new google.maps.LatLngBounds();points.forEach(point=>bounds.extend(point));instance.fitBounds(bounds,padding);
}
class OperationMapBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className={s.mapSurface}><div className={s.mapState} role="alert"><MapPin size={27}/><strong>Map unavailable</strong><p>The operation list remains available.</p><button type="button" onClick={()=>this.setState({failed:false})}>Retry map</button></div></div>:this.props.children;}
}
export function GoogleOperationMap(props:Props){return <OperationMapBoundary><OperationMap {...props}/></OperationMapBoundary>;}
export function OperationMap({items,sites,selected,onSelect,showSites,road=null}:Props){
 const {t}=useLocale(),locatedSites=sites.filter(site=>site.position!==null),unlocatedSites=sites.filter(site=>site.position===null);
 const host=useRef<HTMLDivElement>(null),map=useRef<google.maps.Map|null>(null),fit=useRef(false),markers=useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[cameraTick,setCameraTick]=useState(0);
 const attempt=useRef<{closed:boolean;fail:(message?:string)=>void}|null>(null);
 useEffect(()=>{const listeners:google.maps.MapsEventListener[]=[];setReady(false);setError('');let timeout:ReturnType<typeof setTimeout>|undefined;
  const current={closed:false,fail:(_message?:string)=>{}};attempt.current=current;
  const dispose=()=>{clearTimeout(timeout);listeners.splice(0).forEach(listener=>safely(()=>listener.remove()));markers.current.splice(0).forEach(marker=>safely(()=>{marker.map=null;}));if(map.current)safely(()=>google.maps.event.clearInstanceListeners(map.current!));map.current=null;};
  current.fail=(message='Google Maps is unavailable. Use the operation list.')=>{if(current.closed)return;current.closed=true;dispose();setReady(false);setError(message);};
  const off=onGoogleMapsAuthFailure(()=>current.fail('Google Maps authorization failed. The operation list remains available.'));
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();
  if(!key)current.fail('Google Maps is not configured. The operation list remains available.');
  else if(googleMapsAuthFailed())current.fail('Google Maps authorization failed. The operation list remains available.');
  else{
   timeout=setTimeout(()=>current.fail(),12000);
   void loadGoogleMaps(key).then(async()=>{
    if(current.closed||googleMapsAuthFailed())return;
    await google.maps.importLibrary('marker');
    if(current.closed||!host.current)return;
    if(googleMapsAuthFailed()){current.fail();return;}
    const instance=new google.maps.Map(host.current,{center:{lat:10,lng:-40},zoom:2,renderingType:google.maps.RenderingType.VECTOR,mapId:'DEMO_MAP_ID',disableDefaultUI:true,gestureHandling:'cooperative',clickableIcons:false,keyboardShortcuts:true});
    if(current.closed){safely(()=>google.maps.event.clearInstanceListeners(instance));return;}map.current=instance;
    for(const event of ['zoom_changed','projection_changed'])listeners.push(instance.addListener(event,()=>{if(!current.closed)setCameraTick(n=>n+1);}));fit.current=false;
    listeners.push(google.maps.event.addListenerOnce(instance,'tilesloaded',()=>{if(!current.closed&&!googleMapsAuthFailed()){clearTimeout(timeout);setReady(true);}}));
   }).catch(()=>current.fail());
  }
  const observer=new ResizeObserver(()=>{if(!current.closed&&map.current){try{google.maps.event.trigger(map.current,'resize');}catch{current.fail();}}});if(host.current)observer.observe(host.current);
  return()=>{current.closed=true;off();observer.disconnect();dispose();};
 },[retry]);
 useEffect(()=>{if(!ready||!map.current||attempt.current?.closed||googleMapsAuthFailed())return;const listeners:google.maps.MapsEventListener[]=[];
  try{markers.current.splice(0).forEach(marker=>safely(()=>{marker.map=null;}));
  const fittedPoints:Array<{lat:number;lng:number}>=[],projection=map.current.getProjection(),scale=2**(map.current.getZoom()??2);
  const positioned=items.filter(item=>item.position!==null),groups:Array<Array<{id:string;x:number;y:number}>>=[];
  positioned.forEach(item=>{const p=projection?.fromLatLngToPoint(new google.maps.LatLng(item.position!)),position=item.position!;const pt={id:item.id,x:p?p.x*scale:position.lng*100,y:p?p.y*scale:position.lat*100};const group=groups.find(group=>group.some(other=>Math.hypot(other.x-pt.x,other.y-pt.y)<44));if(group)group.push(pt);else groups.push([pt]);});
  positioned.forEach(item=>{const chosen=item.id===selected?.id,pin=document.createElement('button');pin.type='button';pin.className=`${s.mapPin} ${chosen?s.pinSelected:''}`;
   const title=`Operation ${displayReference(item.operationId,'OP')} · ${item.vehicle} · last recorded position · ${item.provenance} · ${towerDate(item.observedAt)}`;
   pin.setAttribute('aria-label',title);pin.setAttribute('aria-pressed',String(chosen));pin.innerHTML=operationSvg;
   const group=groups.find(group=>group.some(p=>p.id===item.id));if(group&&group.length>1)pin.style.transform=`translateX(${(group.findIndex(p=>p.id===item.id)-(group.length-1)/2)*48}px)`;
   const marker=new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:item.position!,content:pin,title,zIndex:chosen?20:10});listeners.push(marker.addListener('click',()=>onSelect(item.id)));markers.current.push(marker);fittedPoints.push(item.position!);
   if(chosen){const label=document.createElement('div');label.className=s.mapLabel;label.textContent=`${item.vehicle} · ${item.provenance} · Last recorded`;pin.appendChild(label);}
  });
  if(showSites)sites.filter(site=>site.position!==null).forEach(site=>{const pin=document.createElement('div');pin.className=s.depotPin;pin.innerHTML=depotSvg;const title=site.name+' · '+(site.active?'Active':'Inactive')+' site · no vehicle presence implied';pin.setAttribute('aria-label',title);markers.current.push(new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:site.position!,content:pin,title,zIndex:5}));fittedPoints.push(site.position!);});
  if(!fit.current&&fittedPoints.length){framePoints(map.current,fittedPoints,75);fit.current=true;}
  }catch{attempt.current?.fail();}
  return()=>{listeners.forEach(listener=>safely(()=>listener.remove()));markers.current.splice(0).forEach(marker=>safely(()=>{marker.map=null;}));};
 },[ready,items,sites,selected?.id,onSelect,showSites,cameraTick]);
 // Draw only the provider's ordered points. No smoothing, geodesic shortcuts or endpoint connectors.
 useEffect(()=>{if(!ready||!map.current||attempt.current?.closed||googleMapsAuthFailed())return;const routes=roadAlternatives(road),selected=selectedRoad(road),paths:google.maps.Polyline[]=[],stopPins:google.maps.marker.AdvancedMarkerElement[]=[];
  try{
  routes.forEach(route=>paths.push(new google.maps.Polyline({map:map.current,path:route.points,geodesic:false,strokeColor:route.id===selected?.id?'#345bea':'#8296ab',strokeOpacity:route.id===selected?.id?1:.45,strokeWeight:route.id===selected?.id?5:3,zIndex:route.id===selected?.id?3:1})));
  if(road?.pointEvidence)[road.pointEvidence.originStop,road.pointEvidence.destinationStop].forEach((stop,index)=>{const pin=document.createElement('div');pin.className=s.depotPin;pin.textContent=index===0?'A':'B';const title=`${index===0?'Requested pickup':'Requested delivery'} · ${stop.label} · access unverified`;pin.setAttribute('aria-label',title);stopPins.push(new google.maps.marker.AdvancedMarkerElement({map:map.current!,position:{lat:stop.lat,lng:stop.lng},content:pin,title,zIndex:25}));});
  if(selected){const bounds=new google.maps.LatLngBounds();selected.points.forEach(point=>bounds.extend(point));stopPins.forEach(pin=>{if(pin.position)bounds.extend(pin.position as google.maps.LatLngLiteral);});map.current.fitBounds(bounds,65);fit.current=true;}
  }catch{attempt.current?.fail();}
  return()=>{paths.forEach(path=>safely(()=>path.setMap(null)));stopPins.forEach(pin=>safely(()=>{pin.map=null;}));};
 },[ready,road]);
 const fitRecords=()=>{if(!map.current)return;const points:Array<{lat:number;lng:number}>=[];items.forEach(item=>{if(item.position)points.push(item.position);});selectedRoad(road)?.points.forEach(point=>points.push(point));if(showSites)sites.forEach(site=>{if(site.position)points.push(site.position);});framePoints(map.current,points,60);};
 const act=(action:(instance:google.maps.Map)=>void)=>{const instance=map.current;if(!ready||!instance||attempt.current?.closed)return;try{action(instance);}catch{attempt.current?.fail();}};
 return <div className={s.mapSurface}><div className={s.googleMap} ref={host} role="region" aria-label="Google Maps · recorded operation positions and Carrier sites"/>
  {!ready?<div className={s.mapState} role={error?'alert':'status'}><MapPin size={27}/><strong>{error?'Map unavailable':'Loading Google Maps…'}</strong><p>{error||'The operation list remains available.'}</p>{error?<button onClick={()=>googleMapsAuthFailed()?window.location.reload():setRetry(n=>n+1)}><RefreshCw size={14}/>Retry Google Maps</button>:null}</div>:null}
  <div className={s.mapTools} aria-label="Map controls"><button disabled={!ready} aria-label="Zoom in" onClick={()=>act(instance=>instance.setZoom((instance.getZoom()??2)+1))}><Plus size={19}/></button><button disabled={!ready} aria-label="Zoom out" onClick={()=>act(instance=>instance.setZoom((instance.getZoom()??2)-1))}><Minus size={19}/></button><span/><button disabled={!ready} aria-label="Show planning route, recorded positions and sites" onClick={()=>act(fitRecords)}><MapPin size={18}/></button><button disabled={!ready||!selected?.position} aria-label="Focus last recorded operation position" onClick={()=>act(instance=>{if(selected?.position){instance.panTo(selected.position);instance.setZoom(10);}})}><Crosshair size={18}/></button><button disabled={!ready} aria-label="World overview" onClick={()=>act(instance=>{instance.setCenter({lat:10,lng:-40});instance.setZoom(2);})}><Globe2 size={18}/></button></div>
  <div className={s.mapLegend}><span className={s.legendDot}/>{t('Posiciones registradas','Recorded positions')}{showSites?<><span className={s.legendSite}/><span>{t('Sedes','Sites')} · {locatedSites.length}/{sites.length} {t('en el mapa','mapped')}</span>{unlocatedSites.length?<CarrierLink href="/carriers/sites" title={unlocatedSites.map(site=>site.name).join(', ')}>{unlocatedSites.length} {t('sin coordenadas','without coordinates')}</CarrierLink>:null}</>:null}{selectedRoad(road)?<><span className={s.legendLine}/>Google planning route</>:null}</div>
 </div>;
}
