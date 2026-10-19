"use client";
import {useEffect,useRef,useState} from 'react';
import {portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readOrders} from './orders-client';
export function useConnectedOrders(carrier:CarrierPortalAccessV2,refreshToken=0,active=true){
 const loaded=useRef('');
 const [snapshot,setSnapshot]=useState<Awaited<ReturnType<typeof readOrders>>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const key=carrier.carrierId+':'+carrier.operatorId+':'+refreshToken+':'+revision;if(!active||loaded.current===key)return;const controller=new AbortController();setLoading(true);setError('');
  void readOrders(carrier.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted){loaded.current=key;setSnapshot(result);}}).catch(failure=>{if(!controller.signal.aborted){setError(portalErrorCopy(failure,false));if(failure instanceof PortalApiError&&[401,403].includes(failure.status))setSnapshot(null);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[carrier.carrierId,carrier.operatorId,refreshToken,revision,active]);
 return {snapshot:snapshot?.carrierId===carrier.carrierId?snapshot:null,loading,error,revision,refresh:()=>setRevision(n=>n+1)};
}
