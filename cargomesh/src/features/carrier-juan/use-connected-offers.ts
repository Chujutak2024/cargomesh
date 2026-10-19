"use client";
import {useEffect,useState} from 'react';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import {readOffersWorkspace,readPreparations} from './offers-client';
export function useConnectedOffers(carrier:CarrierPortalAccessV2,refreshToken:number){
 const [snapshot,setSnapshot]=useState<Awaited<ReturnType<typeof readOffersWorkspace>>|null>(null),[drafts,setDrafts]=useState<Awaited<ReturnType<typeof readPreparations>>|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[draftError,setDraftError]=useState(''),[revision,setRevision]=useState(0),[denied,setDenied]=useState(false);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setDraftError('');setDrafts(null);setDenied(false);
  const fail=(failure:unknown)=>{if(controller.signal.aborted)return;if(failure instanceof PortalApiError&&[401,403].includes(failure.status)){setSnapshot(null);setDrafts(null);setDenied(true);}setError(portalErrorCopy(failure,false));};
  void readOffersWorkspace(carrier.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted)setSnapshot(result);}).catch(fail).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  void readPreparations(carrier,controller.signal).then(result=>{if(!controller.signal.aborted)setDrafts(result);}).catch(failure=>{if(controller.signal.aborted)return;if(failure instanceof PortalApiError&&[401,403].includes(failure.status)){fail(failure);return;}setDraftError(failure instanceof PortalApiError&&failure.code==='OFFER_PREPARATIONS_NOT_INSTALLED'?'Persistent preparations are not installed in this environment. Local preparation stays in this tab only.':portalErrorCopy(failure,false));});
  return()=>controller.abort();
 },[carrier.carrierId,carrier.operatorId,refreshToken,revision]);
 return {current:!denied&&snapshot?.carrierId===carrier.carrierId?snapshot:null,drafts:denied?null:drafts,loading,error,draftError,denied,refresh:()=>setRevision(n=>n+1)};
}
