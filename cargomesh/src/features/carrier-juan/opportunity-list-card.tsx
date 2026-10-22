"use client";
import {ArrowRight,Clock3,Package} from 'lucide-react';
import {useLocale} from '@/features/i18n/locale-provider';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
import {opportunityFacts} from './opportunity-model';
import s from './opportunity-list-card.module.css';

/** Presentation only: the customer's cargo description is not an assigned truck. */
export function OpportunityListCard({row,busy,onOpen}:{row:Opportunity;busy:boolean;onOpen:()=>void}){
 const {t,locale,localeTag}=useLocale();
 const facts=opportunityFacts(row);
 const date=new Intl.DateTimeFormat(localeTag,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const time=new Intl.DateTimeFormat(localeTag,{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:locale==='en',timeZone:'UTC',timeZoneName:'short'});
 const dateValue=(value:string|null)=>{
  if(!value||!Number.isFinite(Date.parse(value)))return <span className={s.unknown}>{t('Sin datos','Not provided')}</span>;
  const instant=new Date(value);
  return <time dateTime={value}><strong>{date.format(instant)}</strong><span>{time.format(instant)}</span></time>;
 };
 return <article className={s.card} aria-label={facts.reference}>
  <header className={s.heading}><strong title={facts.reference}>{facts.reference}</strong><span className={s.badge}><i aria-hidden="true"/>{t('Oportunidad de cliente','Customer opportunity')}</span></header>
  <div className={s.route}>
   <div><span className={s.label}>{t('Origen','Origin')}</span><strong>{facts.origin}</strong></div>
   <span className={s.connector} aria-hidden="true"><i/><b/><i/></span>
   <div><span className={s.label}>{t('Destino','Destination')}</span><strong>{facts.destination}</strong></div>
  </div>
  <div className={s.cargo}>
   <svg width="64" height="40" viewBox="0 0 120 76" fill="none" aria-hidden="true"><rect x="38" y="8" width="76" height="44" rx="4" fill="#fff" stroke="#94a3b8" strokeWidth="3"/><path d="M38 16H18a6 6 0 0 0-6 6v30h26z" fill="#1e3a4c"/><path d="M16 22h16v12H16z" fill="#cbd5e1"/><rect x="8" y="52" width="106" height="6" rx="2" fill="#475569"/><circle cx="30" cy="62" r="9" fill="#1e293b"/><circle cx="96" cy="62" r="9" fill="#1e293b"/></svg>
   <div><span className={s.label}>{t('Carga','Cargo')}</span><p>{facts.description}</p></div>
  </div>
  <div className={s.body}>
   <div className={s.deadline}><Clock3 size={14} aria-hidden="true"/><div><span className={s.label}>{t('Responder antes de','Respond by')}</span>{dateValue(row.data.responseDeadline)}</div></div>
   <dl className={s.facts}>
    <div><dt>{t('Peso total','Total weight')}</dt><dd className={s.weight}><Package size={13} aria-hidden="true"/>{facts.weightKg===null?t('Sin datos','Not provided'):new Intl.NumberFormat(localeTag).format(facts.weightKg)+' kg'}</dd></div>
    <div><dt>{t('Entrega solicitada','Requested delivery')}</dt><dd>{dateValue(facts.delivery?.endsAt??null)}</dd></div>
   </dl>
  </div>
  <footer className={s.footer}><button type="button" disabled={busy} onClick={onOpen}>{t('Abrir oportunidad','Open opportunity')}<ArrowRight size={16} aria-hidden="true"/></button></footer>
 </article>;
}
