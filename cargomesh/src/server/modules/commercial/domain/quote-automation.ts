import type {QuotePolicyValue} from '@/shared/schemas/v2/quote-automation';
import type {RoadCandidateV2} from '@/shared/schemas/v2/serviceability';
/** Money is rounded once per quoted component, never invented from a request alone. */
export function calculateCarrierTariff(policy:QuotePolicyValue,distanceKm:number|null){
 if(policy.basis==='PER_KM'&&(distanceKm===null||!Number.isFinite(distanceKm)||distanceKm<=0))return null;
 const transport=Math.max(Math.round(policy.minimumAmount*100),Math.round((policy.baseAmount+(policy.basis==='PER_KM'?distanceKm!*policy.ratePerKm:0))*100));
 const extras=[policy.fuelAmount,policy.tollAmount,policy.handlingAmount,policy.taxAmount].map(v=>Math.round(v*100));
 const total=transport+extras.reduce((a,b)=>a+b,0);
 return Number.isSafeInteger(total)&&total>0&&total<=1e12?{transportCents:transport,totalCents:total}:null;
}
/** Show three after ranking the complete known universe; never prefilter providers to three. */
export function quoteCandidate(candidate:RoadCandidateV2){
 const c=candidate.checks;
 if(candidate.service.serviceClass!=='FTL'||candidate.status!=='eligible'||[c.coverage,c.lane,c.cargoAndEquipment,c.capacityWindow].some(x=>x.status!=='eligible')
  ||!c.lane.laneId||!c.capacityWindow.calendarId||!c.capacityWindow.sourceId||!c.capacityWindow.sourceType)return null;
 return {serviceId:candidate.service.id,laneId:c.lane.laneId,calendarId:c.capacityWindow.calendarId,
  assetId:c.capacityWindow.sourceType==='TRANSPORT_ASSET'?c.capacityWindow.sourceId:null,
  poolId:c.capacityWindow.sourceType==='CAPACITY_POOL'?c.capacityWindow.sourceId:null};
}
export function recommendedQuoteOptions<T>(options:readonly T[]){return options.slice(0,3);}
