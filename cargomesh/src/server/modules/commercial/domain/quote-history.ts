import type {z} from 'zod';
import type {WorkflowRecordV2Schema} from '@/shared/schemas/v2/workflow';
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
export type QuoteVoiceOption={position:number;price:string;truckCount?:number;pickupAt?:string|null;deliveryAt?:string|null;simulated?:boolean};
export function quoteVoiceScript(current:{count:number;options:QuoteVoiceOption[];recommended:number|null;status:string;weight:number;volume:number;origin:string;destination:string},historical:string){
 return `Current request ${current.origin.slice(0,60)} to ${current.destination.slice(0,60)}, ${current.weight} kg, ${current.volume} cubic metres, status ${current.status}. `
  +`${current.count} current Carrier offers. `+(current.options.length?current.options.map(o=>`Ranked option ${o.position}: ${o.price}.`+(o.truckCount===undefined?'':` ${o.truckCount} carrying truck(s).`)+(o.pickupAt?` Quoted pickup ${o.pickupAt}.`:'')+(o.deliveryAt?` Quoted delivery ${o.deliveryAt}.`:'')+(o.simulated?' Simulated offer evidence.':'')).join(' '):'No current ranked plan is available. ')
  +(current.recommended===null?'Do not recommend a plan. ':`The stored backend policy recommends reviewing option ${current.recommended}. `)
  +'Review validity, breakdown and terms on screen. No booking or departure is confirmed by this conversation. '
  +historical;
}

type VoiceWorkflowRow=z.infer<typeof WorkflowRecordV2Schema>;
/** Only enrich options already validated by the authorized commercial reader. Never rerank or expose costs. */
export function quoteVoicePlanFacts(options:Array<{position:number;price:string;planId:string}>,context:{plans:Array<Extract<VoiceWorkflowRow,{kind:'plans'}>>;offers:Array<Extract<VoiceWorkflowRow,{kind:'offers'}>>;ranking:Extract<VoiceWorkflowRow,{kind:'ranking'}>|null}):QuoteVoiceOption[]{
 return options.map(option=>{
  const ranked=context.ranking?.data.options.find(r=>r.position===option.position&&r.planId===option.planId),plan=context.plans.find(p=>p.id===option.planId);
  if(!ranked||!plan)return {position:option.position,price:option.price};
  const offers=ranked.offerIds.flatMap(id=>{const o=context.offers.find(o=>o.id===id);return o?[o]:[];});
  if(offers.length!==ranked.offerIds.length)return {position:option.position,price:option.price};
  const trucks=new Set(plan.data.legAssignments.flatMap(leg=>leg.resources.filter(r=>r.resource.role==='LOAD_BEARING'&&r.resource.assetId!==null).map(r=>r.resource.assetId!)));
  const pickups=offers.map(o=>o.data.estimatedPickupAt),deliveries=offers.map(o=>o.data.estimatedDeliveryAt);
  const allDates=(dates:Array<string|null>)=>dates.every(d=>d!==null&&Number.isFinite(Date.parse(d)));
  return {position:option.position,price:option.price,...(trucks.size?{truckCount:trucks.size}:{}),pickupAt:allDates(pickups)?new Date(Math.min(...pickups.map(d=>Date.parse(d!)))).toISOString():null,deliveryAt:allDates(deliveries)?new Date(Math.max(...deliveries.map(d=>Date.parse(d!)))).toISOString():null,simulated:offers.some(o=>o.data.source.evidence.provenanceStatus==='SIMULATED')};
 });
}
