import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import {canCarrierAction} from '@/features/carrier-portal/permissions';
import type {CarrierPortalRole} from '@/features/carrier-portal/permissions';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
const labels:Record<string,string>={SENT:'Awaiting response',ACCEPTED:'Accepted for review',DECLINED:'Declined',OFFERED:'Offer issued',EXPIRED:'Expired',CANCELLED:'Cancelled'};
export const opportunityLabel=(status:string)=>labels[status]??'Needs review';
export const opportunityReference=(row:Opportunity)=>'Opportunity '+row.id.slice(-8).toUpperCase();
export function canRespondOpportunity(row:Opportunity,role:CarrierPortalRole,now:number){
 return canCarrierAction(role,'opportunities.respond',row.status)&&Number.isFinite(now)&&Date.parse(row.data.responseDeadline)>now;
}
export function requestedWindow(raw:unknown){const parsed=TimeWindowV2Schema.safeParse(raw);return parsed.success?parsed.data:null;}
export function opportunityFacts(row:Opportunity){
 const cargo=row.data.cargoSpecification;
 const nonnegative=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
 return {reference:opportunityReference(row),origin:row.data.origin.city??row.data.origin.label,destination:row.data.destination.city??row.data.destination.label,
  description:typeof cargo.description==='string'&&cargo.description.trim()?cargo.description:cargo.categoryCode,
  weightKg:nonnegative(cargo.totalWeightKg),volumeM3:nonnegative(cargo.totalVolumeM3),
  pickup:requestedWindow(row.data.pickupWindow),delivery:requestedWindow(row.data.deliveryWindow),
  resourceWindows:row.data.assignmentSnapshots.flatMap(snapshot=>{const window=requestedWindow(snapshot.window);return window?[{id:snapshot.id,window}]:[];})};
}
export function opportunityIdFromHash(hash:string){
 const raw=hash.match(/^#\/shipments\/details\/([^/?#]+)/)?.[1];
 if(!raw)return null;
 try{const id=decodeURIComponent(raw);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)?id:null;}catch{return null;}
}
export const displayOpportunityDate=(value:string)=>new Date(value).toLocaleString('en-US',{timeZone:'UTC'})+' UTC';
