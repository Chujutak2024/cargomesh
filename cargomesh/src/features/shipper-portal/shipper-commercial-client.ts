import {z} from 'zod';
import {FreightRequestV2ResponseSchema} from '@/shared/schemas/v2/freight-request';
import {WorkflowRecordV2Schema,type WorkflowActionV2} from '@/shared/schemas/v2/workflow';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {ShipperApiError} from './shipper-api';
type RecordV2=z.infer<typeof WorkflowRecordV2Schema>;
const Envelope=z.object({schemaVersion:z.literal('2.0'),data:z.array(WorkflowRecordV2Schema),meta:z.object({nextOffset:z.number().int().nonnegative().nullable().optional()}).passthrough().optional()}).passthrough();
async function request(path:string,signal:AbortSignal,fetcher:typeof fetch){const r=await fetcher(path,{signal,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});const body=await r.json();if(!r.ok)throw new ShipperApiError(typeof body?.error?.code==='string'?body.error.code:'API_ERROR','Unable to refresh commercial records.',r.status,r.status>=500);return body;}
export async function refreshRequestCommercial(id:string,organizationId:string,signal:AbortSignal,fetcher:typeof fetch=workspaceFetch){
 z.string().uuid().parse(id);z.string().uuid().parse(organizationId);
 const requestRow=FreightRequestV2ResponseSchema.parse(await request('/api/v2/freight/requests/'+id,signal,fetcher)).data;
 if(requestRow.id!==id||requestRow.organizationId!==organizationId)throw new ShipperApiError('INVALID_SCOPE','Request scope changed.',403,false);
 const groups=await Promise.all((['opportunities','offers','ranking','decisions','bookings'] as const).map(async kind=>{
  let offset:number|null=0;const rows:RecordV2[]=[],seen=new Set<number>(),ids=new Set<string>();
  for(let n=0;n<10&&offset!==null;n++){
   if(seen.has(offset))throw new ShipperApiError('INVALID_RESPONSE','Repeated page.',502,false);seen.add(offset);
   const body=Envelope.parse(await request(`/api/v2/freight/requests/${id}/${kind}?limit=100&offset=${offset}`,signal,fetcher));
   if(body.data.length>100||body.data.some(r=>r.kind!==kind||r.requestId!==id||r.organizationId!==organizationId||ids.has(r.id))||new Set(body.data.map(r=>r.id)).size!==body.data.length)throw new ShipperApiError('INVALID_SCOPE','Commercial record scope mismatch.',403,false);
   for(const row of body.data)ids.add(row.id);rows.push(...body.data);offset=body.meta?.nextOffset??null;
  }
  if(offset!==null)throw new ShipperApiError('PARTIAL_COMMERCIAL_READ','The commercial history is too large for this view.',503,true);
  return [kind,rows] as const;
 }));
 return {request:requestRow,workflow:Object.fromEntries(groups)};
}
