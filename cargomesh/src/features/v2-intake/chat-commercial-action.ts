import type {CommercialContext} from "@/features/shipper-portal/commercial-context";
import {inspectOffer,inspectRankedOption} from "@/features/shipper-portal/commercial-context";
import {refreshRequestCommercial} from "@/features/shipper-portal/shipper-commercial-client";
import {selectCommercialOption,authorizeBooking} from "@/features/shipper-portal/shipper-api";
import {prepareBookingCapacity} from "@/features/shipper-portal/booking-preparation-client";
import type {CommercialIntent} from "@/features/shipper-portal/commercial-intent";
import {latestRecord,type WorkflowRecordV2} from "@/features/shipper-portal/shipper-model";

type Row<K extends WorkflowRecordV2["kind"]>=Extract<WorkflowRecordV2,{kind:K}>;
function rows<K extends WorkflowRecordV2["kind"]>(input:WorkflowRecordV2[],kind:K){return input.filter((r):r is Row<K>=>r.kind===kind);}
export type CommercialChatState={context:CommercialContext;decisions:Row<"decisions">[];bookings:Row<"bookings">[]};
export async function readCommercialChatState(id:string,organizationId:string):Promise<CommercialChatState>{
 const fresh=await refreshRequestCommercial(id,organizationId,new AbortController().signal),w=fresh.workflow;
 return {context:{request:fresh.request,offers:rows(w.offers??[],"offers"),plans:rows(w.plans??[],"plans"),opportunities:rows(w.opportunities??[],"opportunities"),ranking:latestRecord(rows(w.ranking??[],"ranking"))},decisions:rows(w.decisions??[],"decisions"),bookings:rows(w.bookings??[],"bookings")};
}
export type PreparedCommercialAction={kind:"SELECT"|"BOOK";requestId:string;organizationId:string;requestVersion:number;optionIndex:number;signature:string;expiresAt:number;decisionId:string|null;offers:CommercialContext["offers"];totalCents:number;request:CommercialContext["request"]};
function same(a:string[],b:string[]){return a.length===b.length&&a.every(id=>b.includes(id));}
export function prepareCommercialAction(state:CommercialChatState,kind:"SELECT"|"BOOK",index:number,now=Date.now()):PreparedCommercialAction{
 const c=state.context;
 if(c.request.status==="DRAFT"||c.request.status==="CANCELLED")throw new Error("REQUEST_NOT_SUBMITTED");
 const decision=latestRecord(state.decisions.filter(row=>row.organizationId===c.request.organizationId&&row.requestId===c.request.id&&row.data.status==="SELECTED"&&row.data.policyId===c.ranking?.data.policyId&&row.data.policyVersion===c.ranking?.data.policyVersion));
 if(kind==="BOOK"){
  if(!decision)throw new Error("SELECT_FIRST");
  index=c.ranking?.data.options.findIndex(option=>option.planId===decision.data.planId&&same(option.offerIds,decision.data.selectedOfferIds))??-1;
 }
 const option=c.ranking?.data.options[index];
 if(!Number.isInteger(index)||index<0||!option||!inspectRankedOption(option,c,now).available)throw new Error("OFFER_UNAVAILABLE");
 const offers=option.offerIds.map(id=>c.offers.find(row=>row.id===id)!);
 const signature=JSON.stringify([kind,c.request.id,c.request.organizationId,c.request.draftVersion,c.ranking!.id,c.ranking!.version,c.ranking!.data.policyId,option,offers.map(row=>[row.id,row.version,row.data.offerVersion,row.data.price,row.data.validity,row.status]),kind==="BOOK"?decision?.id:null]);
 return {kind,requestId:c.request.id,organizationId:c.request.organizationId,requestVersion:c.request.draftVersion,optionIndex:index,signature,expiresAt:Math.min(now+300000,...offers.map(row=>Date.parse(row.data.validity.endsAt))),decisionId:kind==="BOOK"?decision!.id:null,offers,request:c.request,totalCents:option.costCents};
}
type Deps={read:typeof readCommercialChatState;select:typeof selectCommercialOption;book:typeof authorizeBooking;capacity:typeof prepareBookingCapacity;now:()=>number;newKey:()=>string};
const defaults:Deps={read:readCommercialChatState,select:selectCommercialOption,book:authorizeBooking,capacity:prepareBookingCapacity,now:Date.now,newKey:()=>crypto.randomUUID()};
function intent(keys:Map<string,CommercialIntent>,key:string,d:Deps){if(!keys.has(key))keys.set(key,{idempotencyKey:d.newKey(),observedAt:new Date(d.now()).toISOString()});return keys.get(key)!;}
/** A proposal cannot execute itself. Native services retain authority over roles, versions and capacity. */
export async function confirmCommercialAction(prepared:PreparedCommercialAction,confirmed:boolean,keys:Map<string,CommercialIntent>,dependencies:Partial<Deps>={}){
 if(!confirmed)throw new Error("CONSENT_REQUIRED");
 const d={...defaults,...dependencies};
 if(d.now()>=prepared.expiresAt)throw new Error("REVIEW_EXPIRED");
 let state=await d.read(prepared.requestId,prepared.organizationId);
 const c=state.context;
 if(c.request.id!==prepared.requestId||c.request.organizationId!==prepared.organizationId)throw new Error("INVALID_SCOPE");
 if(c.request.draftVersion!==prepared.requestVersion)throw new Error("STALE_DRAFT");
 const fresh=prepareCommercialAction(state,prepared.kind,prepared.optionIndex,d.now());
 if(fresh.signature!==prepared.signature)throw new Error("REVIEW_CHANGED");
 const option=c.ranking!.data.options[prepared.optionIndex];
 if(prepared.kind==="SELECT"){
  const prior=state.decisions.find(row=>row.organizationId===c.request.organizationId&&row.requestId===c.request.id&&row.data.status==="SELECTED"&&row.data.policyId===c.ranking?.data.policyId&&row.data.policyVersion===c.ranking?.data.policyVersion&&row.data.planId===option.planId&&same(row.data.selectedOfferIds,option.offerIds));
  if(prior)return {kind:"SELECT" as const,receipts:[prior]};
  const saved=await d.select({requestId:c.request.id,planId:option.planId,offerIds:[...option.offerIds].sort(),consideredOfferIds:c.offers.filter(row=>inspectOffer(row,c,d.now()).current).map(row=>row.id).sort(),policyId:c.ranking!.data.policyId,rationale:"Alternative reviewed and explicitly selected in CargoMesh assistant UI.",intent:intent(keys,prepared.signature,d)});
  if(saved.organizationId!==prepared.organizationId||saved.requestId!==prepared.requestId)throw new Error("INVALID_RECEIPT");
  state=await d.read(prepared.requestId,prepared.organizationId);
  const receipt=state.decisions.find(row=>row.id===saved.id&&row.organizationId===prepared.organizationId&&row.requestId===prepared.requestId&&row.data.status==="SELECTED"&&row.data.planId===option.planId&&row.data.policyId===c.ranking!.data.policyId&&row.data.policyVersion===c.ranking!.data.policyVersion&&same(row.data.selectedOfferIds,option.offerIds));
  if(!receipt)throw new Error("RECEIPT_NOT_VERIFIED");
  return {kind:"SELECT" as const,receipts:[receipt]};
 }
 const receipts:Row<"bookings">[]=[];
 for(const offer of fresh.offers){
  const existing=state.bookings.find(row=>row.data.decisionId===fresh.decisionId&&row.data.offerId===offer.id&&row.data.authorizationStatus==="AUTHORIZED"&&!['CANCELLED','REJECTED'].includes(row.data.carrierConfirmationStatus));
  const booking=existing??await d.book({decisionId:fresh.decisionId!,offerId:offer.id,intent:intent(keys,`${prepared.signature}:${offer.id}`,d)});
  if(booking.kind!=="bookings"||booking.requestId!==prepared.requestId||booking.organizationId!==prepared.organizationId||booking.carrierId!==offer.carrierId)throw new Error("INVALID_RECEIPT");
  if(booking.data.carrierConfirmationStatus!=="CONFIRMED")await d.capacity(booking.id,booking.version,intent(keys,`capacity:${booking.id}:${booking.version}`,d).idempotencyKey);
 }
 state=await d.read(prepared.requestId,prepared.organizationId);
 for(const offer of fresh.offers){const booking=state.bookings.find(row=>row.data.decisionId===fresh.decisionId&&row.data.offerId===offer.id&&row.organizationId===prepared.organizationId&&row.requestId===prepared.requestId&&row.carrierId===offer.carrierId&&row.data.authorizationStatus==="AUTHORIZED"&&!['CANCELLED','REJECTED'].includes(row.data.carrierConfirmationStatus));if(!booking)throw new Error("RECEIPT_NOT_VERIFIED");receipts.push(booking);}
 return {kind:"BOOK" as const,receipts};
}
export function commercialChatIntent(text:string):{kind:"SELECT"|"BOOK";index:number}|null{
 const select=/^(?:elige|selecciona|revisa|choose|select|review)\s+(?:la |the )?(?:opci[oó]n |option )?(primera|segunda|tercera|first|second|third|[1-9]\d?)[.!]?$/i.exec(text.trim());
 if(select){const indices:Record<string,number>={primera:0,segunda:1,tercera:2,first:0,second:1,third:2};return {kind:"SELECT",index:indices[select[1].toLowerCase()]??Number(select[1])-1};}
 return /^(?:prepara(?:r)? (?:la )?(?:reserva|contrataci[oó]n)|autoriza(?:r)? (?:la )?reserva|contratar|prepare booking|authorize booking|book this)[.!]?$/i.test(text.trim())?{kind:"BOOK",index:0}:null;
}
