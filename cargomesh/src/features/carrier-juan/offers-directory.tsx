"use client";
import {SearchField} from '@/components/ui';
import {ArrowRight,ChevronRight,LayoutGrid,List,Package} from 'lucide-react';
import {useLocale} from '@/features/i18n/locale-provider';
import {displayReference} from '@/shared/lib/display-identity';
import {offerState,type Offer,type Opportunity} from '@/features/carrier-portal/commercial-model';
import {offerRelations} from './offers-model';
import {opportunityFacts,opportunityReference} from './opportunity-model';
import s from './offers-directory.module.css';

export function OffersDirectory({offers,opportunities,ready,busy,now,query,onQueryChange,status,onStatusChange,layout,onLayoutChange,onOpen}:{
 offers:Offer[];opportunities:Opportunity[];ready:boolean;busy:boolean;now:number;
 query:string;onQueryChange:(value:string)=>void;status:string;onStatusChange:(value:string)=>void;
 layout:'list'|'cards';onLayoutChange:(value:'list'|'cards')=>void;onOpen:(id:string)=>void;
}){
 const {t,localeTag}=useLocale();
 const stateLabel=(value:string)=>({
  CURRENT:t('Vigente','Current'),ACCEPTED:t('Aceptada','Accepted'),EXPIRED:t('Expirada','Expired'),
  NOT_STARTED:t('Por iniciar','Not started'),WITHDRAWN:t('Retirada','Withdrawn'),SUPERSEDED:t('Reemplazada','Superseded'),
  REJECTED:t('Rechazada','Rejected'),CANCELLED:t('Cancelada','Cancelled'),
 } as Record<string,string>)[value]??value.replaceAll('_',' ');
 const rows=offers.map(offer=>{
  const opportunity=opportunities.find(row=>offerRelations(offer,row));
  const facts=opportunity?opportunityFacts(opportunity):null;
  return {offer,facts,reference:displayReference(offer.data.carrierReference,'OFE',offer.id),request:opportunity?opportunityReference(opportunity):'',state:offerState(offer,now)};
 });
 const baseFilters=['CURRENT','ACCEPTED','EXPIRED'];
 const filterIds=['all',...baseFilters,...new Set(rows.map(row=>row.state).filter(value=>!baseFilters.includes(value)))];
 const search=query.trim().toLocaleLowerCase();
 const visible=rows.filter(row=>(status==='all'||row.state===status)&&[row.reference,row.request,row.offer.id,row.offer.requestId,row.facts?.origin,row.facts?.destination,row.facts?.description].join(' ').toLocaleLowerCase().includes(search));
 const labels=[t('Oferta','Offer'),t('Ruta','Route'),t('Carga','Cargo'),t('Total cotizado','Quoted total'),t('Estado','State')];
 const number=new Intl.NumberFormat(localeTag,{minimumFractionDigits:2,maximumFractionDigits:2});
 const expiry=(offer:Offer)=>{
  const minutes=Math.ceil((Date.parse(offer.data.validity.endsAt)-now)/60000);
  if(!Number.isFinite(minutes)||minutes<=0||minutes>2880)return null;
  return minutes<=60?t('Vence en '+minutes+' min','Expires in '+minutes+' min'):t('Vence en '+Math.ceil(minutes/60)+' h','Expires in '+Math.ceil(minutes/60)+' h');
 };
 return <section className={s.directory} aria-label={t('Ofertas','Offers')}>
  <div className={s.toolbar}>
   <SearchField fieldClassName={s.search} hideLabel label={t('Buscar referencia o solicitud','Search reference or request')} placeholder={t('Buscar referencia o solicitud','Search reference or request')} value={query} onValueChange={onQueryChange}/>
   <div className={s.segments} role="group" aria-label={t('Estado de la oferta','Offer state')}>{filterIds.map(id=><button type="button" key={id} aria-pressed={status===id} onClick={()=>onStatusChange(id)}>{id==='all'?t('Todas','All'):stateLabel(id)}<span>{ready?(id==='all'?rows.length:rows.filter(row=>row.state===id).length):'—'}</span></button>)}</div>
   <div className={s.viewToggle} role="group" aria-label={t('Vista de ofertas','Offer view')}><button type="button" aria-label={t('Vista de lista','List view')} aria-pressed={layout==='list'} onClick={()=>onLayoutChange('list')}><List size={16} aria-hidden="true"/></button><button type="button" aria-label={t('Vista de tarjetas','Card view')} aria-pressed={layout==='cards'} onClick={()=>onLayoutChange('cards')}><LayoutGrid size={16} aria-hidden="true"/></button></div>
  </div>
  <div className={s.scroll} role="region" tabIndex={0} aria-label={t('Listado de ofertas','Offer list')}>
   <div className={s.table} role="table" aria-label={t('Ofertas cargadas','Loaded offers')} data-layout={layout}>
    <div role="rowgroup" className={s.tableHead}><div className={s.columnHeadings} role="row">{labels.map((label,index)=><div key={label} role="columnheader" className={index===3?s.amount:undefined}>{label}</div>)}<div role="columnheader"><span className={s.srOnly}>{t('Abrir','Open')}</span></div></div></div>
    <div role="rowgroup" className={s.tableBody}>{visible.map(({offer,facts,reference,state:rowState})=><div role="row" key={offer.id} className={s.offerRow} data-muted={['EXPIRED','WITHDRAWN','SUPERSEDED'].includes(rowState)}>
     <div role="cell" data-label={labels[0]}><button type="button" className={s.reference} disabled={busy} onClick={()=>onOpen(offer.id)}>{reference}</button><small>{t('Oferta emitida','Issued offer')}</small></div>
     <div role="cell" data-label={labels[1]}><div className={s.route}><span>{facts?.origin??t('Sin datos','Not in this read')}</span><ArrowRight size={14} aria-hidden="true"/><span>{facts?.destination??t('Sin datos','Not in this read')}</span></div></div>
     <div role="cell" data-label={labels[2]}><div className={s.cargo}><Package size={15} aria-hidden="true"/><span>{facts?.description??t('Proyección no disponible','Customer projection unavailable')}</span></div></div>
     <div role="cell" data-label={labels[3]} className={s.amount}>{offer.data.price.currency} {number.format(offer.data.price.amount)}</div>
     <div role="cell" data-label={labels[4]}><span className={s.pill} data-state={rowState}><i aria-hidden="true"/>{stateLabel(rowState)}</span>{rowState==='CURRENT'&&expiry(offer)?<small className={s.expiry}>{expiry(offer)}</small>:null}</div>
     <div role="cell" className={s.openCell}><button type="button" className={s.go} disabled={busy} onClick={()=>onOpen(offer.id)} aria-label={t('Abrir ','Open ')+reference}><ChevronRight size={16} aria-hidden="true"/></button></div>
    </div>)}</div>
   </div>
   {ready&&!visible.length?<p className={s.empty} role="status">{rows.length?t('No hay ofertas con estos filtros.','No offers match these filters.'):t('No hay ofertas registradas.','No offers recorded.')}</p>:null}
  </div>
 </section>;
}
