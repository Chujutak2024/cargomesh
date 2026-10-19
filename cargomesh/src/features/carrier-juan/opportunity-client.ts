import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import {portalRequest,PortalApiError} from '@/features/carrier-portal/api';
import {parseCommercialRecord,responseValue,type Opportunity} from '@/features/carrier-portal/commercial-model';
import {validCarrierId} from '@/features/carrier-portal/records';
import type {CarrierPortalRole} from '@/features/carrier-portal/permissions';
import {canRespondOpportunity} from './opportunity-model';

export async function readOpportunities(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const page=await readFleetResource(carrierId,'opportunities',signal,fetcher);
 return {carrierId,rows:page.records.map(row=>parseCommercialRecord('opportunities',row,carrierId)),partial:page.truncated,readAt:new Date().toISOString()};
}
export async function respondOpportunity(options:{carrierId:string;role:CarrierPortalRole;row:Opportunity;response:'ACCEPTED'|'DECLINED';note:string;evidence:unknown;key:string;signal:AbortSignal},fetcher:typeof fetch=fetch,now=Date.now()){
 const {row,carrierId}=options;
 if(!validCarrierId(carrierId)||!validCarrierId(row.id)||!validCarrierId(options.key)||row.carrierId!==carrierId)throw new PortalApiError(400,'INVALID_COMMERCIAL_SCOPE');
 if(!canRespondOpportunity(row,options.role,now))throw new PortalApiError(409,'OPPORTUNITY_RESPONSE_UNAVAILABLE');
 const body=responseValue(row,options.response,options.note,options.evidence);
 const result=await portalRequest(`/api/v2/carriers/${carrierId}/opportunities/${row.id}/responses`,{method:'POST',signal:options.signal,headers:{'Content-Type':'application/json','Idempotency-Key':options.key},body:JSON.stringify(body)},fetcher);
 const saved=parseCommercialRecord('opportunities',result.data,carrierId,row.id);
 if(saved.requestId!==row.requestId||saved.organizationId!==row.organizationId||saved.status!==options.response)throw new PortalApiError(502,'INVALID_COMMERCIAL_SCOPE');
 return saved;
}
