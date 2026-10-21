import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {QuoteHistorySchema,QuoteSearchInputSchema,QuoteSearchResponseSchema} from '@/shared/schemas/v2/quote-automation';
import {ShipperApiError} from './shipper-api';
async function json(path:string,init:RequestInit){
 const r=await workspaceFetch(path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...init.headers}});
 const body=await r.json().catch(()=>null);
 if(!r.ok)throw new ShipperApiError(body?.error?.code??'QUOTE_UNAVAILABLE',body?.error?.message??'Quotation service unavailable.',r.status,r.status>=500);
 return body;
}
export async function findRequestQuotes(id:string,input:unknown,key:string){
 return QuoteSearchResponseSchema.parse(await json(`/api/v2/freight/requests/${encodeURIComponent(id)}/quotes`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(QuoteSearchInputSchema.parse(input))})).data;
}
export async function readSimilarRequests(id:string,signal?:AbortSignal){
 const body=await json(`/api/v2/freight/requests/${encodeURIComponent(id)}/similar-cases`,{method:'GET',signal});
 return QuoteHistorySchema.parse(body.data);
}
