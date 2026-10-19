'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {PortalApiError,portalErrorCopy} from '@/features/carrier-portal/api';
import {readTower,readTowerIncidents,type TowerIncident} from './tower-client';
import type {TowerSnapshot,TowerItem} from './tower-model';
export function useConnectedTower(carrierId:string|undefined,refresh:number){
 const [state,setState]=useState<{carrierId:string;snapshot:TowerSnapshot|null;error:string}>({carrierId:'',snapshot:null,error:''});
 const active=useRef<AbortController|null>(null);
 const invalidate=useCallback((error:string)=>{active.current?.abort();setState({carrierId:carrierId??'',snapshot:null,error});},[carrierId]);
 useEffect(()=>{if(!carrierId)return;const controller=new AbortController();active.current=controller;setState({carrierId,snapshot:null,error:''});
  void readTower(carrierId,controller.signal).then(snapshot=>{if(!controller.signal.aborted)setState({carrierId,snapshot,error:''});}).catch(error=>{if(!controller.signal.aborted)setState({carrierId,snapshot:null,error:portalErrorCopy(error,false)});});return()=>controller.abort();
 },[carrierId,refresh]);
 return {...(state.carrierId===carrierId?state:{carrierId:carrierId??'',snapshot:null,error:''}),invalidate};
}
export function useTowerIncidents(carrierId:string|undefined,item:TowerItem|null,refresh:number){
 const executionId=item?.operationId??null,requestId=item?.requestId??null,organizationId=item?.organizationId??null;
 const [state,setState]=useState<{scope:string;rows:TowerIncident[];error:string;partial:boolean;loading:boolean;denied:boolean}>({scope:'',rows:[],error:'',partial:false,loading:false,denied:false});
 const scope=[carrierId,executionId,requestId,organizationId].join(':');
 useEffect(()=>{if(!carrierId||!executionId)return;const controller=new AbortController();setState({scope,rows:[],error:'',partial:false,loading:true,denied:false});
  void readTowerIncidents(carrierId,{id:executionId,requestId,organizationId},controller.signal).then(result=>{if(!controller.signal.aborted)setState({scope,rows:result.rows,error:'',partial:result.partial,loading:false,denied:false});}).catch(error=>{if(!controller.signal.aborted)setState({scope,rows:[],error:portalErrorCopy(error,false),partial:true,loading:false,denied:error instanceof PortalApiError&&[401,403].includes(error.status)});});return()=>controller.abort();
 },[carrierId,executionId,requestId,organizationId,refresh,scope]);
 return state.scope===scope?state:{scope,rows:[],error:'',partial:false,loading:!!executionId,denied:false};
}
