"use client";
import {displayReference} from "@/shared/lib/display-identity";

import {Button} from '@/components/ui';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {offerState,pipelineItems,routeLabel,stages} from './commercial-model';
import s from './commercial-workspace.module.css';

type PipelineItem=ReturnType<typeof pipelineItems>[number];
type SelectionKind='opportunities'|'offers'|'bookings';


/** Presentation only: columns follow the existing persisted-workflow projection. */
export function PipelineBoard({items,busy,partial,now,onOpen}:{items:PipelineItem[];busy:boolean;partial:boolean;now:number;onOpen:(kind:SelectionKind,id:string)=>void}){
 return <div className={s.pipelineBoard}>
  <div className={s.boardScroll} role="region" aria-label="Carrier pipeline stages, scroll horizontally" tabIndex={0}>
   <div className={s.board}>
    {stages.map((stage,index)=>{
     const groups=items.filter(item=>item.stage===stage);
     return <section key={stage} className={s.column} data-stage={index} aria-label={stage}>
      <header className={s.stageHeading}><h2>{stage}</h2><span aria-label={groups.length+' loaded opportunity groups'+(partial?' in a partial read':'')}>{groups.length}</span></header>
      <div className={s.columnCards}>
       {groups.map(item=><article key={item.opportunity.id} className={`${s.card} ${s.pipelineCard}`}>
        <small className={s.opportunityReference}>{displayReference(null,'PED',item.opportunity.requestId)}</small>
        <h3>{routeLabel(item.opportunity)}</h3>
        <span className={s.cargoTag}>{item.opportunity.data.cargoSpecification.categoryCode}</span>
        <div className={s.offerVersions}>
         {item.offers.length?item.offers.map(offer=><CarrierLink key={offer.id} className={s.offerVersion} href={'/carriers/offers/details/'+offer.id} aria-disabled={busy||undefined} onClick={event=>{if(busy)event.preventDefault();}}>
          <span><strong>{displayReference(offer.data.carrierReference,'OFE',offer.id)}</strong><small>v{offer.data.offerVersion} · {offerState(offer,now).replaceAll('_',' ')}</small></span>
          <span className={s.offerAmount}>{offer.data.price.currency} {new Intl.NumberFormat('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}).format(offer.data.price.amount)}</span>
         </CarrierLink>):<p className={s.quotePending}>No offer in this read</p>}
        </div>
        <div className={s.pipelineCardFooter}>
         <Button variant="secondary" size="compact" disabled={busy} onClick={()=>onOpen('opportunities',item.opportunity.id)}>Review group</Button>
         <CarrierLink href={'/carriers/requests/details/'+item.opportunity.id} aria-disabled={busy||undefined} onClick={event=>{if(busy)event.preventDefault();}}>Request</CarrierLink>
        </div>
        {item.bookings.length?<div className={s.linkedOrders}>{item.bookings.map(booking=><Button key={booking.id} variant="ghost" size="compact" disabled={busy} onClick={()=>onOpen('bookings',booking.id)}>{displayReference(booking.data.carrierReference,'BKG',booking.id)}</Button>)}</div>:null}
       </article>)}
       {!groups.length?<p className={s.emptyColumn}>No records in this read</p>:null}
      </div>
     </section>;
    })}
   </div>
  </div>
 </div>;
}
