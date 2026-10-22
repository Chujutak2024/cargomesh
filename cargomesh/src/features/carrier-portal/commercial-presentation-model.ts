import {displayReference,locationDisplayLabel,cargoDisplayDescription} from '@/shared/lib/display-identity';
import {bookingOffer,bookingExecutions,opportunityOffers,orderStage,offerState,type CommercialSnapshot,type Opportunity,type Offer,type Booking} from './commercial-model';
export type CommercialCard={id:string;kind:'opportunities'|'offers'|'bookings';reference:string;origin:string|null;destination:string|null;description:string;status:string;weightKg:number|null;volumeM3:number|null;date:string|null;dateLabel:string;price:string|null;note:string};
export const displayCommercialDate=(value:string|null)=>value?new Date(value).toLocaleString('en-US'):'Pending data';
export const displayCommercialMoney=(offer:Offer)=>new Intl.NumberFormat('en-US',{style:'currency',currency:offer.data.price.currency}).format(offer.data.price.amount);
const sourceOpportunity=(offer:Offer,s:CommercialSnapshot)=>s.opportunities.find(o=>opportunityOffers(o,s).some(f=>f.id===offer.id))??null;
const nonnegative=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function opportunityCard(o:Opportunity):CommercialCard{
 const cargo=o.data.cargoSpecification;
 return {id:o.id,kind:'opportunities',reference:displayReference(null,'PED',o.requestId??o.id),origin:locationDisplayLabel(o.data.origin.city??o.data.origin.label),destination:locationDisplayLabel(o.data.destination.city??o.data.destination.label),
 description:cargoDisplayDescription(typeof cargo.description==='string'?cargo.description:null,typeof cargo.categoryCode==='string'?cargo.categoryCode:null),status:o.status,
 weightKg:nonnegative(cargo.totalWeightKg),volumeM3:nonnegative(cargo.totalVolumeM3),date:o.data.responseDeadline,dateLabel:'Respond by',price:null,note:'Customer request '+displayReference(null,'PED',o.requestId??o.id)+' - revision '+o.version};
}
export function offerCard(f:Offer,s:CommercialSnapshot,now:number):CommercialCard{
 const o=sourceOpportunity(f,s),base=o?opportunityCard(o):null;
 return {id:f.id,kind:'offers',reference:displayReference(f.data.carrierReference,'OFE',f.id),origin:base?.origin??null,destination:base?.destination??null,description:base?.description??'Source opportunity unavailable',status:offerState(f,now),weightKg:base?.weightKg??null,volumeM3:base?.volumeM3??null,date:f.data.validity.endsAt,dateLabel:'Valid until',price:displayCommercialMoney(f),note:'Offer version '+f.data.offerVersion+' - '+f.data.source.evidence.provenanceStatus};
}
export function bookingCard(b:Booking,s:CommercialSnapshot,now:number):CommercialCard{
 const f=bookingOffer(b,s),base=f?offerCard(f,s,now):null,executions=bookingExecutions(b,s);
 return {id:b.id,kind:'bookings',reference:displayReference(b.data.carrierReference,'BKG',b.id),origin:base?.origin??null,destination:base?.destination??null,description:base?.description??'Offer and route context pending',status:orderStage(b,s),weightKg:base?.weightKg??null,volumeM3:base?.volumeM3??null,date:executions[0]?.data.plannedWindow.startsAt??null,dateLabel:'Recorded operation window',price:base?.price??null,note:executions.length+' recorded operation(s) - customer authorization '+b.data.authorizationStatus};
}
