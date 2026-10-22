"use client";
import {fleetEntry} from "./fleet-entry";
import {readSitesCatalog} from './sites-client';
import {useEffect,useState} from 'react';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readConnectedFleet} from '@/features/carrier-portal/connected-fleet-client';
import {connectedVehiclePresentation} from '@/features/carrier-portal/connected-fleet-presentation';
import {portalErrorCopy} from '@/features/carrier-portal/api';
import {recordData} from '@/features/carrier-portal/records';
import {fleetContext} from './connected-fleet-state';

export function useConnectedFleet(access:CarrierPortalAccessV2[],enabled:boolean,networkOnly=false){
 const [carrierId,setCarrierId]=useState(access.length===1?access[0].carrierId:''),[serviceId,setServiceId]=useState('');
 const [snapshot,setSnapshot]=useState<Awaited<ReturnType<typeof readConnectedFleet>>|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(networkOnly)return;
  const query=new URLSearchParams(window.location.search);
  const scenario=process.env.NODE_ENV==='development'&&['127.0.0.1','localhost'].includes(window.location.hostname)&&window.location.port==='8083';
  const entry=fleetEntry({scenario,requestedCarrier:query.get('carrier'),requestedService:null,carriers:access.map(row=>row.carrierId),services:[]});
  if(entry.carrier)setCarrierId(current=>current||entry.carrier);
 },[networkOnly,access]);
 const context=fleetContext(access,carrierId,serviceId,snapshot,networkOnly);
 useEffect(()=>{
  const controller=new AbortController();setSnapshot(null);setError('');
  if(!enabled||!access.some(row=>row.carrierId===carrierId)){setLoading(false);return()=>controller.abort();}
  setLoading(true);
  const read=networkOnly?readSitesCatalog(carrierId,controller.signal).then(network=>({...network,assets:[],drivers:[],regularDrivers:[],regularDriversUnavailable:true,operational:{'vehicle-assignments':[],'driver-assignments':[],executions:[],maintenances:[]},visualGaps:[],readAt:new Date().toISOString()})):readConnectedFleet(carrierId,controller.signal);
  void read.then(result=>{
   if(controller.signal.aborted)return;setSnapshot(result);
   const services=result.services.filter(row=>networkOnly||recordData(row).mode==='ROAD');
   const query=new URLSearchParams(window.location.search);
   const scenario=!networkOnly&&process.env.NODE_ENV==='development'&&['127.0.0.1','localhost'].includes(window.location.hostname)&&window.location.port==='8083';
   const entry=fleetEntry({scenario,requestedCarrier:null,requestedService:query.get('service'),carriers:[],services:services.map(row=>row.id)});
   setServiceId(previous=>services.some(row=>row.id===previous)?previous:entry.service||'');
  }).catch(failure=>{if(!controller.signal.aborted)setError(portalErrorCopy(failure,false));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[carrierId,enabled,revision,networkOnly]);
 return {...context,carrierId,serviceId,loading,error,vehicles:context.current?connectedVehiclePresentation(context.current,'',Date.parse(context.current.readAt)):[],
  setCarrierId:(id:string)=>{setCarrierId(id);setServiceId('');setSnapshot(null);},setServiceId,refresh:()=>setRevision(value=>value+1)};
}
