import {z} from 'zod';
import {WorkflowRecordV2Schema,WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {portalRequest,PortalApiError,portalErrorCopy} from '@/features/carrier-portal/api';
import {readCommercial} from '@/features/carrier-portal/commercial-client';
import type {Execution,Booking} from '@/features/carrier-portal/commercial-model';
import {validCarrierId} from '@/features/carrier-portal/records';
import {sameOrderScope} from './orders-model';
export type Incident=Extract<z.infer<typeof WorkflowRecordV2Schema>,{kind:'incidents'}>;
export type IncidentUpdate=Extract<z.infer<typeof WorkflowRecordV2Schema>,{kind:'incident-updates'}>;
export type IncidentEntry={record:Incident;execution:Execution;booking:Booking|null};
export type IncidentAction='NOTE'|'RESOLVE'|'REOPEN';
export const ordersTab=(hash:string)=>/^#\/(?:tracking|orders)\/incidents(?:\/|$)/.test(hash)?'incidents':'orders';
const assertExecution=(carrierId:string,e:Execution)=>{if(!validCarrierId(carrierId)||!validCarrierId(e.id)||e.carrierId!==carrierId)throw new PortalApiError(400,'INVALID_INCIDENT_SCOPE');};
export function incidentPath(carrierId:string,e:Execution,incident?:Incident){
 assertExecution(carrierId,e);
 if(incident){if(!validCarrierId(incident.id)||!sameOrderScope(incident,e))throw new PortalApiError(400,'INVALID_INCIDENT_SCOPE');return `/api/v2/carriers/${carrierId}/incidents/${incident.id}/updates`;}
 return `/api/v2/carriers/${carrierId}/executions/${e.id}/incidents`;
}
function parseIncident(raw:unknown,e:Execution):Incident{
 const parsed=WorkflowRecordV2Schema.safeParse(raw);
 if(!parsed.success||parsed.data.kind!=='incidents'||!sameOrderScope(parsed.data,e)||parsed.data.status!==parsed.data.data.status||parsed.data.data.executionId!==undefined&&parsed.data.data.executionId!==e.id)throw new PortalApiError(502,'INVALID_INCIDENT_SCOPE');
 return parsed.data;
}
async function collection(path:string,signal:AbortSignal,fetcher:typeof fetch){
 const rows:unknown[]=[];const offsets=new Set<number>();let offset:number|null=0,partial=false;
 for(let page=0;page<10&&offset!==null;page++){
  if(offsets.has(offset))throw new PortalApiError(502,'INVALID_RESPONSE');offsets.add(offset);
  const result=await portalRequest(`${path}?limit=100&offset=${offset}`,{signal},fetcher);
  if(!Array.isArray(result.data)||result.data.length>100)throw new PortalApiError(502,'INVALID_RESPONSE');
  rows.push(...result.data);partial ||= result.meta?.partial===true;offset=result.meta?.nextOffset??null;
 }
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 return {rows,partial:partial||offset!==null};
}
export async function readIncidentCollection(carrierId:string,e:Execution,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const page=await collection(incidentPath(carrierId,e),signal,fetcher),records=page.rows.map(raw=>parseIncident(raw,e));
 if(new Set(records.map(r=>r.id)).size!==records.length)throw new PortalApiError(502,'INVALID_RESPONSE');
 return {records,partial:page.partial};
}
export async function readIncidents(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const commercial=await readCommercial(carrierId,signal,fetcher),entries:IncidentEntry[]=[],issues:string[]=[];
 const seen=new Set<string>();
 for(let i=0;i<commercial.executions.length;i+=4){
  const batch=commercial.executions.slice(i,i+4),results=await Promise.allSettled(batch.map(e=>readIncidentCollection(carrierId,e,signal,fetcher)));
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  for(let j=0;j<results.length;j++){
   const result=results[j],execution=batch[j];
   if(result.status==='rejected'){
    if(result.reason instanceof PortalApiError&&([401,403].includes(result.reason.status)||result.reason.code==='INVALID_INCIDENT_SCOPE'))throw result.reason;
    issues.push(`Operation ${execution.id.slice(-8)}: ${portalErrorCopy(result.reason,false)}`);continue;
   }
   if(result.value.partial)issues.push(`Operation ${execution.id.slice(-8)}: partial incident history.`);
   const booking=commercial.bookings.find(b=>b.id===execution.data.bookingId&&sameOrderScope(b,execution))??null;
   for(const record of result.value.records){if(seen.has(record.id))throw new PortalApiError(502,'INVALID_INCIDENT_SCOPE');seen.add(record.id);entries.push({record,execution,booking});}
  }
 }
 return {carrierId,entries,executions:commercial.executions,bookings:commercial.bookings,partial:commercial.partial||issues.length>0,issues,readAt:commercial.readAt};
}
export async function readIncidentHistory(carrierId:string,entry:IncidentEntry,signal:AbortSignal,fetcher:typeof fetch=fetch){
 incidentPath(carrierId,entry.execution,entry.record);
 const page=await collection(`/api/v2/carriers/${carrierId}/incidents/${entry.record.id}/updates`,signal,fetcher);
 const records=page.rows.map(raw=>{
  const parsed=WorkflowRecordV2Schema.safeParse(raw);
  if(!parsed.success||parsed.data.kind!=='incident-updates'||!sameOrderScope(parsed.data,entry.record)||parsed.data.data.incidentId!==undefined&&parsed.data.data.incidentId!==entry.record.id)throw new PortalApiError(502,'INVALID_INCIDENT_SCOPE');
  return parsed.data;
 });
 if(new Set(records.map(r=>r.id)).size!==records.length)throw new PortalApiError(502,'INVALID_RESPONSE');
 return {records,partial:page.partial};
}
export function incidentFormSchema(entry?:IncidentEntry,action:IncidentAction='NOTE'){
 return entry?WorkflowInputsV2['incidents.update'].omit({expectedVersion:true,action:true}).transform(value=>({...value,expectedVersion:entry.record.version,action})):WorkflowInputsV2['incidents.create'];
}
export function validateIncidentSaved(raw:unknown,e:Execution,previous?:Incident,action?:IncidentAction){
 const saved=parseIncident(raw,e);
 if(previous&&(saved.id!==previous.id||saved.version<=previous.version||saved.status!==(action==='RESOLVE'?'RESOLVED':action==='REOPEN'?'OPEN':previous.status)))throw new PortalApiError(502,'INVALID_INCIDENT_RESPONSE');
 if(!previous&&saved.status!=='OPEN')throw new PortalApiError(502,'INVALID_INCIDENT_RESPONSE');
 return saved;
}
