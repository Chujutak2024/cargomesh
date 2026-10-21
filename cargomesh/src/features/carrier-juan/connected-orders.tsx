"use client";
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AlertCircle,ArrowLeft,ArrowRight,CalendarDays,ClipboardCheck,List,Package} from 'lucide-react';
import {LocaleProvider} from '@/features/i18n/locale-provider';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {CommercialDirectory} from '@/features/carrier-portal/commercial-presentation';
import {bookingCard} from '@/features/carrier-portal/commercial-presentation-model';
import {stages,type Booking} from '@/features/carrier-portal/commercial-model';
import {DataValue} from '@/features/carrier-portal/contract-form';
import {portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import {SearchField,Select} from '@/components/ui';
import {useConnectedOrders} from './use-connected-orders';
import {readOrderDetail} from './orders-client';
import {orderSelectionFromHash,orderRelationships,capacitySummary,orderActionAllowed,bookingFromExecution,bookingFromHold,orderDates,sameOrderScope,type OrderAction,type ActionTarget} from './orders-model';
import {opportunityFacts} from './opportunity-model';
import {readJuanHash,subscribeJuanRoute,navigateJuanHash,juanHref} from './juan-navigation';
import {OrderActionForm,type SelectedOrderAction} from './order-action-form';
import {BookingConfirmationWindow} from '@/features/booking-confirmation/panel';
import {ReservationRecord,ExecutionRecord} from './order-records';
import {ConnectedIncidents} from './connected-incidents';
import {ordersTab} from './incidents-client';
import views from './commercial-workspace.module.css';
import r from './request-review.module.css';
import d from './local-request-directory.module.css';
import p from './portal.module.css';
import s from './operations.module.css';
type Props={carrier:CarrierPortalAccessV2;refreshToken?:number;initialBookingId?:string;embedded?:boolean;routeHash?:string;active?:boolean;onBusyChange:(busy:boolean)=>void;onSaved?:()=>void};
export function ConnectedOrders(props:Props){return <LocaleProvider locale="en">{props.embedded?<OrdersWorkspace key={props.carrier.operatorId+':'+props.carrier.carrierId} {...props}/>:<OrdersViews key={props.carrier.operatorId+':'+props.carrier.carrierId} {...props}/>}</LocaleProvider>;}
function OrdersViews(props:Props){
 const hash=useSyncExternalStore(subscribeJuanRoute,readJuanHash,()=> '#/tracking'),tab=ordersTab(hash);
 const [route,setRoute]=useState(tab==='orders'?hash:'#/tracking'),[visited,setVisited]=useState(tab==='orders'),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{if(tab==='orders'){setRoute(hash);setVisited(true);}},[hash,tab]);
 const changeBusy=useCallback((value:boolean)=>{setBusy(value);props.onBusyChange(value);},[props.onBusyChange]);
 const saved=useCallback(()=>{setRevision(value=>value+1);props.onSaved?.();},[props.onSaved]);
 return <div className={views.workspace}><nav className={views.views} aria-label="Orders views"><CarrierLink href={juanHref(route)} aria-current={tab==='orders'?'page':undefined} aria-disabled={busy||undefined} onClick={e=>{if(busy)e.preventDefault();}}><List size={17} aria-hidden="true"/>Orders</CarrierLink><CarrierLink href="/carriers/orders/incidents" aria-current={tab==='incidents'?'page':undefined} aria-disabled={busy||undefined} onClick={e=>{if(busy)e.preventDefault();}}><AlertCircle size={17} aria-hidden="true"/>Incidents</CarrierLink></nav>
 {(visited||tab==='orders')?<section hidden={tab!=='orders'}><OrdersWorkspace {...props} routeHash={tab==='orders'?hash:route} active={tab==='orders'} refreshToken={(props.refreshToken??0)+revision} onBusyChange={changeBusy} onSaved={saved}/></section>:null}
 <section hidden={tab!=='incidents'}><ConnectedIncidents carrier={props.carrier} active={tab==='incidents'} refreshToken={(props.refreshToken??0)+revision} onBusyChange={changeBusy} onSaved={saved}/></section></div>;
}
export function OrdersWorkspace({carrier,refreshToken=0,initialBookingId='',embedded=false,routeHash,active=true,onBusyChange,onSaved}:Props){
 const liveHash=useSyncExternalStore(subscribeJuanRoute,readJuanHash,()=> '#/tracking'),hash=routeHash??liveHash;
 const state=useConnectedOrders(carrier,refreshToken,active),[selection,setSelection]=useState(initialBookingId),[detail,setDetail]=useState<Booking|null>(null),[detailError,setDetailError]=useState(''),[detailLoading,setDetailLoading]=useState(false),[denied,setDenied]=useState(false);
 const [search,setSearch]=useState(''),[stage,setStage]=useState('All'),[busy,setBusy]=useState(false),[action,setAction]=useState<SelectedOrderAction|null>(null),[message,setMessage]=useState(''),[now,setNow]=useState(Date.now());
 const heading=useRef<HTMLHeadingElement>(null),scope=carrier.carrierId+':'+carrier.operatorId;
 useEffect(()=>{if(!embedded){setSelection(orderSelectionFromHash(hash)??'');setAction(null);}},[hash,embedded]);
 useEffect(()=>{if(embedded)setSelection(initialBookingId);},[embedded,initialBookingId]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
 useEffect(()=>()=>busyCallback.current(false),[]);
 useEffect(()=>{if(state.snapshot)setDenied(false);},[state.snapshot]);
 useEffect(()=>{const controller=new AbortController();setDetail(null);setDetailError('');setDetailLoading(!!selection);setAction(null);
  if(selection)void readOrderDetail(carrier.carrierId,selection,controller.signal).then(row=>{if(!controller.signal.aborted)setDetail(row);}).catch(failure=>{if(!controller.signal.aborted){setDetailError(portalErrorCopy(failure,false));if(failure instanceof PortalApiError&&[401,403].includes(failure.status))setDenied(true);}}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false);});return()=>controller.abort();
 },[scope,selection,state.snapshot?.readAt]);
 useEffect(()=>{if(detail)heading.current?.focus({preventScroll:true});},[detail]);
 const snapshot=denied?null:state.snapshot;
 const expected=state.snapshot?.bookings.find(b=>b.id===selection);
 const detailMismatch=!!detail&&!!expected&&!sameOrderScope(detail,expected);
 const row=detail?.id===selection&&detail.carrierId===carrier.carrierId&&!detailMismatch?detail:null;
 const current=snapshot&&row?{...snapshot,bookings:[row,...snapshot.bookings.filter(b=>b.id!==row.id)]}:snapshot;
 const relations=current&&row?orderRelationships(row,current):null,facts=relations?.opportunity?opportunityFacts(relations.opportunity):null;
 const ready=!!current&&!current.partial&&!state.loading&&!state.error&&!detailError&&!detailLoading&&!denied;
 const can=(name:OrderAction,target:ActionTarget)=>ready&&!!current&&orderActionAllowed(name,target,current,carrier.role,now);
 const changeBusy=(value:boolean)=>{setBusy(value);onBusyChange(value);};
 const begin=(name:OrderAction,target:ActionTarget)=>{if(!busy)setAction({action:name,row:target});};
 const refresh=()=>{if(busy)return;setAction(null);state.refresh();};
 const saved=()=>{setAction(null);setMessage('Action confirmed by the service. Reloading bookings, reservations, operations and references.');state.refresh();onSaved?.();};
 const rows=snapshot?.bookings.filter(b=>{const stageValue=orderRelationships(b,snapshot).stage;return (stage==='All'||stageValue===stage)&&[b.id,b.requestId,b.data.carrierReference].join(' ').toLowerCase().includes(search.trim().toLowerCase());})??[];
 const orphanExecutions=snapshot?.executions.filter(e=>!bookingFromExecution(e,snapshot))??[],orphanHolds=snapshot?.holds.filter(h=>!bookingFromHold(h,snapshot))??[];
 const commands={can,begin,busy};
 return <div className={d.directory} aria-label="Carrier Orders workspace">
 {!embedded?<p className={p.notice}>Orders are customer-authorized bookings. Carrier confirmation, capacity commitments and execution progress are separate facts.</p>:null}
 <div className={s.row}>{embedded?<button disabled={busy} onClick={refresh}>Refresh Orders</button>:null}{embedded?<CarrierLink href={'/carriers/orders'+(selection?'/details/'+selection:'')}>Open full Orders screen</CarrierLink>:null}<CarrierLink href="/carriers/pipeline">Back to Pipeline</CarrierLink></div>
 {message?<p role="status" className={p.notice}>{message}</p>:null}
 {state.error||denied?<p role="alert" className={p.error}>{denied?'Access could not be confirmed. Previous records and forms are hidden.':state.error}</p>:state.loading?<p role="status">Loading authorized Orders and resource references…</p>:null}
 {snapshot?.partial?<p className={p.notice} role="status">Partial read. Counts cover loaded records; actions requiring complete relationships are disabled. {snapshot.issues.join(' ')}</p>:null}
 {snapshot&&!denied?<>
 {!selection&&!embedded?<><SearchField label="Search loaded Orders" value={search} onValueChange={setSearch}/><CommercialDirectory title="Orders" cards={rows.map(b=>({...bookingCard(b,snapshot,now),status:orderRelationships(b,snapshot).stage}))} partial={snapshot.partial} busy={busy} onOpen={(_,id)=>navigateJuanHash('#/tracking/details/'+id)}><Select label="Derived order stage" value={stage} onChange={e=>setStage(e.target.value)}><option>All</option>{stages.map(value=><option key={value}>{value}</option>)}</Select></CommercialDirectory>
 <section className={p.card}><h3>From authorization to operation</h3><p>The Client authorizes the booking and requests temporary capacity through the shared workflow. Confirm the resulting reservations here, then assign the vehicle and driver in Fleet before starting the operation.</p></section></>:null}
 {detailMismatch?<p role="alert">Booking detail does not match the loaded Carrier, organization and request context. Refresh the records.</p>:null}
 {selection?<><div className={s.row}>{!embedded?<button disabled={busy} onClick={()=>navigateJuanHash('#/tracking')}><ArrowLeft size={16}/>All Orders</button>:null}<strong>{row?.data.carrierReference??'Order '+selection.slice(-8)}</strong></div>{detailLoading?<p role="status">Reading current booking and version…</p>:detailError?<p role="alert">{detailError} <button onClick={refresh}>Retry detail</button></p>:row&&relations&&current?<>
 <div className={r.layout}><section className={r.manifest} aria-label="Recorded order context"><header><span><ClipboardCheck size={18}/>Order and selected offer</span><strong>Revision {row.version}</strong></header><div className={r.route}><div><small>Origin</small><strong>{facts?.origin??'Unknown'}</strong></div><ArrowRight size={22}/><div><small>Destination</small><strong>{facts?.destination??'Unknown'}</strong></div></div><div className={r.cargo}><h3><Package size={18}/>{facts?.description??'Customer cargo projection unavailable'}</h3><div className={r.cargoMetrics}><div><small>Quoted price</small><strong>{relations.offer?'USD '+relations.offer.data.price.amount.toFixed(2):'Unknown'}</strong></div><div><small>Offer version</small><strong>{relations.offer?.data.offerVersion??'Unknown'}</strong></div></div>{relations.opportunity?<details><summary>Read-only customer cargo and requirements</summary><DataValue value={relations.opportunity.data.cargoSpecification} es={false}/></details>:null}</div><div className={r.schedule}><div><CalendarDays size={18}/><div><small>Customer pickup window</small><strong>{facts?.pickup?orderDates(facts.pickup.startsAt)+' — '+orderDates(facts.pickup.endsAt):'Not included in Carrier projection'}</strong></div></div><div><CalendarDays size={18}/><div><small>Customer delivery window</small><strong>{facts?.delivery?orderDates(facts.delivery.startsAt)+' — '+orderDates(facts.delivery.endsAt):'Not included in Carrier projection'}</strong></div></div></div><div className={p.card}>{relations.issues.map(issue=><p role="status" key={issue}>{issue}</p>)}<details><summary>Canonical order, offer, services and assignments</summary><DataValue value={{bookingId:row.id,requestId:row.requestId,organizationId:row.organizationId,decisionId:row.data.decisionId,selectedOfferId:row.data.offerId??null,planId:relations.offer?.data.planCandidateId??null,services:relations.offer?.data.coveredServiceIds??[],assignments:relations.offer?.data.coveredAssignmentIds??[],authorizationEvidence:row.data.authorizationEvidence}} es={false}/></details><div className={s.row}>{relations.opportunity?<CarrierLink href={'/carriers/requests/details/'+relations.opportunity.id}>Open source opportunity</CarrierLink>:null}{relations.offer?<CarrierLink href={'/carriers/offers/details/'+relations.offer.id}>Open selected offer</CarrierLink>:null}</div></div></section>
 <aside className={r.checklist}><BookingConfirmationWindow bookingId={row.id} carrierId={carrier.carrierId} canAct={ready&&!busy&&carrier.role!=="DISPATCHER"} onChanged={refresh}/><div className={r.checkHeading}><ClipboardCheck size={22}/><h2 ref={heading} tabIndex={-1}>{relations.stage}</h2></div><dl className={p.details}><div><dt>Customer authorization</dt><dd>{row.data.authorizationStatus}</dd></div><div><dt>Carrier confirmation</dt><dd>{row.data.carrierConfirmationStatus}</dd></div><div><dt>Capacity commitments</dt><dd>{capacitySummary(row,current,now).label}</dd></div><div><dt>Recorded operations</dt><dd>{relations.executions.length}{current.partial?'+':''}</dd></div></dl><p className={r.note}>A confirmed booking alone does not prove complete capacity or that transport has started.</p><div className={s.row}><button disabled={busy||!ready||!orderActionAllowed('bookings.confirm',row,current,carrier.role,now,'CONFIRMED')} onClick={()=>setAction({action:'bookings.confirm',row,confirmation:'CONFIRMED'})}>Confirm booking</button><button disabled={busy||!ready||!orderActionAllowed('bookings.confirm',row,current,carrier.role,now,'REJECTED')} onClick={()=>setAction({action:'bookings.confirm',row,confirmation:'REJECTED'})}>Reject booking</button><button disabled={busy||!can('bookings.cancel',row)} onClick={()=>begin('bookings.cancel',row)}>Cancel booking</button></div><p>Complete the evidence review before sending. The server rechecks current commitments, windows and role.</p></aside></div>
 <section className={p.card}><h3>Capacity reservations · {relations.referencedHolds.length}{current.partial?'+':''}</h3>{relations.referencedHolds.map(h=><ReservationRecord key={h.id} row={h} snapshot={current} commands={commands}/>)}{!relations.referencedHolds.length?<p>No reservations in this loaded booking scope. Capacity remains unconfirmed.</p>:null}</section>
 <section className={p.card}><h3>Recorded operations · {relations.linkedExecutions.length}{current.partial?'+':''}</h3>{relations.linkedExecutions.map(e=><ExecutionRecord key={e.id} row={e} snapshot={current} commands={commands} revision={state.revision+refreshToken} onDenied={()=>setDenied(true)}/>)}{!relations.linkedExecutions.length?<p>No operations in this loaded booking scope. A confirmed booking is not an execution.</p>:null}</section>
 {action?<OrderActionForm key={action.action+action.row.id+action.row.version+(action.confirmation??'')} carrier={carrier} selected={action} snapshot={current} enabled={ready} onSaved={saved} onDenied={()=>setDenied(true)} onClose={()=>setAction(null)} onBusyChange={changeBusy}/>:null}
 </>:null}</>:null}
 {!embedded&&!selection?<><h3>Records with incomplete booking relationships</h3>{orphanExecutions.map(e=><ExecutionRecord key={e.id} row={e} snapshot={snapshot} commands={commands} revision={state.revision+refreshToken} onDenied={()=>setDenied(true)}/>)}{orphanHolds.map(h=><ReservationRecord key={h.id} row={h} snapshot={snapshot} commands={commands}/>)}{!orphanExecutions.length&&!orphanHolds.length?<p>No orphaned records in this read.{snapshot.partial?' Other records may exist.':''}</p>:null}</>:null}
 </>:null}
 </div>;
}
