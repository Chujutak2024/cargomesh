import {z} from 'zod';
import {FreightRequestV2ResponseSchema} from '@/shared/schemas/v2/freight-request';
import {WorkflowRecordV2Schema,type WorkflowActionV2} from '@/shared/schemas/v2/workflow';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {ShipperApiError} from './shipper-api';
import {commercialCatalogReferences,readCommercialCatalog} from './commercial-catalog';
type RecordV2=z.infer<typeof WorkflowRecordV2Schema>;
const Envelope=z.object({schemaVersion:z.literal('2.0'),data:z.array(WorkflowRecordV2Schema),meta:z.object({nextOffset:z.number().int().nonnegative().nullable()}).passthrough()}).passthrough();
async function request(path:string,signal:AbortSignal,fetcher:typeof fetch){const r=await fetcher(path,{signal,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});const body=await r.json().catch(()=>null);if(!r.ok)throw new ShipperApiError(typeof body?.error?.code==='string'?body.error.code:'API_ERROR','Unable to refresh commercial records.',r.status,r.status>=500);return body;}
export async function refreshRequestCommercial(id:string,organizationId:string,signal:AbortSignal,fetcher:typeof fetch=workspaceFetch){
 z.string().uuid().parse(id);z.string().uuid().parse(organizationId);
 const requestRow=FreightRequestV2ResponseSchema.parse(await request('/api/v2/freight/requests/'+id,signal,fetcher)).data;
 if(requestRow.id!==id||requestRow.organizationId!==organizationId)throw new ShipperApiError('INVALID_SCOPE','Request scope changed.',403,false);
 const groups=await Promise.all((['routes','plans','opportunities','offers','ranking','decisions','bookings'] as const).map(async kind=>{
  let offset:number|null=0;const rows:RecordV2[]=[],seen=new Set<number>(),ids=new Set<string>();
  for(let n=0;n<10&&offset!==null;n++){
   if(seen.has(offset))throw new ShipperApiError('INVALID_RESPONSE','Repeated page.',502,false);seen.add(offset);
   const body=Envelope.parse(await request(`/api/v2/freight/requests/${id}/${kind}?limit=100&offset=${offset}`,signal,fetcher));
   if(body.data.length>100||body.data.some(r=>r.kind!==kind||r.requestId!==id||r.organizationId!==organizationId||ids.has(r.id))||new Set(body.data.map(r=>r.id)).size!==body.data.length)throw new ShipperApiError('INVALID_SCOPE','Commercial record scope mismatch.',403,false);
   const next=body.meta.nextOffset;
   if(next!==null&&(next!==offset+100||body.data.length!==100||next>100000))throw new ShipperApiError('INVALID_RESPONSE','Invalid page cursor.',502,false);
   for(const row of body.data)ids.add(row.id);rows.push(...body.data);offset=next;
  }
  if(offset!==null)throw new ShipperApiError('PARTIAL_COMMERCIAL_READ','The commercial history is too large for this view.',503,true);
  return [kind,rows] as const;
 }));
 const workflow=Object.fromEntries(groups);
 if(workflow.bookings.length>25)throw new ShipperApiError('PARTIAL_COMMERCIAL_READ','Resource read exceeds the parent budget.',503,true);
 workflow.holds=[];workflow.executions=[];
 for(const booking of workflow.bookings){
  if(booking.kind!=='bookings')throw new ShipperApiError('INVALID_SCOPE','Invalid booking parent.',502,false);
  for(const [kind,suffix] of [['holds','reservations'],['executions','execution']] as const){
   let offset:number|null=0;
   for(let n=0;n<10&&offset!==null;n++){
    const page=Envelope.parse(await request(`/api/v2/bookings/${booking.id}/${suffix}?limit=100&offset=${offset}`,signal,fetcher));
    if(page.data.length>100||page.data.some(row=>row.kind!==kind||row.requestId!==id||row.organizationId!==organizationId
      ||row.carrierId!==booking.carrierId||!('bookingId' in row.data)||row.data.bookingId!==booking.id
      ||workflow[kind].some(existing=>existing.id===row.id))||new Set(page.data.map(row=>row.id)).size!==page.data.length)
      throw new ShipperApiError('INVALID_SCOPE','Booking resource scope mismatch.',403,false);
    const next=page.meta.nextOffset;
    if(next!==null&&(next!==offset+100||page.data.length!==100||next>100000))throw new ShipperApiError('INVALID_RESPONSE','Invalid resource cursor.',502,false);
    workflow[kind].push(...page.data);offset=next;
   }
   if(offset!==null)throw new ShipperApiError('PARTIAL_COMMERCIAL_READ','Incomplete booking resources.',503,true);
  }
 }
 const refs=commercialCatalogReferences(workflow);
 const catalog=await readCommercialCatalog(refs.carrierIds,refs.serviceRefs,async ref=>{
  const path=ref.kind==='carriers'?`/api/v2/carriers/${ref.id}`:`/api/v2/carriers/${ref.carrierId}/services/${ref.id}`;
  return z.object({schemaVersion:z.literal('2.0'),data:z.unknown()}).parse(await request(path,signal,fetcher)).data;
 });
 return {request:requestRow,workflow,catalog};
}
