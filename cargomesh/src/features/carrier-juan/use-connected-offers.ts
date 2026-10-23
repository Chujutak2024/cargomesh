"use client";
import {useCarrierMemoryState} from "@/features/carrier-navigation/carrier-continuity";
import {useEffect,useState} from 'react';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import {readOffersWorkspace,readPreparations} from './offers-client';
export function useConnectedOffers(carrier:CarrierPortalAccessV2,refreshToken:number){
 const [snapshot,setSnapshot]=useCarrierMemoryState<Awaited<ReturnType<typeof readOffersWorkspace>>|null>('offers:read:'+carrier.operatorId+':'+carrier.carrierId,null),[drafts,setDrafts]=useCarrierMemoryState<Awaited<ReturnType<typeof readPreparations>>|null>('offers:preparations:'+carrier.operatorId+':'+carrier.carrierId,null);
 const [loading,setLoading]=useState(true),[preparationsLoading,setPreparationsLoading]=useState(true),[error,setError]=useState(''),[draftError,setDraftError]=useState(''),[revision,setRevision]=useState(0),[denied,setDenied]=useState(false);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setDraftError('');setPreparationsLoading(true);setDenied(false);
  const fail=(failure:unknown)=>{if(controller.signal.aborted)return;if(failure instanceof PortalApiError&&[401,403].includes(failure.status)){setSnapshot(null);setDrafts(null);setDenied(true);}setError(portalErrorCopy(failure,false));};
  void readOffersWorkspace(carrier.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted)setSnapshot(result);}).catch(fail).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  void readPreparations(carrier,controller.signal).then(result=>{if(!controller.signal.aborted)setDrafts(result);}).catch(failure=>{if(controller.signal.aborted)return;if(failure instanceof PortalApiError&&[401,403].includes(failure.status)){fail(failure);return;}setDraftError(failure instanceof PortalApiError&&failure.code==='OFFER_PREPARATIONS_NOT_INSTALLED'?'Persistent preparations are not installed in this environment. Local preparation stays in this tab only.':portalErrorCopy(failure,false));}).finally(()=>{if(!controller.signal.aborted)setPreparationsLoading(false);});
  return()=>controller.abort();
 },[carrier.carrierId,carrier.operatorId,refreshToken,revision]);
 return {current:!denied&&snapshot?.carrierId===carrier.carrierId?snapshot:null,drafts:denied?null:drafts,loading:loading||preparationsLoading,error,draftError,denied,refresh:()=>setRevision(n=>n+1)};
}
