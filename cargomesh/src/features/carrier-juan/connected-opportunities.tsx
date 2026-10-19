"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,ChevronRight,CirclePlus,Clock3,Package,Search,Tag,Users} from 'lucide-react';
import {SearchField,Select} from '@/components/ui';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readCommercialDetail} from '@/features/carrier-portal/commercial-client';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
import {portalErrorCopy} from '@/features/carrier-portal/api';
import {canPrepareOffer} from './offers-model';
import {CarrierKpis} from './carrier-kpis';
import {OpportunityRecord,OpportunityChecks,OpportunityTruck,shortRequestReference} from './opportunity-record';
import sheet from './opportunity-record.module.css';
import {readOpportunities} from './opportunity-client';
import {canRespondOpportunity,opportunityFacts,opportunityIdFromHash,opportunityLabel,displayOpportunityDate} from './opportunity-model';
import {OpportunityResponseForm} from './opportunity-response-form';
import {navigateJuanHash,readJuanHash,subscribeJuanRoute} from './juan-navigation';
import p from './portal.module.css';
import filters from '@/features/carrier-portal/commercial-workspace.module.css';
import s from './local-request-directory.module.css';

export function ConnectedOpportunities({carrier,active=true,routeHash,refreshToken=0,onBusyChange,onSaved}:{carrier:CarrierPortalAccessV2;active?:boolean;routeHash?:string;refreshToken?:number;onBusyChange:(value:boolean)=>void;onSaved?:()=>void}){
 const liveHash=useSyncExternalStore(subscribeJuanRoute,readJuanHash,()=> '#/shipments'),hash=routeHash??liveHash,id=opportunityIdFromHash(hash),invalid=hash.startsWith('#/shipments/details/')&&!id;
 const [catalog,setCatalog]=useState<Awaited<ReturnType<typeof readOpportunities>>|null>(null),[detail,setDetail]=useState<Opportunity|null>(null),[error,setError]=useState(''),[detailError,setDetailError]=useState(''),[loadingDetail,setLoadingDetail]=useState(false);
 const [search,setSearch]=useState(''),[status,setStatus]=useState('all'),[refresh,setRefresh]=useState(0),[now,setNow]=useState(Date.now()),[response,setResponse]=useState<'ACCEPTED'|'DECLINED'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const heading=useRef<HTMLHeadingElement|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  const controller=new AbortController();setCatalog(null);setError('');
  void readOpportunities(carrier.carrierId,controller.signal).then(result=>{if(!controller.signal.aborted)setCatalog(result);}).catch(failure=>{if(!controller.signal.aborted)setError(portalErrorCopy(failure,false));});
  return()=>controller.abort();
 },[carrier.carrierId,refreshToken,refresh]);
 useEffect(()=>{setSearch('');setStatus('all');setMessage('');},[carrier.carrierId]);
 useEffect(()=>{
  const controller=new AbortController();setDetail(null);setDetailError('');setResponse(null);setLoadingDetail(!!id);
  if(id)void readCommercialDetail(carrier.carrierId,'opportunities',id,controller.signal).then(row=>{if(!controller.signal.aborted)setDetail(row);}).catch(failure=>{if(!controller.signal.aborted)setDetailError(portalErrorCopy(failure,false));}).finally(()=>{if(!controller.signal.aborted)setLoadingDetail(false);});
  return()=>controller.abort();
 },[carrier.carrierId,id,refreshToken,refresh]);
 const current=catalog?.carrierId===carrier.carrierId?catalog:null,row=detail?.carrierId===carrier.carrierId&&detail.id===id?detail:null;
 useEffect(()=>{if(active&&row)heading.current?.focus({preventScroll:true});},[active,row]);
 const rows=current?.rows??[],query=search.trim().toLowerCase(),facts=row?opportunityFacts(row):null;
 const filtered=rows.filter(item=>{const f=opportunityFacts(item);return (status==='all'||item.status===status)&&[item.id,item.requestId,f.origin,f.destination,f.description].join(' ').toLowerCase().includes(query);});
 const openCount=rows.filter(item=>['SENT','ACCEPTED'].includes(item.status)&&Date.parse(item.data.responseDeadline)>now).length;
 const allowed=!!current&&!current.partial&&!error&&!!row&&canRespondOpportunity(row,carrier.role,now);
 const setResponseBusy=(value:boolean)=>{setBusy(value);onBusyChange(value);};
 // Stable cleanup callback for forms; avoid aborting a request on ordinary parent rerenders.
 const busyCallback=useRef(setResponseBusy);busyCallback.current=setResponseBusy;
 const [changeBusy]=useState(()=>(value:boolean)=>busyCallback.current(value));
 useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
 const retry=()=>setRefresh(value=>value+1),back=()=>navigateJuanHash('#/shipments');
 return <div className={s.directory} aria-label="Carrier opportunities">
  {!id&&!invalid?<p className={p.notice}>Customer opportunities delivered to {carrier.carrierName}. Customer-owned details are read-only; responses belong to the Carrier.</p>:null}
  {message?<p role="status" className={p.notice}>{message}</p>:null}
  {error?<p role="alert" className={p.error}>{error} <button disabled={busy} onClick={retry}>Retry</button></p>:!current?<p role="status">Loading authorized opportunities…</p>:null}
  {current?.partial?<p role="status" className={p.notice}>Partial opportunity list. Counts cover loaded records and response actions are disabled until the list is complete.</p>:null}
  {!id&&!invalid?<CarrierKpis partial={current?.partial??false} metrics={[
   {id:'opportunities',label:'Opportunities',value:current?rows.length:null,tone:'blue',art:'opportunities'},
   {id:'response-windows',label:'Open response windows',value:current?openCount:null,tone:'teal',art:'response-window'},
   {id:'accepted',label:'Accepted for review',value:current?rows.filter(item=>item.status==='ACCEPTED').length:null,tone:'violet',art:'accepted'},
  ]}/>:null}
  {invalid?<section className={p.card}><p role="alert">Invalid opportunity reference. Local example IDs are not connected opportunities.</p><button onClick={back}>Back to opportunities</button></section>:id?<>
   <nav className={sheet.back} aria-label="Request breadcrumb"><button disabled={busy} onClick={back}><ArrowLeft size={14}/>Requests</button><ChevronRight size={13} aria-hidden="true"/><strong>{row?shortRequestReference(row):'Request detail'}</strong></nav>
   {loadingDetail?<p role="status">Reading the current opportunity revision…</p>:detailError?<p role="alert">{detailError} <button disabled={busy} onClick={retry}>Refresh detail</button></p>:row&&facts?<div className={sheet.layout}>
    <OpportunityRecord row={row} headingRef={heading} busy={busy} onRefresh={retry}/>
    <div className={sheet.sideColumn}><aside className={`${p.card} ${sheet.response}`} aria-label="Carrier review response"><h2 className={sheet.responseTitle}><Users size={18} aria-hidden="true"/>Carrier response</h2><section className={sheet.responseSection}><h3><CalendarDays size={18} aria-hidden="true"/>Review request</h3><p>Accept to start reviewing, or decline. This does not quote or reserve a vehicle.</p><p className={sheet.deadline}><strong>Respond by</strong><br/>{displayOpportunityDate(row.data.responseDeadline)}</p>
     {Date.parse(row.data.responseDeadline)<=now?<p role="status">The response deadline has passed.</p>:null}
     {!allowed&&!busy?<p>Responses require an allowed Carrier role, a complete read, an open response window and a current opportunity state.</p>:null}
     <div className={sheet.actions}><button className={p.primary} disabled={!allowed||busy||row.status==='ACCEPTED'} onClick={()=>setResponse('ACCEPTED')}>Accept for review<ArrowRight size={16} aria-hidden="true"/></button><button disabled={!allowed||busy} onClick={()=>setResponse('DECLINED')}>Decline</button></div>
     {response&&(allowed||busy)?<OpportunityResponseForm key={row.id+row.version+response} carrier={carrier} row={row} response={response} allowed={allowed} onBusyChange={changeBusy} onClose={()=>setResponse(null)} onSaved={saved=>{setDetail(saved);setResponse(null);setMessage(opportunityLabel(saved.status)+' saved — revision '+saved.version);retry();onSaved?.();}}/>:null}
     <OpportunityChecks row={row}/></section><section className={sheet.responseSection}><h3><Tag size={18} aria-hidden="true"/>Offer preparation</h3><div className={sheet.actions}>
      <button disabled={busy||!current||current.partial||!!error||!canPrepareOffer(row,carrier.role,now)} onClick={()=>navigateJuanHash('#/desk/prepare/'+row.id)}><CirclePlus size={17} aria-hidden="true"/>Prepare offer</button>
      <button disabled={busy} onClick={()=>navigateJuanHash('#/desk/opportunity/'+row.id)}><Clock3 size={17} aria-hidden="true"/>View offers &amp; version history</button>
     </div></section>
    </aside><OpportunityTruck/></div>
   </div>:null}
  </>:current?<>
   <div className={filters.directoryFilters}>
    <div className={filters.toolbar}><SearchField label="Search loaded records" value={search} onValueChange={setSearch} placeholder="Request, city or cargo…"/><Select label="Opportunity status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All</option>{[...new Set(rows.map(item=>item.status))].map(value=><option key={value} value={value}>{opportunityLabel(value)}</option>)}</Select></div>
    <small className={filters.filterCount} role="status">{filtered.length} of {rows.length} opportunities</small>
   </div>
   <div className={s.requestGrid}>{filtered.map(item=>{const f=opportunityFacts(item);return <article key={item.id} className={s.directoryCard} aria-label={f.reference}><header><strong title={f.reference}>{shortRequestReference(item)}</strong><span className={s.originBadge}>Customer opportunity</span></header><div className={s.cardRoute}><div><small>Origin</small><h3>{f.origin}</h3></div><ArrowRight size={16}/><div><small>Destination</small><h3>{f.destination}</h3></div></div><div className={s.cargoPreview}><div><Package size={15}/><p>{f.description}</p><small>Reference illustration · no vehicle assigned</small></div><img src="/v2-workspace/cargomesh-truck-poster.webp" width={120} height={78} alt="" loading="lazy"/></div><dl className={s.cardFacts}><div><dt>Total weight</dt><dd>{f.weightKg===null?'Not provided':f.weightKg.toLocaleString('en-US')+' kg'}</dd></div><div><dt>Respond by</dt><dd>{displayOpportunityDate(item.data.responseDeadline)}</dd></div><div><dt>Requested delivery</dt><dd>{f.delivery?displayOpportunityDate(f.delivery.endsAt):'Not provided'}</dd></div></dl><div className={s.cardProgress}><span className={s.reviewState}>{opportunityLabel(item.status)}</span><small>{Date.parse(item.data.responseDeadline)<=now?'Response window closed':'Revision '+item.version}</small></div><footer><button disabled={busy} onClick={()=>navigateJuanHash('#/shipments/details/'+item.id)}>Open opportunity<ArrowRight size={15}/></button></footer></article>;})}</div>
   {!filtered.length?<section className={`${p.card} ${s.noResults}`}><Search size={24}/><h2>{rows.length?'No matches':'No opportunities received'}</h2><p>{rows.length?'Try another search or status.':'No local examples are substituted for an empty Carrier inbox.'}</p><button onClick={()=>{setSearch('');setStatus('all');}}>Clear filters</button></section>:null}
  </>:null}
 </div>;
}
