'use client';
import {useEffect,useState} from 'react';
import {ArrowDownRight,ArrowRight,ArrowUpRight,Banknote,ClipboardList,Clock3,TrendingUp} from 'lucide-react';
import {Select} from '@/components/ui';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {readCommercial} from '@/features/carrier-portal/commercial-client';
import type {CommercialSnapshot} from '@/features/carrier-portal/commercial-model';
import {portalRequest,portalErrorCopy} from '@/features/carrier-portal/api';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {useLocale} from '@/features/i18n/locale-provider';
import {ControlTower} from '@/features/carrier-control-tower/control-tower';
import {carrierDashboard} from './dashboard-model';
import s from './connected-dashboard.module.css';

export function ConnectedDashboard({carrier,refreshToken}:{carrier:CarrierPortalAccessV2;refreshToken:number}){
 const {t}=useLocale();
 return <div className={s.dashboard}>
  <ControlTower embedded dashboard carrier={carrier} refreshToken={refreshToken}/>
  <details className={s.commercialSummary}>
   <summary>{t('Resumen comercial','Commercial summary')}<span>{t('Contratación, margen y pendientes','Bookings, margin and follow-ups')}</span></summary>
   <CommercialDashboard carrier={carrier} refreshToken={refreshToken}/>
  </details>
 </div>;
}

function CommercialDashboard({carrier,refreshToken}:{carrier:CarrierPortalAccessV2;refreshToken:number}){
 const {t,localeTag}=useLocale(),[snapshot,setSnapshot]=useState<CommercialSnapshot|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[days,setDays]=useState(7),[currency,setCurrency]=useState('USD'),[costs,setCosts]=useState<Record<string,unknown>>({});
 useEffect(()=>{const c=new AbortController();setSnapshot(null);setCosts({});setError('');void readCommercial(carrier.carrierId,c.signal).then(value=>{if(!c.signal.aborted)setSnapshot(value);}).catch(e=>{if(!c.signal.aborted)setError(portalErrorCopy(e,false));});return()=>c.abort();},[carrier.carrierId,refreshToken,revision]);
 useEffect(()=>{const c=new AbortController();setCosts({});if(snapshot&&carrier.role==='ADMIN'){
  const ids=carrierDashboard(snapshot,currency,days,Date.now()).costOfferIds;
  // Larger histories need an aggregate read; missing costs remain unknown.
  if(ids.length<=12)void Promise.allSettled(ids.map(async id=>{const r=await portalRequest(`/api/v2/carrier-portal/carriers/${carrier.carrierId}/offers/${id}/cost-calculation`,{signal:c.signal});return [id,r.data] as const;})).then(results=>{if(!c.signal.aborted)setCosts(Object.fromEntries(results.flatMap(r=>r.status==='fulfilled'?[r.value]:[])));});
 }return()=>c.abort();},[snapshot,carrier.carrierId,carrier.role,currency,days]);
 if(error)return <p role="alert">{error} <button onClick={()=>setRevision(value=>value+1)}>{t('Reintentar','Retry')}</button></p>;
 if(!snapshot)return <p role="status">{t('Consultando operaciones…','Loading operations…')}</p>;
 const model=carrierDashboard(snapshot,currency,days,Date.now(),costs),money=(cents:number)=>new Intl.NumberFormat(localeTag,{style:'currency',currency}).format(cents/100);
 const max=Math.max(1,...model.buckets.map(b=>b.cents)),points=model.buckets.map((b,i)=>`${20+i*660/Math.max(1,days-1)},${176-b.cents/max*140}`).join(' '),change=model.changePercent,Trend=change!==null&&change<0?ArrowDownRight:ArrowUpRight;
 const metrics=[{label:t('Importe contratado','Contracted amount'),value:money(model.contractedCents),Icon:Banknote,href:'/carriers/orders',detail:t('Reservas confirmadas del período','Confirmed bookings in this period')},
  {label:t('Órdenes por atender','Orders to fulfill'),value:String(model.scheduled+model.inProgress),Icon:ClipboardList,href:'/carriers/orders',detail:`${model.scheduled} ${t('programadas','scheduled')} · ${model.inProgress} ${t('en curso','in progress')}`},
  {label:t('Por confirmar','Awaiting confirmation'),value:String(model.awaitingConfirmation),Icon:Clock3,href:'/carriers/orders',detail:t('Autorizadas por el Cliente','Authorized by the Client')},
  carrier.role==='ADMIN'?{label:t('Margen previsto','Estimated margin'),value:model.estimatedMarginCents===null?'—':money(model.estimatedMarginCents),Icon:TrendingUp,href:'/carriers/offers/automation',detail:model.estimatedMarginCents===null?t('Costos pendientes','Costs pending'):t('Según costos registrados · no cobrado','From recorded costs · not collected')}:{label:t('Por cotizar','Awaiting quote'),value:String(model.awaitingQuote),Icon:TrendingUp,href:'/carriers/requests',detail:t('Solicitudes abiertas','Open opportunities')}];
 return <div className={s.dashboard}>
  <div className={s.toolbar}><span>{carrier.carrierName}</span><div><Select label={t('Período','Period')} value={String(days)} onChange={e=>setDays(Number(e.target.value))}><option value="7">{t('7 días','7 days')}</option><option value="30">{t('30 días','30 days')}</option></Select>{model.currencies.length>1?<Select label={t('Moneda','Currency')} value={currency} onChange={e=>setCurrency(e.target.value)}>{[...new Set([currency,...model.currencies])].map(value=><option key={value}>{value}</option>)}</Select>:null}</div></div>
  {!model.complete?<p role="status">{t('Vista parcial: faltan registros o relaciones para completar los importes.','Partial view: records or relationships are missing from these amounts.')}</p>:null}
  <div className={s.metrics}>{metrics.map(({label,value,Icon,href,detail})=><CarrierLink key={label} href={href} className={s.metric}><div><span>{label}</span><Icon size={18} aria-hidden="true"/></div><strong>{value}</strong><small>{detail}</small></CarrierLink>)}</div>
  <div className={s.layout}><section className={s.panel}><header><div><h2>{t('Evolución de contratación','Booking trend')}</h2><span>{t('Reservas confirmadas','Confirmed bookings')} · {currency} · PET</span></div>{change!==null?<span className={s.trend} data-negative={change<0}><Trend size={17}/>{Math.abs(change).toFixed(1)}% <small>{t('vs. período anterior','vs. previous period')}</small></span>:<small>{t('Sin período comparable','No comparable period')}</small>}</header>
   <svg className={s.chart} viewBox="0 0 700 200" role="img" aria-label={t('Importe contratado por día','Contracted amount per day')}><title>{t('Importe contratado por día','Contracted amount per day')}</title>{[36,106,176].map(y=><line key={y} x1="20" x2="680" y1={y} y2={y} stroke="var(--cm-border,#d5e2e7)" strokeDasharray="4 5"/>)}<polygon points={`20,176 ${points} 680,176`} fill="#007b8810"/><polyline points={points} fill="none" stroke="#007b88" strokeWidth="3" strokeLinejoin="round"/>{model.buckets.map((b,i)=><circle key={b.date} cx={20+i*660/Math.max(1,days-1)} cy={176-b.cents/max*140} r={days===7?4:2} fill="#007b88"><title>{b.date}: {money(b.cents)}</title></circle>)}</svg>
   <div className={s.axis}><span>{model.buckets[0].date}</span><span>{money(model.contractedCents===0?0:max)}</span><span>{model.buckets.at(-1)?.date}</span></div><details className={s.values}><summary>{t('Ver valores','View values')}</summary><table><thead><tr><th>{t('Fecha','Date')}</th><th>{t('Contratado','Contracted')}</th></tr></thead><tbody>{model.buckets.map(b=><tr key={b.date}><td>{b.date}</td><td>{money(b.cents)}</td></tr>)}</tbody></table></details></section>
   <section className={s.panel}><header><h2>{t('Atención pendiente','Needs attention')}</h2></header>{[{label:t('Solicitudes por cotizar','Requests awaiting quote'),value:model.awaitingQuote,href:'/carriers/requests'},{label:t('Reservas por confirmar','Bookings awaiting confirmation'),value:model.awaitingConfirmation,href:'/carriers/orders'},{label:t('Órdenes programadas','Scheduled orders'),value:model.scheduled,href:'/carriers/orders'}].map(row=><CarrierLink key={row.label} href={row.href} className={s.attention}><span>{row.label}</span><strong>{row.value}</strong><ArrowRight size={16}/></CarrierLink>)}{carrier.role==='ADMIN'?<CarrierLink className={s.configure} href="/carriers/offers/automation">{t('Configurar automatización','Configure automation')}<ArrowRight size={16}/></CarrierLink>:null}</section></div>
 </div>;
}
