"use client";
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {bookingOffer,opportunityOffers,type CommercialSnapshot,type Opportunity,type Offer,type Booking} from '@/features/carrier-portal/commercial-model';
import {DataValue} from '@/features/carrier-portal/contract-form';
import {sameOrderScope} from './orders-model';
import {ConnectedOrders} from './connected-orders';
type Selection={kind:'opportunities'|'offers'|'bookings';id:string};
export function PipelineConnections({carrier,selection,detail,snapshot,onOpen,onSaved,onBusyChange}:{carrier:CarrierPortalAccessV2;selection:Selection;detail:Opportunity|Offer|Booking|null;snapshot:CommercialSnapshot|null;onOpen:(kind:Selection['kind'],id:string)=>void;onSaved:()=>void;onBusyChange:(busy:boolean)=>void}){
 if(selection.kind==='bookings')return <ConnectedOrders embedded carrier={carrier} initialBookingId={selection.id} onSaved={onSaved} onBusyChange={onBusyChange}/>;
 if(!detail||!snapshot)return null;
 const opportunity=detail.kind==='opportunities'?detail:detail.kind==='offers'?snapshot.opportunities.find(o=>opportunityOffers(o,snapshot).some(f=>f.id===detail.id))??null:null;
 const offers=opportunity?opportunityOffers(opportunity,snapshot):detail.kind==='offers'?[detail]:[];
 const bookings=snapshot.bookings.filter(b=>sameOrderScope(b,detail)&&!!bookingOffer(b,snapshot)&&offers.some(f=>f.id===b.data.offerId));
 return <section aria-label="Related offers and Orders">
 {opportunity?<CarrierLink href={'/carriers/requests/details/'+opportunity.id}>Open opportunity in Requests</CarrierLink>:<p>Source opportunity unavailable in this read.</p>}
 <h3>Offers</h3>{offers.map(f=><p key={f.id}><CarrierLink href={'/carriers/offers/details/'+f.id}>{f.data.carrierReference} · version {f.data.offerVersion} · {f.status}</CarrierLink></p>)}{!offers.length?<p>No linked offers in this read.</p>:null}
 <h3>Orders</h3>{bookings.map(b=><article key={b.id}><p>{b.data.carrierReference??'Order '+b.id.slice(-8)} · {b.data.authorizationStatus} · {b.data.carrierConfirmationStatus}</p><button onClick={()=>onOpen('bookings',b.id)}>Inspect reservations, operations and actions</button><CarrierLink href={'/carriers/orders/details/'+b.id}>Open in Orders</CarrierLink></article>)}{!bookings.length?<p>No linked Orders in the loaded records.</p>:null}
 <details><summary>Recorded source context</summary><DataValue value={{kind:detail.kind,reference:detail.id,status:detail.status,version:detail.version,requestId:detail.requestId,organizationId:detail.organizationId}} es={false}/></details>
 </section>;
}
