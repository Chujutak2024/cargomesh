"use client";
import {ContentMotion} from "@/features/product-motion/content-motion";
import {CarrierSkeleton,CarrierUpdating} from "@/features/carrier-navigation/carrier-loading";
import {useCarrierMemoryState} from "@/features/carrier-navigation/carrier-continuity";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowLeft,ArrowRight,ChevronRight,CirclePlus,Clock3,Search,Tag,Users} from 'lucide-react';
import {Button,SearchField,Select} from '@/components/ui';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readCommercialDetail} from '@/features/carrier-portal/commercial-client';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
import {portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import {canPrepareOffer} from './offers-model';
import {CarrierKpis} from './carrier-kpis';
import {OpportunityListCard} from './opportunity-list-card';
import cards from './opportunity-list-card.module.css';
import {OpportunityRecord,OpportunityDeadline,OpportunityChecks,OpportunityTruck,shortRequestReference} from './opportunity-record';
import sheet from './opportunity-record.module.css';
import {readOpportunities} from './opportunity-client';
import {canRespondOpportunity,opportunityFacts,opportunityIdFromHash,opportunityLabel} from './opportunity-model';
import {OpportunityResponseForm} from './opportunity-response-form';
import {CarrierNova} from './carrier-nova';
import {navigateJuanHash,readJuanHash,subscribeJuanRoute} from './juan-navigation';
import p from './portal.module.css';
import filters from '@/features/carrier-portal/commercial-workspace.module.css';
import s from './local-request-directory.module.css';

export function ConnectedOpportunities({carrier,active=true,routeHash,refreshToken=0,onBusyChange,onSaved}:{carrier:CarrierPortalAccessV2;active?:boolean;routeHash?:string;refreshToken?:number;onBusyChange:(value:boolean)=>void;onSaved?:()=>void}){
 const liveHash=useSyncExternalStore(subscribeJuanRoute,readJuanHash,()=> '#/shipments'),hash=routeHash??liveHash,id=opportunityIdFromHash(hash),invalid=hash.startsWith('#/shipments/details/')&&!id;
 const [catalog,setCatalog]=useCarrierMemoryState<Awaited<ReturnType<typeof readOpportunities>>|null>('opportunities:read:'+carrier.operatorId+':'+carrier.carrierId,null),[detail,setDetail]=useState<Opportunity|null>(null),[error,setError]=useState(''),[detailError,setDetailError]=useState(''),[loadingDetail,setLoadingDetail]=useState(!!id);
 const [search,setSearch]=useCarrierMemoryState('opportunities:search:'+carrier.carrierId,''),[status,setStatus]=useCarrierMemoryState('opportunities:status:'+carrier.carrierId,'all'),[refresh,setRefresh]=useState(0),[refreshing,setRefreshing]=useState(true),[now,setNow]=useState(Date.now()),[response,setResponse]=useState<'ACCEPTED'|'DECLINED'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const heading=useRef<HTMLHeadingElement|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  const controller=new AbortController();setRefreshing(true);setError('');
  void readOpportunities(carrier.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted)setCatalog(result);}).catch(failure=>{if(!controller.signal.aborted){if(failure instanceof PortalApiError&&[401,403].includes(failure.status))setCatalog(null);setError(portalErrorCopy(failure,false));}}).finally(()=>{if(!controller.signal.aborted)setRefreshing(false);});
  return()=>controller.abort();
 },[carrier.carrierId,refreshToken,refresh]);
 useEffect(()=>{setMessage('');},[carrier.carrierId]);
 useEffect(()=>{
  const controller=new AbortController();setDetail(previous=>previous?.id===id&&previous.carrierId===carrier.carrierId?previous:null);setDetailError('');setResponse(null);setLoadingDetail(!!id);
  if(id)void readCommercialDetail(carrier.carrierId,'opportunities',id,controller.signal).then(row=>{if(!controller.signal.aborted)setDetail(row);}).catch(failure=>{if(!controller.signal.aborted)setDetailError(portalErrorCopy(failure,false));}).finally(()=>{if(!controller.signal.aborted)setLoadingDetail(false);});
  return()=>controller.abort();
 },[carrier.carrierId,id,refreshToken,refresh]);
 const current=catalog?.carrierId===carrier.carrierId?catalog:null,row=detail?.carrierId===carrier.carrierId&&detail.id===id?detail:!detailError?catalog?.rows.find(record=>record.id===id&&record.carrierId===carrier.carrierId)??null:null;
 useEffect(()=>{if(active&&row)heading.current?.focus({preventScroll:true});},[active,row]);
 const rows=current?.rows??[],query=search.trim().toLowerCase(),facts=row?opportunityFacts(row):null;
 const filtered=rows.filter(item=>{const f=opportunityFacts(item);return (status==='all'||item.status===status)&&[item.id,item.requestId,f.reference,f.origin,f.destination,f.description].join(' ').toLowerCase().includes(query);});
 const openCount=rows.filter(item=>['SENT','ACCEPTED'].includes(item.status)&&Date.parse(item.data.responseDeadline)>now).length;
 const allowed=!refreshing&&!loadingDetail&&!!current&&!current.partial&&!error&&!!row&&canRespondOpportunity(row,carrier.role,now);
 const setResponseBusy=(value:boolean)=>{setBusy(value);onBusyChange(value);};
 // Stable cleanup callback for forms; avoid aborting a request on ordinary parent rerenders.
 const busyCallback=useRef(setResponseBusy);busyCallback.current=setResponseBusy;
 const [changeBusy]=useState(()=>(value:boolean)=>busyCallback.current(value));
 useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
 const retry=()=>setRefresh(value=>value+1),back=()=>navigateJuanHash('#/shipments');
 return <ContentMotion className={s.directory} identity="opportunities-data" ready={id?!!row:!!current} animateOnChange={false} enabled={active&&!busy} label="Carrier opportunities">
  {message?<p role="status" className={p.notice}>{message}</p>:null}
  {error?<p role="alert" className={p.error}>{error} <button data-cm-action disabled={busy} onClick={retry}>Retry</button></p>:!current?<CarrierSkeleton shape={id?'detail':'cards'}/>:refreshing?<CarrierUpdating/>:null}
  {current?.partial?<p role="status" className={p.notice}>Partial opportunity list. Counts cover loaded records and response actions are disabled until the list is complete.</p>:null}
  {!id&&!invalid&&current?<CarrierKpis partial={current?.partial??false} metrics={[
   {id:'opportunities',label:'Opportunities',value:current?rows.length:null,tone:'blue',art:'opportunities'},
   {id:'response-windows',label:'Open response windows',value:current?openCount:null,tone:'teal',art:'response-window'},
   {id:'accepted',label:'Accepted for review',value:current?rows.filter(item=>item.status==='ACCEPTED').length:null,tone:'violet',art:'accepted'},
  ]}/>:null}
  {invalid?<section className={p.card}><p role="alert">Invalid opportunity reference. Local example IDs are not connected opportunities.</p><button data-cm-action onClick={back}>Back to opportunities</button></section>:id?<>
   <nav className={sheet.back} aria-label="Request breadcrumb"><button data-cm-action disabled={busy} onClick={back}><ArrowLeft size={14}/>Requests</button><ChevronRight size={13} aria-hidden="true"/><strong>{row?shortRequestReference(row):'Request detail'}</strong></nav>
   {loadingDetail&&!row?<CarrierSkeleton shape="detail"/>:detailError?<p role="alert">{detailError} <button data-cm-action disabled={busy} onClick={retry}>Refresh detail</button></p>:row&&facts?<div className={sheet.layout}>
    <OpportunityRecord row={row} headingRef={heading}/>
    <div className={sheet.sideColumn}><aside className={`${p.card} ${sheet.sideCard}`} aria-label="Carrier review response"><h2 className={sheet.sideTitle}><Users size={22} aria-hidden="true"/>Carrier response</h2><OpportunityDeadline value={row.data.responseDeadline}/>
     {Date.parse(row.data.responseDeadline)<=now?<p role="status">The response deadline has passed.</p>:null}
     {!allowed&&!busy?<p>Responses require an allowed Carrier role, a complete read, an open response window and a current opportunity state.</p>:null}
     <div className={sheet.actions}><Button variant="primary" className={sheet.acceptAction} disabled={!allowed||busy||row.status==='ACCEPTED'} onClick={()=>setResponse('ACCEPTED')}>Accept for review<ArrowRight size={16} aria-hidden="true"/></Button><Button variant="secondary" disabled={!allowed||busy} onClick={()=>setResponse('DECLINED')}>Decline</Button></div>
     {response&&(allowed||busy)?<OpportunityResponseForm key={row.id+row.version+response} carrier={carrier} row={row} response={response} allowed={allowed} onBusyChange={changeBusy} onClose={()=>setResponse(null)} onSaved={saved=>{setDetail(saved);setResponse(null);setMessage(opportunityLabel(saved.status)+' saved — revision '+saved.version);retry();onSaved?.();}}/>:null}
     <OpportunityChecks row={row}/></aside><section className={`${p.card} ${sheet.sideCard}`} aria-label="Offer preparation"><h2 className={sheet.sideTitle}><Tag size={22} aria-hidden="true"/>Offer preparation</h2><div className={`${sheet.actions} ${sheet.offerActions}`}>
      <Button variant="secondary" disabled={busy||loadingDetail||refreshing||!current||current.partial||!!error||!canPrepareOffer(row,carrier.role,now)} onClick={()=>navigateJuanHash('#/desk/prepare/'+row.id)} aria-label="Prepare offer" title="Prepare offer"><CirclePlus size={16} aria-hidden="true"/>Prepare</Button>
      <Button variant="secondary" disabled={busy} onClick={()=>navigateJuanHash('#/desk/opportunity/'+row.id)} aria-label="View offers and version history" title="View offers and version history"><Clock3 size={16} aria-hidden="true"/>Offer history</Button>
     </div></section>
    {process.env.NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW==='true'?<CarrierNova key={row.id+':'+row.version} carrierId={carrier.carrierId} opportunityId={row.id}/>:null}<OpportunityTruck/></div>
   </div>:null}
  </>:current?<>
   <div className={filters.directoryFilters}>
    <div className={filters.toolbar}><SearchField label="Search loaded records" value={search} onValueChange={setSearch} placeholder="Request, city or cargo…"/><Select label="Opportunity status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All</option>{[...new Set(rows.map(item=>item.status))].map(value=><option key={value} value={value}>{opportunityLabel(value)}</option>)}</Select></div>
    <small className={filters.filterCount} role="status">{filtered.length} of {rows.length} opportunities</small>
   </div>
   <div className={cards.grid}>{filtered.map(item=><OpportunityListCard key={item.id} row={item} busy={busy} onOpen={()=>navigateJuanHash('#/shipments/details/'+item.id)}/>)}</div>
   {!filtered.length?<section className={`${p.card} ${s.noResults}`}><Search size={24}/><h2>{rows.length?'No matches':'No opportunities received'}</h2><p>{rows.length?'Try another search or status.':'No local examples are substituted for an empty Carrier inbox.'}</p><button data-cm-action onClick={()=>{setSearch('');setStatus('all');}}>Clear filters</button></section>:null}
  </>:null}
 </ContentMotion>;
}
