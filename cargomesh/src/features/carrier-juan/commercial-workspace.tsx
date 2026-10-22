"use client";
import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {ArrowLeft,Columns3,Files,List,Settings2} from 'lucide-react';
import {QuotePolicyPanel} from '@/features/carrier-portal/quote-policy-panel';
import {useLocale} from '@/features/i18n/locale-provider';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {ConnectedCommercialWorkspace,type PipelineViewState} from '@/features/carrier-portal/connected-commercial-workspace';
import {ConnectedOpportunities} from './connected-opportunities';
import {ConnectedOffers} from './connected-offers';
import {readJuanHash,subscribeJuanRoute,juanHref} from './juan-navigation';
import {commercialRoots,commercialTab,rememberCommercialRoute,type CommercialTab} from './commercial-navigation-model';
import s from './commercial-workspace.module.css';

/** The Carrier key belongs to the shell. A view change never remounts visited panels. */
export function CommercialWorkspace({carrier,initialHash,refreshToken,onBusyChange,initialBoardState,onBoardStateChange}:{
 carrier:CarrierPortalAccessV2;initialHash:string;refreshToken:number;onBusyChange:(busy:boolean)=>void;
 initialBoardState?:PipelineViewState;onBoardStateChange:(value:PipelineViewState)=>void;
}){
 const hash=useSyncExternalStore(subscribeJuanRoute,readJuanHash,()=>initialHash);
 const {t}=useLocale();
 const tab=commercialTab(hash)??'list';
 const [routes,setRoutes]=useState(()=>rememberCommercialRoute({...commercialRoots},initialHash));
 const [visited,setVisited]=useState<CommercialTab[]>([tab]);
 const [busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{setRoutes(previous=>rememberCommercialRoute(previous,hash));setVisited(previous=>previous.includes(tab)?previous:[...previous,tab]);},[hash,tab]);
 const changeBusy=useCallback((value:boolean)=>{setBusy(value);onBusyChange(value);},[onBusyChange]);
 const saved=useCallback(()=>setRevision(value=>value+1),[]);
 const tabs=[{id:'list',label:t('Lista','List'),Icon:List},{id:'board',label:t('Tablero','Board'),Icon:Columns3},{id:'offers',label:t('Ofertas','Offers'),Icon:Files},...(carrier.role==='ADMIN'?[{id:'automation',label:t('Automatización','Automation'),Icon:Settings2}]:[])] as const;
 return <div className={s.workspace}>
  {['#/shipments','#/pipeline','#/desk'].includes(hash)?<nav className={s.views} aria-label="Commercial views">{tabs.map(({id,label,Icon})=><CarrierLink key={id} href={juanHref(routes[id as CommercialTab])} aria-current={id===tab?'page':undefined} aria-disabled={busy||undefined} onClick={event=>{if(busy)event.preventDefault();}}><Icon size={17} aria-hidden="true"/>{label}</CarrierLink>)}</nav>:null}
  {tab==='automation'?<section aria-label={t('Automatización de ofertas','Quote automation')}><nav className={s.breadcrumb} aria-label="Breadcrumb"><CarrierLink href="/carriers/offers" aria-disabled={busy||undefined} onClick={event=>{if(busy)event.preventDefault();}}><ArrowLeft size={15}/>{t('Ofertas','Offers')}</CarrierLink><span>{t('Automatización','Automation')}</span></nav>{carrier.role==='ADMIN'?<QuotePolicyPanel carrier={carrier} expanded onBusyChange={changeBusy}/>:<p role="status">{t('Solo el administrador del Carrier puede configurar las políticas.','Only the Carrier administrator can configure policies.')}</p>}</section>:null}
  {(visited.includes('list')||tab==='list')?<section hidden={tab!=='list'} aria-label="Commercial request list"><ConnectedOpportunities carrier={carrier} active={tab==='list'} routeHash={tab==='list'?hash:routes.list} refreshToken={refreshToken+revision} onBusyChange={changeBusy} onSaved={saved}/></section>:null}
  {(visited.includes('board')||tab==='board')?<section hidden={tab!=='board'} aria-label="Commercial pipeline board"><ConnectedCommercialWorkspace carrier={carrier} active={tab==='board'} view="pipeline" refreshToken={refreshToken+revision} onBusyChange={changeBusy} initialViewState={initialBoardState} onViewStateChange={onBoardStateChange}/></section>:null}
  {(visited.includes('offers')||tab==='offers')?<section hidden={tab!=='offers'} aria-label="Commercial offers"><ConnectedOffers carrier={carrier} active={tab==='offers'} commercial routeHash={tab==='offers'?hash:routes.offers} refreshToken={refreshToken+revision} onBusyChange={changeBusy} onSaved={saved}/></section>:null}
 </div>;
}
