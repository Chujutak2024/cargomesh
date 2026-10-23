"use client";
import {useLocale} from '@/features/i18n/locale-provider';
import {carrierStatusLabel} from '@/features/carrier-navigation/carrier-status';
import type {ReactNode} from 'react';
import {ArrowRight,Building2,CalendarDays,ClipboardCheck,ClipboardList,Clock3,MapPin,Package,Route,Truck} from 'lucide-react';
import {Button,Select} from '@/components/ui';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import dynamic from 'next/dynamic';
import {DeferredRegion} from '@/features/carrier-navigation/deferred-region';
const LogisticsTruck=dynamic(()=>import('@/features/logistics-3d/logistics-truck').then(module=>module.LogisticsTruck),{ssr:false});
import {offerState,type CommercialSnapshot,type Opportunity} from './commercial-model';
import {opportunityCard,displayCommercialDate,type CommercialCard} from './commercial-presentation-model';
import j from './journey.module.css';
import d from './local-dashboard.module.css';
import r from './local-request-directory.module.css';
import p from './portal.module.css';
import review from './request-review.module.css';

type Open=(kind:CommercialCard['kind'],id:string)=>void;
export function CommercialOverview({snapshot,featuredId,onSelect,onOpen,busy,now}:{snapshot:CommercialSnapshot;featuredId:string;onSelect:(id:string)=>void;onOpen:Open;busy:boolean;now:number}){
 const row=snapshot.opportunities.find(o=>o.id===featuredId)??snapshot.opportunities[0],featured=row?opportunityCard(row):null;
 const metrics=[['Opportunities',String(snapshot.opportunities.length),'Loaded authorized requests'],['Current offers',String(snapshot.offers.filter(f=>offerState(f,now)==='CURRENT').length),'Issued Carrier quotes'],['Customer bookings',String(snapshot.bookings.length),'Customer authorizations - not dispatches']];
 return <div className={d.dashboard}>
  <div className={d.panelToolbar}><div className={d.panelProvenance}><CarrierLink href="/carriers/requests">View requests <ArrowRight size={15}/></CarrierLink></div><Select fieldClassName={d.requestPicker} label="Selected opportunity" value={row?.id??''} onChange={e=>onSelect(e.target.value)} disabled={!row}><option value="" disabled>Select opportunity</option>{snapshot.opportunities.map(o=><option key={o.id} value={o.id}>{opportunityCard(o).reference} - {o.data.origin.city??o.data.origin.label} to {o.data.destination.city??o.data.destination.label}</option>)}</Select></div>
  <div className={`${p.metrics} ${d.metrics}`}>{metrics.map(([label,value,detail])=><div className={p.metric} key={label}><small>{label}</small><strong>{value}{snapshot.partial?'+':''}</strong><small>{detail}</small></div>)}</div>
  <CommercialJourneyPending/>
  <section className={`${p.card} ${d.requestSummary}`}  aria-label="Selected opportunity summary">
   <div className={d.summaryMain}><div className={d.summaryOverview}><div className={d.summaryText}><span className={p.status}>{featured?.status??'No opportunity selected'}</span><h2><Truck size={21}/>{featured?.origin??'Origin pending'}<ArrowRight size={18}/>{featured?.destination??'Destination pending'}</h2><p>{featured?.description??'New customer opportunities will appear here once they are authorized for this Carrier.'}</p><div className={d.summaryFacts}><span><Package size={15}/>{featured?.weightKg==null?'Cargo weight pending':featured.weightKg.toLocaleString('en-US')+' kg'}</span><span><Building2 size={15}/>Carrier opportunity</span></div><dl className={d.schedule}><div><dt><CalendarDays size={15}/>Response deadline</dt><dd>{displayCommercialDate(featured?.date??null)}</dd></div><div><dt>Recorded operations in progress</dt><dd>{snapshot.executions.filter(e=>e.status==='IN_PROGRESS').length}</dd></div><div><dt>Equipment and timing</dt><dd>{row?'Review recorded assigned legs':'Pending opportunity data'}</dd></div></dl></div><div className={d.truckVisual}><DeferredRegion minHeight={180}><LogisticsTruck compact label="Illustrative reference truck" caption="Illustrative truck - no vehicle assignment or live tracking implied"/></DeferredRegion></div></div></div>
   <aside className={d.nextAction}><span className={d.nextIcon}><ClipboardCheck size={22}/></span><span className={p.eyebrow}>Next action</span><h3>{row?'Review the opportunity':'Await a customer opportunity'}</h3><p>Check cargo, recorded resources and windows before issuing your Carrier offer. Customer selection and booking consent remain separate.</p><Button disabled={!row||busy} onClick={()=>row&&onOpen('opportunities',row.id)}>Review opportunity <ArrowRight size={16}/></Button><CarrierLink className={p.localButton} href="/carriers/orders">View Orders <ArrowRight size={16}/></CarrierLink></aside>
  </section>
 </div>;
}
export function CommercialDirectory({cards,title,busy,onOpen,partial=false,children}:{cards:CommercialCard[];title:string;busy:boolean;onOpen:Open;partial?:boolean;children?:ReactNode}){
 const {t,locale}=useLocale();
 const known=cards.every(c=>c.weightKg!==null),weight=cards.reduce((sum,c)=>sum+(c.weightKg??0),0);
 return <section className={r.directory} aria-label={title}>
  <dl className={r.summary}><div><dt><ClipboardList size={18}/>{title}</dt><dd>{cards.length}{partial?'+':''}</dd><small>Loaded records matching your filters</small></div><div><dt><Package size={18}/>Cargo weight</dt><dd>{known&&cards.length?weight.toLocaleString('en-US'):'-'} <span>kg</span></dd><small>{known&&cards.length?'Across these records - not unique shipments':'Pending linked cargo data'}</small></div><div><dt><CalendarDays size={18}/>Source</dt><dd>Carrier</dd><small>Authorized records - no live GPS</small></div></dl>
  {children}
  <div className={r.requestGrid}>{cards.map(card=><article key={card.id} className={r.directoryCard} aria-label={card.reference}>
   <header><strong>{card.reference}</strong><span className={r.originBadge}>{card.kind==='offers'?'Carrier offer':card.kind==='bookings'?'Customer booking':'Customer opportunity'}</span></header>
   <div className={r.cardRoute}><div><small>Origin</small><h3>{card.origin??'Pending source data'}</h3></div><ArrowRight size={16}/><div><small>Destination</small><h3>{card.destination??'Pending source data'}</h3></div></div>
   <div className={r.cargoPreview}><div><Package size={15}/><p>{card.description}</p><small>{card.price??(card.volumeM3===null?'Volume pending':card.volumeM3.toLocaleString('en-US')+' m3')}</small></div><img src="/v2-workspace/cargomesh-truck-poster.webp" width={120} height={78} alt="" loading="lazy"/></div>
   <dl className={r.cardFacts}><div><dt>{card.price?'Quoted price':'Total weight'}</dt><dd>{card.price??(card.weightKg===null?'Pending data':card.weightKg.toLocaleString('en-US')+' kg')}</dd></div><div><dt>{card.dateLabel}</dt><dd>{displayCommercialDate(card.date)}</dd></div></dl>
   <div className={r.cardProgress}><span className={r.reviewState}>{carrierStatusLabel(card.status,locale==='es')}</span>{card.note?<details><summary>{t('Detalles','Details')}</summary><small>{card.note}</small></details>:null}</div>
   <footer><Button variant="secondary" disabled={busy} onClick={()=>onOpen(card.kind,card.id)}>Open {card.kind==='bookings'?'order':card.kind==='offers'?'offer':'opportunity'} <ArrowRight size={15}/></Button></footer>
  </article>)}</div>
  {!cards.length?<section className={`${p.card} ${r.noResults}`}><ClipboardList size={24}/><h2>No matching {title.toLowerCase()}</h2><p>No records are substituted from the local simulation. Try another search or refresh.</p></section>:null}
 </section>;
}
export function CommercialRecordFrame({children,title}:{children:ReactNode;title:string}){return <div className={review.layout}><section className={review.manifest} aria-label={title}><header><span><ClipboardCheck size={18}/>{title}</span></header>{children}</section><aside className={review.preview}><section className={p.card}><h3>Carrier response</h3><p>The customer owns the request. Review the current revision before responding or quoting.</p><p>Unknown resource, timing or route evidence remains pending.</p></section></aside></div>;}

export function CommercialJourneyPending(){return <section className={`${p.card} ${j.root}`} aria-label="Journey data pending"><header className={j.header}><div className={j.heading}><span className={j.headingIcon}><Route size={21}/></span><div><h2>Journey context</h2><p>Reported progress remains separate from commercial status.</p></div></div><span className={p.status}>Pending source</span></header><div className={j.overview}><div className={j.progressMetric}><div className={j.gauge} role="img" aria-label="Journey progress not reported"><svg viewBox="0 0 100 100" aria-hidden="true"><circle className={j.gaugeTrack} cx="50" cy="50" r="42"/></svg><strong>-</strong></div><div><span>Journey progress</span><p>Not reported</p></div></div><div className={j.timeMetric}><span className={j.metricIcon}><Clock3 size={21}/></span><div><span>Time remaining</span><strong>-</strong><small>Pending route and operational evidence</small></div></div><div className={j.arrivalMetric}><span className={j.metricIcon}><MapPin size={21}/></span><div><span>Estimated arrival</span><strong>-</strong><small>A response deadline is not an ETA</small></div></div></div></section>;}
