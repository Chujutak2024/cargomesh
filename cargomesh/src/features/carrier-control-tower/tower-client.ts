import {portalRequest,PortalApiError,portalErrorCopy} from '@/features/carrier-portal/api';
import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import {parseCommercialRecord} from '@/features/carrier-portal/commercial-model';
import {validCarrierId,type PortalRecord} from '@/features/carrier-portal/records';
import {towerKeys,type TowerSnapshot,type TowerKey} from './tower-model';

export async function readTower(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<TowerSnapshot>{
 if(!validCarrierId(carrierId))throw new PortalApiError(400,'INVALID_CARRIER_SCOPE');
 const results=await Promise.allSettled(towerKeys.map(key=>readFleetResource(carrierId,key,signal,fetcher)));
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const denied=results.find(result=>result.status==='rejected'&&result.reason instanceof PortalApiError&&[401,403].includes(result.reason.status));
 if(denied?.status==='rejected')throw denied.reason;
 const records={} as Record<TowerKey,PortalRecord[]>,loaded={} as Record<TowerKey,boolean>,issues:string[]=[];
 results.forEach((result,i)=>{const key=towerKeys[i];loaded[key]=result.status==='fulfilled';records[key]=result.status==='fulfilled'?result.value.records:[];
  if(result.status==='rejected')issues.push(key+': '+portalErrorCopy(result.reason,false));else if(result.value.truncated)issues.push(key+': Partial read.');});
 return {carrierId,records,loaded,issues,partial:issues.length>0,readAt:new Date().toISOString()};
}
export type TowerIncident=ReturnType<typeof parseCommercialRecord<'incidents'>>;
export async function readTowerIncidents(carrierId:string,execution:{id:string;requestId:string|null;organizationId:string|null},signal:AbortSignal,fetcher:typeof fetch=fetch){
 const executionId=execution.id;
 if(!validCarrierId(carrierId)||!validCarrierId(executionId))throw new PortalApiError(400,'INVALID_EXECUTION_SCOPE');
 const rows:TowerIncident[]=[];const offsets=new Set<number>();let offset:number|null=0,partial=false;
 for(let page=0;page<10&&offset!==null;page++){
  if(offsets.has(offset))throw new PortalApiError(502,'INVALID_RESPONSE');offsets.add(offset);
  const response=await portalRequest(`/api/v2/carriers/${carrierId}/executions/${executionId}/incidents?limit=100&offset=${offset}`,{signal},fetcher);
  if(!Array.isArray(response.data)||response.data.length>100)throw new PortalApiError(502,'INVALID_RESPONSE');
  const parsed=response.data.map(raw=>parseCommercialRecord('incidents',raw,carrierId));
  if(new Set(parsed.map(r=>r.id)).size!==parsed.length||parsed.some(r=>rows.some(p=>p.id===r.id)||r.requestId!==execution.requestId||r.organizationId!==execution.organizationId||r.data.executionId!==undefined&&r.data.executionId!==executionId))throw new PortalApiError(502,'INVALID_EXECUTION_SCOPE');
  rows.push(...parsed);partial ||= response.meta?.partial===true;offset=response.meta?.nextOffset??null;
 }
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 return {executionId,rows,partial:partial||offset!==null};
}
