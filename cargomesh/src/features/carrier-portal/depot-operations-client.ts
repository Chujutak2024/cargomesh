import {portalRequest,portalErrorCopy,PortalApiError} from './api';
import {readFleetResource} from './fleet-client';
import {parseDepotRecord} from '@/shared/schemas/v2/depot-operations';
import {validCarrierId,type PortalRecord} from './records';
type DepotRecord=ReturnType<typeof parseDepotRecord>;
/** Missing operational dependencies do not hide the readable policy or physical depot. */
export async function readDepotOperations(carrierId:string,depotId:string,signal:AbortSignal,fetcher:typeof fetch=fetch) {
 if(!validCarrierId(carrierId)||!validCarrierId(depotId))throw new PortalApiError(400,'INVALID_API_PATH');
 const base='/api/v2/carrier-portal/carriers/'+carrierId+'/depots/'+depotId+'/operations';
 const results=await Promise.allSettled([
  portalRequest(base,{signal},fetcher).then(p=>({record:p.data===null?null:parseDepotRecord('policy',p.data),partial:p.meta?.partial===true})),
  portalRequest(base+'/appointments',{signal},fetcher).then(a=>{if(!Array.isArray(a.data))throw new PortalApiError(502,'INVALID_RESPONSE');return {records:a.data.map(raw=>parseDepotRecord('appointment',raw)),partial:a.meta?.partial===true||a.meta?.nextOffset!=null};}),
  readFleetResource(carrierId,'executions',signal,fetcher)
 ]);
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const denied=results.find(r=>r.status==='rejected'&&r.reason instanceof PortalApiError&&[401,403].includes(r.reason.status));
 if(denied?.status==='rejected')throw denied.reason;
 const [p,a,e]=results;
 const policy=p.status==='fulfilled'?p.value.record:null,appointments=a.status==='fulfilled'?a.value.records:[];
 if([...(policy?[policy]:[]),...appointments].some(r=>r.carrierId!==carrierId||r.depotId!==depotId)||policy&&policy.id!==depotId)throw new PortalApiError(502,'INVALID_RESPONSE');
 const issues=results.flatMap((r,i)=>r.status==='rejected'?[(i===0?'Policy':i===1?'Appointments':'Executions')+': '+(r.reason instanceof PortalApiError&&r.reason.code==='DEPOT_OPERATIONS_NOT_INSTALLED'?'Depot operations are not installed in this environment.':portalErrorCopy(r.reason,false))]:[]);
 const partial=issues.length>0||p.status==='fulfilled'&&p.value.partial||a.status==='fulfilled'&&a.value.partial||e.status==='fulfilled'&&e.value.truncated;
 return {policy:policy as DepotRecord|null,appointments,executions:e.status==='fulfilled'?e.value.records:[] as PortalRecord[],issues,partial};
}
