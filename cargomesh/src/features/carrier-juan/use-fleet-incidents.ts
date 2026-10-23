"use client";
import {useEffect,useState} from 'react';
import {parseCommercialRecord} from '@/features/carrier-portal/commercial-model';
import type {PortalRecord} from '@/features/carrier-portal/records';
import {readIncidentCollection} from './incidents-client';

/** Count reported incidents only after the execution catalog is complete. */
export function useFleetIncidents(carrierId:string,executions:PortalRecord[]|undefined,complete:boolean,revision:string,enabled:boolean){
 const [state,setState]=useState<{carrierId:string;count:number|null}>({carrierId:'',count:null});
 useEffect(()=>{
  if(!enabled||!carrierId||!complete||!executions)return;
  const controller=new AbortController();
  async function read(){
   try{
    const rows=executions!.map(row=>parseCommercialRecord('executions',row,carrierId));
    const ids=new Set<string>();let partial=false;
    for(let offset=0;offset<rows.length;offset+=4){
     const results=await Promise.all(rows.slice(offset,offset+4).map(row=>readIncidentCollection(carrierId,row,controller.signal)));
     if(controller.signal.aborted)return;
     for(const result of results){partial ||= result.partial;for(const record of result.records)ids.add(record.id);}
    }
    if(!controller.signal.aborted)setState({carrierId,count:partial?null:ids.size});
   }catch{if(!controller.signal.aborted)setState({carrierId,count:null});}
  }
  void read();return()=>controller.abort();
 },[carrierId,complete,revision,enabled]);
 return enabled&&complete&&state.carrierId===carrierId?state.count:null;
}
