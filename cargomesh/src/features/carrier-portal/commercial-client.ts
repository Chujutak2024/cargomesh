import {readFleetResource} from './fleet-client';
import {portalRequest,PortalApiError} from './api';
import {parseCommercialRecord,type CommercialSnapshot} from './commercial-model';
import {validCarrierId} from './records';
export async function readCommercial(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<CommercialSnapshot>{
 const keys=['opportunities','offers','bookings','executions'] as const;
 const data=await Promise.all(keys.map(async key=>{const page=await readFleetResource(carrierId,key,signal,fetcher);return {key,records:page.records.map(r=>parseCommercialRecord(key,r,carrierId)),partial:page.truncated};}));
 return {...Object.fromEntries(data.map(d=>[d.key,d.records])),partial:data.some(d=>d.partial),readAt:new Date().toISOString()} as CommercialSnapshot;
}
export async function readCommercialDetail<K extends 'opportunities'|'offers'|'bookings'>(carrierId:string,kind:K,id:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(!validCarrierId(carrierId)||!validCarrierId(id))throw new PortalApiError(400,'INVALID_API_PATH');
 const result=await portalRequest(`/api/v2/carriers/${carrierId}/${kind}/${id}`,{signal},fetcher);
 return parseCommercialRecord(kind,result.data,carrierId,id);
}
