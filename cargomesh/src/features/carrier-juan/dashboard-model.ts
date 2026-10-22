import {bookingOffer,orderStage,type CommercialSnapshot} from '@/features/carrier-portal/commercial-model';
import {CarrierCostCalculationRecordSchema} from '@/shared/schemas/v2/operating-costs';
const day=86400000;
/** Commercial amounts only: no cash receipts or realized profit are inferred. */
export function carrierDashboard(snapshot:CommercialSnapshot,currency:string,days:number,now:number,calculations:Record<string,unknown>={}){
 const today=Math.floor((now-5*3600000)/day),start=today-days+1,priorStart=start-days;
 const buckets=Array.from({length:days},(_,i)=>({date:new Date((start+i)*day).toISOString().slice(0,10),cents:0}));
 const seen=new Set<string>(),costOfferIds:string[]=[];let contractedCents=0,previousCents=0,marginCents=0,unknownCosts=0,unresolved=0;
 const active=snapshot.bookings.filter(b=>b.data.authorizationStatus==='AUTHORIZED'&&!['CANCELLED','REJECTED'].includes(b.data.carrierConfirmationStatus));
 for(const booking of active){
  if(booking.status!=='CONFIRMED'||booking.data.carrierConfirmationStatus!=='CONFIRMED')continue;
  const offer=bookingOffer(booking,snapshot);
  if(!offer||!booking.data.confirmedAt){unresolved++;continue;}
  if(offer.data.price.currency!==currency||seen.has(offer.id))continue;seen.add(offer.id);
  const index=Math.floor((Date.parse(booking.data.confirmedAt)-5*3600000)/day);if(!Number.isFinite(index)){unresolved++;continue;}
  const cents=Math.round(offer.data.price.amount*100);
  if(index>=priorStart&&index<start)previousCents+=cents;
  if(index<start||index>today)continue;
  contractedCents+=cents;buckets[index-start].cents+=cents;costOfferIds.push(offer.id);
  const cost=CarrierCostCalculationRecordSchema.safeParse(calculations[offer.id]);
  if(currency==='USD'&&cost.success&&cost.data.offerId===offer.id&&cost.data.snapshot?.calculation.totalCents===cents){const c=cost.data.snapshot.calculation;marginCents+=c.totalCents-c.operatingCents-c.taxCents;}else unknownCosts++;
 }
 const stages=active.map(b=>orderStage(b,snapshot));
 return {contractedCents,previousCents,changePercent:previousCents?100*(contractedCents-previousCents)/previousCents:null,
  estimatedMarginCents:unknownCosts||snapshot.partial||unresolved?null:marginCents,costOfferIds,buckets,unresolved,
  currencies:[...new Set(snapshot.offers.map(o=>o.data.price.currency))].sort(),
  scheduled:stages.filter(s=>s==='Scheduled').length,inProgress:stages.filter(s=>s==='In progress').length,completed:stages.filter(s=>s==='Completed').length,
  awaitingConfirmation:active.filter(b=>b.status==='AUTHORIZED').length,
  awaitingQuote:snapshot.opportunities.filter(o=>['SENT','ACCEPTED'].includes(o.status)&&Date.parse(o.data.responseDeadline)>now).length,
  complete:!snapshot.partial&&!unresolved};
}
