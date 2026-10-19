"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowLeft,ArrowRight,Clock3,Package,Search} from 'lucide-react';
import {SearchField,Select} from '@/components/ui';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readCommercialDetail} from '@/features/carrier-portal/commercial-client';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
import {portalErrorCopy} from '@/features/carrier-portal/api';
import {DataValue} from '@/features/carrier-portal/contract-form';
import {canPrepareOffer} from './offers-model';
import {CarrierKpis} from './carrier-kpis';
import {LogisticsTruck} from '@/features/logistics-3d/logistics-truck';
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
  <p className={p.notice}>Customer opportunities delivered to {carrier.carrierName}. Customer-owned details are read-only; responses belong to the Carrier.</p>
  {message?<p role="status" className={p.notice}>{message}</p>:null}
  {error?<p role="alert" className={p.error}>{error} <button disabled={busy} onClick={retry}>Retry</button></p>:!current?<p role="status">Loading authorized opportunities…</p>:null}
  {current?.partial?<p role="status" className={p.notice}>Partial opportunity list. Counts cover loaded records and response actions are disabled until the list is complete.</p>:null}
  <CarrierKpis partial={current?.partial??false} metrics={[
   {id:'opportunities',label:'Opportunities',value:current?rows.length:null,tone:'blue',art:'opportunities'},
   {id:'response-windows',label:'Open response windows',value:current?openCount:null,tone:'teal',art:'response-window'},
   {id:'accepted',label:'Accepted for review',value:current?rows.filter(item=>item.status==='ACCEPTED').length:null,tone:'violet',art:'accepted'},
  ]}/>
  {invalid?<section className={p.card}><p role="alert">Invalid opportunity reference. Local example IDs are not connected opportunities.</p><button onClick={back}>Back to opportunities</button></section>:id?<>
   <div className={s.detailHeading}><button disabled={busy} onClick={back}><ArrowLeft size={16}/>All opportunities</button><strong>{facts?.reference??'Opportunity detail'}</strong></div>
   {loadingDetail?<p role="status">Reading the current opportunity revision…</p>:detailError?<p role="alert">{detailError} <button disabled={busy} onClick={retry}>Refresh detail</button></p>:row&&facts?<div className={s.layout}>
    <section className={`${p.card} ${s.requestCard}`} aria-label="Read-only customer request"><div className={s.cardHeading}><div><span className={`${p.eyebrow} ${s.typeLabel}`}>Customer opportunity</span><h2 ref={heading} tabIndex={-1}>Request details</h2></div><span className={`${p.status} ${s.stateBadge}`}>{opportunityLabel(row.status)}</span></div>
     <div className={s.requestBody}><div className={s.cardRoute}><div><small>Origin</small><h3>{facts.origin}</h3></div><ArrowRight size={16}/><div><small>Destination</small><h3>{facts.destination}</h3></div></div>
      <div className={s.detailContext}><div className={s.detailCargo}><h3>Requested cargo</h3><p>{facts.description}</p><span><Package size={16}/>{facts.weightKg===null?'Weight not provided':facts.weightKg.toLocaleString('en-US')+' kg'}</span><p>{facts.volumeM3===null?'Volume not provided':facts.volumeM3.toLocaleString('en-US')+' m³'}</p></div><div className={s.truckVisual}><LogisticsTruck compact label="Illustrative reference truck" caption="Reference illustration — no assigned vehicle implied"/></div></div>
      <dl className={p.details}><div><dt>Requested pickup window</dt><dd>{facts.pickup?displayOpportunityDate(facts.pickup.startsAt)+' — '+displayOpportunityDate(facts.pickup.endsAt):'Not included in the Carrier projection'}</dd></div><div><dt>Requested delivery window</dt><dd>{facts.delivery?displayOpportunityDate(facts.delivery.startsAt)+' — '+displayOpportunityDate(facts.delivery.endsAt):'Not included in the Carrier projection'}</dd></div><div><dt>Response deadline</dt><dd>{displayOpportunityDate(row.data.responseDeadline)}</dd></div></dl>
      <h3>Recorded cargo and requirements</h3><DataValue value={row.data.cargoSpecification} es={false}/>
      <h3>Planned resource windows</h3>{facts.resourceWindows.length?facts.resourceWindows.map(item=><p key={item.id}>{displayOpportunityDate(item.window.startsAt)} — {displayOpportunityDate(item.window.endsAt)}</p>):<p>Resource windows not provided.</p>}<p className={p.notice}>Planned resource windows and the response deadline do not replace the customer's pickup and delivery windows.</p>
      <details><summary>Recorded legs, equipment and bindings</summary><DataValue value={row.data.assignmentSnapshots} es={false}/></details>
      <details><summary>Locations and record references</summary><DataValue value={{origin:row.data.origin,destination:row.data.destination,opportunityId:row.id,requestId:row.requestId,revision:row.version,responseChannel:row.data.responseChannel,sentAt:row.data.sentAt}} es={false}/></details>
     </div><footer className={s.cardFooter}><span><Clock3 size={14}/>Updated {displayOpportunityDate(row.updatedAt)} · revision {row.version}</span><button disabled={busy} onClick={retry}>Refresh opportunity</button></footer>
    </section>
    <aside className={`${p.card} ${s.reviewCard}`} aria-label="Carrier review response"><span className={p.eyebrow}>Carrier response</span><h2>Review this opportunity</h2><p>Confirm whether you will review the request. No quote, resource reservation or booking is created here.</p><p>Current status: {opportunityLabel(row.status)}.</p>
     {Date.parse(row.data.responseDeadline)<=now?<p role="status">The response deadline has passed.</p>:null}
     {!allowed&&!busy?<p>Responses require an allowed Carrier role, a complete read, an open response window and a current opportunity state.</p>:null}
     <div className={p.toolbar}><button disabled={!allowed||busy||row.status==='ACCEPTED'} onClick={()=>setResponse('ACCEPTED')}>Accept for review</button><button disabled={!allowed||busy} onClick={()=>setResponse('DECLINED')}>Decline</button></div>
     {response&&(allowed||busy)?<OpportunityResponseForm key={row.id+row.version+response} carrier={carrier} row={row} response={response} allowed={allowed} onBusyChange={changeBusy} onClose={()=>setResponse(null)} onSaved={saved=>{setDetail(saved);setResponse(null);setMessage(opportunityLabel(saved.status)+' saved — revision '+saved.version);retry();onSaved?.();}}/>:null}
     <h3>Offers</h3><div className={p.toolbar}>
      <button disabled={busy||!current||current.partial||!!error||!canPrepareOffer(row,carrier.role,now)} onClick={()=>navigateJuanHash('#/desk/prepare/'+row.id)}>Prepare offer</button>
      <button disabled={busy} onClick={()=>navigateJuanHash('#/desk/opportunity/'+row.id)}>View offers &amp; version history</button>
     </div>
    </aside>
   </div>:null}
  </>:current?<>
   <div className={filters.directoryFilters}>
    <div className={filters.toolbar}><SearchField label="Search loaded records" value={search} onValueChange={setSearch} placeholder="Request, city or cargo…"/><Select label="Opportunity status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All</option>{[...new Set(rows.map(item=>item.status))].map(value=><option key={value} value={value}>{opportunityLabel(value)}</option>)}</Select></div>
    <small className={filters.filterCount} role="status">{filtered.length} of {rows.length} opportunities</small>
   </div>
   <div className={s.requestGrid}>{filtered.map(item=>{const f=opportunityFacts(item);return <article key={item.id} className={s.directoryCard} aria-label={f.reference}><header><strong title={item.id}>{f.reference}</strong><span className={s.originBadge}>Customer opportunity</span></header><div className={s.cardRoute}><div><small>Origin</small><h3>{f.origin}</h3></div><ArrowRight size={16}/><div><small>Destination</small><h3>{f.destination}</h3></div></div><div className={s.cargoPreview}><div><Package size={15}/><p>{f.description}</p><small>Reference illustration · no vehicle assigned</small></div><img src="/v2-workspace/cargomesh-truck-poster.webp" width={120} height={78} alt="" loading="lazy"/></div><dl className={s.cardFacts}><div><dt>Total weight</dt><dd>{f.weightKg===null?'Not provided':f.weightKg.toLocaleString('en-US')+' kg'}</dd></div><div><dt>Respond by</dt><dd>{displayOpportunityDate(item.data.responseDeadline)}</dd></div></dl><div className={s.cardProgress}><span className={s.reviewState}>{opportunityLabel(item.status)}</span><small>{Date.parse(item.data.responseDeadline)<=now?'Response window closed':'Revision '+item.version}</small></div><footer><button disabled={busy} onClick={()=>navigateJuanHash('#/shipments/details/'+item.id)}>Open opportunity<ArrowRight size={15}/></button></footer></article>;})}</div>
   {!filtered.length?<section className={`${p.card} ${s.noResults}`}><Search size={24}/><h2>{rows.length?'No matches':'No opportunities received'}</h2><p>{rows.length?'Try another search or status.':'No local examples are substituted for an empty Carrier inbox.'}</p><button onClick={()=>{setSearch('');setStatus('all');}}>Clear filters</button></section>:null}
  </>:null}
 </div>;
}
