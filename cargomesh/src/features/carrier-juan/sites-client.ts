import {PortalApiError, portalErrorCopy} from '@/features/carrier-portal/api';
import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import type {PortalRecord} from '@/features/carrier-portal/records';

/** Independent reads keep physical depots visible when service coverage is unavailable. */
async function readGroup(carrierId:string, keys:readonly string[], signal:AbortSignal, fetcher:typeof fetch, serviceId='') {
 const results=await Promise.allSettled(keys.map(key=>readFleetResource(carrierId,key,signal,fetcher,serviceId)));
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const denied=results.find(r=>r.status==='rejected'&&r.reason instanceof PortalApiError&&[401,403].includes(r.reason.status));
 if(denied?.status==='rejected')throw denied.reason;
 const records:Record<string,PortalRecord[]>={},issues:string[]=[];
 results.forEach((result,i)=>{records[keys[i]]=result.status==='fulfilled'?result.value.records:[];
  if(result.status==='rejected')issues.push(keys[i]+': '+portalErrorCopy(result.reason,false));
  else if(result.value.truncated)issues.push(keys[i]+': Partial catalog.');
 });
 return {records,issues,partial:issues.length>0};
}
export async function readSitesCatalog(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch) {
 const result=await readGroup(carrierId,['depots','services','partners'],signal,fetcher);
 return {carrierId,depots:result.records.depots,services:result.records.services,partners:result.records.partners,
  issues:result.issues,partial:result.partial};
}
export async function readServiceCoverage(carrierId:string,serviceId:string,signal:AbortSignal,fetcher:typeof fetch=fetch) {
 const result=await readGroup(carrierId,['areas','lanes'],signal,fetcher,serviceId);
 return {carrierId,serviceId,areas:result.records.areas,lanes:result.records.lanes,issues:result.issues,partial:result.partial};
}
