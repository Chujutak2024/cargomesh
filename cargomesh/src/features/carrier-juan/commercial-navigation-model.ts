import {z} from 'zod';
import type {Offer,Opportunity} from '@/features/carrier-portal/commercial-model';
import {offerRelations} from './offers-model';

export type CommercialTab='list'|'board'|'offers'|'automation';
export type CommercialRoutes=Record<CommercialTab,string>;
export const commercialRoots:CommercialRoutes={list:'#/shipments',board:'#/pipeline',offers:'#/desk',automation:'#/desk/automation'};
export function commercialTab(hash:string):CommercialTab|null{
 const section=hash.split('/')[1];
 return hash==='#/desk/automation'?'automation':section==='shipments'?'list':section==='pipeline'?'board':section==='desk'?'offers':null;
}
export function rememberCommercialRoute(previous:CommercialRoutes,hash:string):CommercialRoutes{
 const tab=commercialTab(hash);
 return tab&&previous[tab]!==hash?{...previous,[tab]:hash}:previous;
}
export type OfferDestination={selection:{kind:'offers'|'opportunities';id:string}|null;prepare:boolean;invalid:boolean};
/** Legacy offer links and Request actions use the same authorized detail readers. */
export function offerDestination(hash:string):OfferDestination{
 if(hash==='#/desk')return {selection:null,prepare:false,invalid:false};
 const match=hash.match(/^#\/desk\/(details|opportunity|prepare)\/([^/?#]+)$/);
 let id:string|undefined;
 try{const parsed=z.string().uuid().safeParse(decodeURIComponent(match?.[2]??''));if(parsed.success)id=parsed.data;}catch{/* Invalid URL reference. */}
 if(!match||!id)return {selection:null,prepare:false,invalid:true};
 return {selection:{kind:match[1]==='details'?'offers':'opportunities',id},prepare:match[1]==='prepare',invalid:false};
}
/** Never infer a relationship from a shared route label or request alone. */
export function requestOfferHistory(opportunity:Opportunity,offers:Offer[]){
 return offers.filter(offer=>offerRelations(offer,opportunity)).sort((a,b)=>b.data.offerVersion-a.data.offerVersion||b.data.issuedAt.localeCompare(a.data.issuedAt)||a.id.localeCompare(b.id));
}
