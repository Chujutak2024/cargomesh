import {QuoteHistorySchema} from '@/shared/schemas/v2/quote-automation';
/** Historical quotes describe prior evidence, never a current carrier offer. */
export function quoteHistoryScript(raw:unknown){
 const rows=QuoteHistorySchema.parse(raw);
 if(!rows.length)return 'No similar requests from this organization are recorded. Do not invent a historical price or estimated offer.';
 const priced=rows.filter(row=>row.quotedPrices.length);
 if(!priced.length)return 'Similar requests exist, but none have a recorded carrier price. Do not invent an estimate.';
 return 'Historical references from this organization only; these are not current offers, capacity commitments or predictions. '
  +priced.slice(0,1).map(row=>`${row.reference}, ${row.totalWeightKg} kg, ${row.totalVolumeM3} cubic metres: ${row.quotedPrices.slice(0,1).map(p=>`${p.currency} ${p.amount.toFixed(2)} quoted ${p.issuedAt} (${p.status})`).join('; ')}.`).join(' ')
  +' Explain differences in weight, volume, dates and requirements. A new carrier quote and explicit client authorization are required.';
}
export function quoteVoiceScript(current:{count:number;options:{position:number;price:string}[];recommended:number|null;status:string;weight:number;volume:number;origin:string;destination:string},historical:string){
 return `Current request ${current.origin.slice(0,60)} to ${current.destination.slice(0,60)}, ${current.weight} kg, ${current.volume} cubic metres, status ${current.status}. `
  +`${current.count} current Carrier offers. `+(current.options.length?current.options.map(o=>`Ranked option ${o.position}: ${o.price}.`).join(' '):'No current ranked plan is available. ')
  +(current.recommended===null?'Do not recommend a plan. ':`The stored backend policy recommends reviewing option ${current.recommended}. `)
  +'Review validity, breakdown and terms on screen. No booking or departure is confirmed by this conversation. '
  +historical;
}
