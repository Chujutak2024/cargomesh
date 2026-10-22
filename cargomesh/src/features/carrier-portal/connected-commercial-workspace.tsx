"use client";
import {displayReference} from "@/shared/lib/display-identity";
import {OperatingCostCalculation} from './operating-cost-calculation';
import {PipelineConnections} from '@/features/carrier-juan/pipeline-connections';
import {PipelineBoard} from './pipeline-board';
import {CommercialOverview,CommercialDirectory,CommercialRecordFrame} from './commercial-presentation';
import {opportunityCard,offerCard,bookingCard} from './commercial-presentation-model';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {useEffect,useRef,useState} from 'react';
import {Button,Dialog,SearchField,Select} from '@/components/ui';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {DataValue} from './contract-form';
import {portalErrorCopy,PortalApiError} from './api';
import {canCarrierAction} from './permissions';
import {readCommercial,readCommercialDetail} from './commercial-client';
import {readFleetResource} from './fleet-client';
import {parseCommercialRecord} from './commercial-model';
import {NovaVoicePreview} from '@/features/v2-conversation-prep/nova-voice-preview';
import {carrierVoicePrice} from './carrier-voice-price';
import {acceptsSuggestedPrice,carrierEstimateBasis,carrierPriceEstimate} from './carrier-price-estimate';
import {CommercialActionForm,type CommercialAction} from './commercial-action-form';
import {bookingOffer,bookingExecutions,orderStage,opportunityOffers,pendingCarrierOpportunities,pipelineItems,stages,offerState,routeLabel,offerContext,type CommercialSnapshot,type Opportunity,type Offer,type Booking} from './commercial-model';
import s from './commercial-workspace.module.css';
import {QuotePolicyPanel} from './quote-policy-panel';
import {BookingConfirmationWindow} from '@/features/booking-confirmation/panel';
type View='dashboard'|'shipments'|'desk'|'orders'|'pipeline'|'tracking';
type Selection={kind:'opportunities'|'offers'|'bookings';id:string};
const date=(value:string|null)=>value?new Date(value).toLocaleString('en-US',{timeZone:'UTC'})+' UTC':'Not recorded';
const short=(id:string|null)=>id? id.slice(0,8).toUpperCase():'Not recorded';
const money=(f:Offer)=>new Intl.NumberFormat('en-US',{style:'currency',currency:f.data.price.currency}).format(f.data.price.amount);
export type PipelineViewState={search:string;filter:string;selection:Selection|null};
type Props={carrier:CarrierPortalAccessV2;view:View;active?:boolean;refreshToken?:number;onBusyChange?:(busy:boolean)=>void;initialViewState?:PipelineViewState;onViewStateChange?:(state:PipelineViewState)=>void};
export function ConnectedCommercialWorkspace(props:Props){return <CommercialWorkspace key={props.carrier.operatorId+':'+props.carrier.carrierId} {...props}/>;}
function CommercialWorkspace({carrier,view,active=true,refreshToken=0,onBusyChange,initialViewState,onViewStateChange}:Props){
 const [snapshot,setSnapshot]=useState<CommercialSnapshot|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[search,setSearch]=useState(initialViewState?.search??''),[filter,setFilter]=useState(initialViewState?.filter??'All');
 const [featuredId,setFeaturedId]=useState('');
 const [selection,setSelection]=useState<Selection|null>(initialViewState?.selection??null),[detail,setDetail]=useState<Opportunity|Offer|Booking|null>(null),[detailError,setDetailError]=useState('');
 const [busy,setBusy]=useState(false);const detailPanel=useRef<HTMLElement|null>(null);
 const [action,setAction]=useState<CommercialAction|null>(null),[selectedAssignments,setSelectedAssignments]=useState<string[]>([]),[now,setNow]=useState(Date.now());
 const [voiceTurns,setVoiceTurns]=useState<{id:string;role:string;text:string}[]>([]);
 const [spokenAmount,setSpokenAmount]=useState<number|null>(null);
 const [ratePerKm,setRatePerKm]=useState('');
 const [useEstimate,setUseEstimate]=useState(false);
 const [autoVoiceOpportunityId,setAutoVoiceOpportunityId]=useState<string|null>(null);
 const stateCallback=useRef(onViewStateChange);stateCallback.current=onViewStateChange;
 useEffect(()=>{if(view==='pipeline')stateCallback.current?.({search,filter,selection});},[view,search,filter,selection]);
 useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
 useEffect(()=>()=>onBusyChange?.(false),[onBusyChange]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const controller=new AbortController();setSnapshot(null);setError('');setDetail(null);setAction(null);setDetailError('');
  void readCommercial(carrier.carrierId,controller.signal).then(value=>{if(!controller.signal.aborted)setSnapshot(value);}).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});return()=>controller.abort();
 },[carrier.carrierId,carrier.operatorId,refresh,refreshToken]);
 useEffect(()=>{const controller=new AbortController();setDetail(null);setAction(null);setDetailError('');setSelectedAssignments([]);setVoiceTurns([]);setSpokenAmount(null);setRatePerKm('');setUseEstimate(false);
  if(selection&&snapshot&&!(view==='pipeline'&&selection.kind==='bookings'))void readCommercialDetail(carrier.carrierId,selection.kind,selection.id,controller.signal).then(row=>{if(!controller.signal.aborted){setDetail(row);if(row.kind==='opportunities')setSelectedAssignments(row.data.assignmentIds);}}).catch(e=>{if(!controller.signal.aborted){setDetailError(portalErrorCopy(e,false));if(e instanceof PortalApiError&&[401,403].includes(e.status))setSnapshot(null);}});return()=>controller.abort();
 },[carrier.carrierId,carrier.operatorId,selection,!!snapshot,refresh,refreshToken,view]);
 useEffect(()=>{if(!snapshot||!active||busy)return;let live=true,inFlight=false;const controller=new AbortController();
  const timer=setInterval(()=>{if(!live||inFlight||document.visibilityState!=='visible')return;
   inFlight=true;
   // Replace the whole commercial snapshot together; never combine a fresh opportunity with stale booking state.
   void readCommercial(carrier.carrierId,controller.signal).then(value=>{
    if(live&&!controller.signal.aborted)setSnapshot(value);
   }).catch(()=>{/* Keep the last known snapshot; manual refresh reports errors. */}).finally(()=>{inFlight=false;});
  },30000);return()=>{live=false;controller.abort();clearInterval(timer);};
 },[carrier.carrierId,carrier.operatorId,!!snapshot,active,busy]);
 useEffect(()=>{if(active&&detail){detailPanel.current?.focus({preventScroll:true});detailPanel.current?.scrollIntoView({block:'start',behavior:'auto'});}},[detail,active]);
 useEffect(()=>{if(view==='pipeline')return;setSelection(null);setDetail(null);setAction(null);setSearch('');setFilter('All');},[view]);
 const matches=(text:string)=>text.toLowerCase().includes(search.trim().toLowerCase());
 const opportunities=snapshot?.opportunities.filter(o=>matches(routeLabel(o)+' '+o.id+' '+displayReference(null,'PED',o.requestId)+' '+o.data.cargoSpecification.categoryCode))??[];
 const offers=snapshot?.offers.filter(f=>matches(f.data.carrierReference+' '+f.id))??[];
 const orders=snapshot?.bookings.filter(b=>matches((b.data.carrierReference??'')+' '+b.id+' '+(b.requestId??''))&&(filter==='All'||orderStage(b,snapshot)===filter))??[];
 const pipeline=snapshot?pipelineItems(snapshot,now).filter(p=>opportunities.some(o=>o.id===p.opportunity.id)&&(filter==='All'||p.stage===filter)):[];
 const pending=snapshot?pendingCarrierOpportunities(snapshot,now):[];
 const open=(kind:Selection['kind'],id:string,autoVoice=false)=>{if(busy)return;setSelection({kind,id});setAction(null);setAutoVoiceOpportunityId(autoVoice&&kind==='opportunities'?id:null);};
 const allowed=(name:string,status:string)=>!busy&&!!snapshot&&!snapshot.partial&&canCarrierAction(carrier.role,name,status);
 function beginOffer(o:Opportunity,old:Offer|null=null,voicePrice?:number,estimated=false){if(busy)return;const ids=old?.data.coveredAssignmentIds??selectedAssignments;try{const issuedAt=new Date().toISOString();offerContext(o,ids,old,issuedAt);const basis=estimated?carrierEstimateBasis(o,ids):null;setAction({kind:'offer',row:o,assignmentIds:ids,supersedes:old,issuedAt,voicePrice,estimateBasis:basis?{...basis,usdPerKm:Number(ratePerKm)}:undefined});setDetailError('');}catch{setDetailError('Select recorded assignments with complete service references.');}}
 const estimateBasis=detail?.kind==='opportunities'?carrierEstimateBasis(detail,selectedAssignments):null;
 const estimatedAmount=estimateBasis?carrierPriceEstimate(estimateBasis.distanceKm,Number(ratePerKm)):null;
 function saved(){setBusy(false);setAction(null);setRefresh(n=>n+1);}
 return <div className={s.workspace}>
 {view==='desk'&&carrier.role==='ADMIN'?<QuotePolicyPanel key={carrier.carrierId} carrier={carrier}/>:null}
 <div className={s.toolbar}><SearchField label="Search loaded records" value={search} onValueChange={setSearch}/>{view!=='pipeline'?<Button variant="secondary" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh</Button>:null}{view==='pipeline'?<Select label="Pipeline stage" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{stages.map(stage=><option key={stage}>{stage}</option>)}</Select>:null}{view!=='pipeline'&&snapshot?<small>Updated {date(snapshot.readAt)}</small>:null}</div>
 {error?<p role="alert">{error}</p>:!snapshot?<p role="status">Loading authorized opportunities, offers, bookings and operations…</p>:<>
 {snapshot.partial?<p role="status" className={s.notice}>Partial read. Counts cover loaded records; commercial actions are disabled. Missing relationships remain unconfirmed.</p>:null}
 {pending.length?<section className={s.notice} role="status" aria-label="New freight opportunities"><strong>{pending.length} freight {pending.length===1?'opportunity needs':'opportunities need'} your review.</strong> <Button variant="secondary" onClick={()=>open('opportunities',pending[0].id,true)}>Hear and review newest request</Button></section>:null}

 {view==='dashboard'?<CommercialOverview snapshot={snapshot} featuredId={featuredId} onSelect={setFeaturedId} onOpen={open} busy={busy} now={now}/>:null}
 {view==='pipeline'?<><PipelineBoard items={pipeline} busy={busy} partial={snapshot.partial} now={now} onOpen={open}/></>:null}
 {view==='orders'||view==='tracking'?<><CommercialDirectory title="Orders" cards={orders.map(b=>bookingCard(b,snapshot,now))} partial={snapshot.partial} busy={busy} onOpen={open}><Select label="Order stage" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{stages.map(stage=><option key={stage}>{stage}</option>)}</Select></CommercialDirectory>
 {snapshot.executions.filter(e=>!snapshot.bookings.some(b=>b.id===e.data.bookingId&&b.requestId===e.requestId&&b.organizationId===e.organizationId)).map(e=><p key={e.id} className={s.notice}>Operation {short(e.id)} - {e.status} - booking context unavailable. The operation remains visible; its customer, offer and route are not inferred.</p>)}</>:null}
 {view==='shipments'?<CommercialDirectory title="Opportunities" cards={opportunities.map(opportunityCard)} partial={snapshot.partial} busy={busy} onOpen={open}/>:null}
 {view==='desk'?<CommercialDirectory title="Carrier offers" cards={offers.map(f=>offerCard(f,snapshot,now))} partial={snapshot.partial} busy={busy} onOpen={open}/>:null}
 </>}
 {selection&&view==='pipeline'&&snapshot?<Dialog open={active} animated title={selection.kind==='bookings'?'Order details':detail?.kind==='opportunities'?routeLabel(detail):'Review group'} description={selection.kind==='bookings'?'Reservations, resources and recorded operations.':'Offers and Orders linked to this opportunity.'} closeLabel="Close detail" closeDisabled={busy} className={selection.kind==='bookings'?s.pipelineOrderDialog:undefined} onClose={()=>setSelection(null)}>{detailError?<p role="alert">{detailError}</p>:null}{selection.kind!=='bookings'&&!detail&&!detailError?<p role="status">Reading current linked records…</p>:null}{active?<PipelineConnections carrier={carrier} selection={selection} detail={detail} snapshot={snapshot} onOpen={open} onSaved={saved} onBusyChange={setBusy}/>:null}</Dialog>:null}
 {selection&&view!=='pipeline'?<section ref={detailPanel} tabIndex={-1} className={s.panel} aria-label="Commercial record detail"><div className={s.actions}><Button variant="secondary" disabled={busy} onClick={()=>{setSelection(null);setAction(null);}}>Close detail</Button><Button variant="secondary" disabled={busy} onClick={()=>{setAction(null);setRefresh(n=>n+1);}}>Refresh detail</Button></div>{detailError?<p role="alert">{detailError}</p>:null}{!detail&&!detailError?<p role="status">Reading the current record and version…</p>:null}
 <CommercialRecordFrame title={detail?.kind==='offers'?'Carrier offer review':detail?.kind==='bookings'?'Order review':'Opportunity review'}>
 {detail?.kind==='opportunities'?<><h2>{routeLabel(detail)}</h2><span className={s.badge}>{detail.status}</span><p>Opportunity {short(detail.id)} · revision {detail.version} · customer organization {short(detail.organizationId)}</p><dl className={s.facts}><div><dt>Origin</dt><dd><DataValue value={detail.data.origin} es={false}/></dd></div><div><dt>Destination</dt><dd><DataValue value={detail.data.destination} es={false}/></dd></div><div><dt>Response deadline</dt><dd>{date(detail.data.responseDeadline)}</dd></div><div><dt>Response channel</dt><dd>{detail.data.responseChannel}</dd></div></dl><h3>Cargo & customer requirements</h3><DataValue value={detail.data.cargoSpecification} es={false}/><details><summary>Assigned legs, equipment, capacity and windows</summary><DataValue value={detail.data.assignmentSnapshots} es={false}/></details>
 <div className={s.notice}>
  <strong>Discuss this request with Nova</strong>
  <p>Nova can explain the recorded request. For a price estimate, enter your own rate for the recorded vehicle type. Distance × USD/km is indicative; tolls, fuel, taxes and other costs need separate review. Nothing is sent until you confirm the offer form.</p>
  <NovaVoicePreview key={detail.id} autoStart={autoVoiceOpportunityId===detail.id} carrierScope={{carrierId:carrier.carrierId,opportunityId:detail.id}} onTurn={turn=>{
   if(!turn.final)return;
   setVoiceTurns(rows=>[...rows.filter(row=>row.id!==turn.contentId),{id:turn.contentId,role:turn.role,text:turn.text}].slice(-8));
   if(turn.role==='user'){const amount=carrierVoicePrice(turn.text);setSpokenAmount(amount);setUseEstimate(amount===null&&acceptsSuggestedPrice(turn.text));}
  }}/>
  {voiceTurns.length?<div aria-label="Recent voice transcript">{voiceTurns.map(turn=><p key={turn.id}><strong>{turn.role==='user'?'You':'CargoMesh'}:</strong> {turn.text}</p>)}</div>:null}
  {spokenAmount!==null?<p role="status">I heard your proposed total: <strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(spokenAmount)}</strong>. This is not a CargoMesh recommendation.</p>:null}
  {spokenAmount!==null?<Button disabled={!allowed('offers.create',detail.status)||!selectedAssignments.length||Date.parse(detail.data.responseDeadline)<=now} onClick={()=>beginOffer(detail,null,spokenAmount)}>Use my spoken amount in an editable offer</Button>:null}
 </div>
 <div className={s.notice} aria-label="Carrier price estimate"><strong>Estimate from your carrier rate</strong>
  {estimateBasis?<><p>Recorded ROAD distance: {estimateBasis.distanceKm.toLocaleString('en-US')} km · vehicle/equipment: {estimateBasis.equipmentType.replaceAll('_',' ')}.</p>
   <label>Rate for {estimateBasis.equipmentType.replaceAll('_',' ')} (USD per km) <input type="number" min="0.01" max="100000" step="0.01" value={ratePerKm} onChange={e=>{setRatePerKm(e.target.value);setUseEstimate(false);}} /></label>
   {estimatedAmount!==null?<p role="status">Indicative transport price: <strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(estimatedAmount)}</strong> = {estimateBasis.distanceKm.toLocaleString('en-US')} km × {Number(ratePerKm).toFixed(2)} USD/km. This rate is entered by you, not a verified CargoMesh tariff.</p>:<p>Enter your rate to calculate a proposal.</p>}
   {useEstimate&&estimatedAmount!==null?<p role="status">I heard that you like this estimate. Review the prefilled offer and confirm it explicitly before sending.</p>:null}
   <Button disabled={estimatedAmount===null||!allowed('offers.create',detail.status)||Date.parse(detail.data.responseDeadline)<=now} onClick={()=>{if(estimatedAmount!==null)beginOffer(detail,null,estimatedAmount,true);}}>Review offer at estimated price</Button>
  </>:<p>Automatic estimate unavailable: the selected assignment needs recorded ROAD distance and one unambiguous vehicle type. You can still enter a manual offer with its evidence.</p>}
 </div>
 <div className={s.actions}><Button disabled={!allowed('opportunities.respond',detail.status)||Date.parse(detail.data.responseDeadline)<=now} onClick={()=>setAction({kind:'respond',row:detail,response:'ACCEPTED'})}>Accept for review</Button><Button variant="secondary" disabled={!allowed('opportunities.respond',detail.status)||Date.parse(detail.data.responseDeadline)<=now} onClick={()=>setAction({kind:'respond',row:detail,response:'DECLINED'})}>Decline</Button></div>
 <h3>Assignments covered by this offer</h3><fieldset className={s.selection} disabled={!!action}><legend>Select the recorded legs you will quote</legend>{detail.data.assignmentIds.map((id,i)=><label key={id}><input type="checkbox" checked={selectedAssignments.includes(id)} onChange={e=>setSelectedAssignments(ids=>e.target.checked?[...ids,id]:ids.filter(x=>x!==id))}/>Assigned leg {i+1}</label>)}</fieldset><Button disabled={!allowed('offers.create',detail.status)||!selectedAssignments.length||Date.parse(detail.data.responseDeadline)<=now} onClick={()=>beginOffer(detail)}>Prepare offer</Button>
 <h3>Offer history</h3>{snapshot?opportunityOffers(detail,snapshot).map(f=><article key={f.id} className={s.card}><strong>{f.data.carrierReference} · {money(f)}</strong><p>Version {f.data.offerVersion} · {offerState(f,now)}</p><Button variant="secondary" onClick={()=>open('offers',f.id)}>View this offer</Button></article>):null}</>:null}
 {detail?.kind==='offers'?<>{carrier.role==='ADMIN'?<OperatingCostCalculation key={detail.id} carrierId={carrier.carrierId} offerId={detail.id}/>:null}<h2>{detail.data.carrierReference}</h2><p>{money(detail)} · version {detail.data.offerVersion} · {offerState(detail,now)}</p><p>Source: {detail.data.source.channel} · {detail.data.source.evidence.provenanceStatus} · issuer {short(detail.data.source.issuerId)}</p><details open><summary>Price, timing, capacity, terms and evidence</summary><DataValue value={Object.fromEntries(Object.entries(detail.data).filter(([key])=>['price','breakdown','validity','estimatedPickupAt','estimatedDeliveryAt','transitDurationSeconds','reservableCapacity','commercialTerms','evidence'].includes(key)))} es={false}/></details><div className={s.actions}><Button variant="secondary" onClick={()=>open('opportunities',detail.data.opportunityId)}>Open source opportunity</Button><Button variant="secondary" disabled={!allowed('offers.withdraw',detail.status)} onClick={()=>setAction({kind:'withdraw',row:detail})}>Withdraw offer</Button><Button disabled={!allowed('offers.supersede',detail.status)||!snapshot?.opportunities.some(o=>o.id===detail.data.opportunityId&&o.requestId===detail.requestId&&Date.parse(o.data.responseDeadline)>now)} onClick={()=>{const o=snapshot?.opportunities.find(o=>o.id===detail.data.opportunityId);if(o)beginOffer(o,detail);}}>Issue replacement version</Button></div></>:null}
 {detail?.kind==='bookings'?<><BookingConfirmationWindow bookingId={detail.id} carrierId={carrier.carrierId} canAct={carrier.role!=="DISPATCHER"&&!busy} onChanged={saved}/><h2>{detail.data.carrierReference??'Order '+short(detail.id)}</h2><p>Customer authorization: {detail.data.authorizationStatus} · Carrier confirmation: {detail.data.carrierConfirmationStatus}</p><p>Customer organization {short(detail.organizationId)} · request {short(detail.requestId)} · revision {detail.version}</p>{snapshot&&bookingOffer(detail,snapshot)?<Button variant="secondary" onClick={()=>open('offers',bookingOffer(detail,snapshot)!.id)}>View selected offer</Button>:<p className={s.notice}>The selected offer reference is unavailable in this environment. Booking remains visible; price and route are not guessed.</p>}<details open><summary>Authorization and capacity evidence</summary><DataValue value={detail.data} es={false}/></details><Button disabled={!allowed('bookings.confirm',detail.status)} onClick={()=>setAction({kind:'confirm-booking',row:detail})}>Respond to booking</Button></>:null}
 {action?<><p className={s.notice}>Review before sending. Commercial changes are attributed to your account and revalidated by the backend. Use the evidence provenance that matches your data. Customer selection and booking consent remain separate.</p><CommercialActionForm key={action.kind+action.row.id+('issuedAt' in action?action.issuedAt:'')} carrierId={carrier.carrierId} action={action} onSaved={saved} onBusyChange={setBusy} onClose={()=>{setBusy(false);setAction(null);}}/></>:null}
 </CommercialRecordFrame></section>:null}
 </div>;
}
