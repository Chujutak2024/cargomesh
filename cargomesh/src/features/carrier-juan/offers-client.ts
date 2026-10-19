import {readCommercial} from '@/features/carrier-portal/commercial-client';
import {offerContext,parseCommercialRecord,type Opportunity,type Offer} from '@/features/carrier-portal/commercial-model';
import {portalRequest,PortalApiError} from '@/features/carrier-portal/api';
import {validCarrierId} from '@/features/carrier-portal/records';
import {WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {OfferPreparationRecordV2Schema,SaveOfferPreparationV2Schema,type OfferPreparationValue} from '@/shared/schemas/v2/offer-preparation';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {validateIssuedOffer,type buildOffer} from './offers-model';
export async function readOffersWorkspace(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){const data=await readCommercial(carrierId,signal,fetcher);if(signal.aborted)throw new DOMException('Aborted','AbortError');return {...data,carrierId};}
export async function issueCarrierOffer(carrier:CarrierPortalAccessV2,o:Opportunity,body:ReturnType<typeof buildOffer>,key:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(carrier.role==='DISPATCHER'||o.carrierId!==carrier.carrierId||!validCarrierId(key))throw new PortalApiError(403,'INVALID_COMMERCIAL_SCOPE');
 const checked=WorkflowInputsV2['offers.create'].parse(body),context=offerContext(o,checked.coveredAssignmentIds,null,checked.issuedAt);
 if(context.planCandidateId!==checked.planCandidateId||JSON.stringify([...context.coveredServiceIds].sort())!==JSON.stringify([...checked.coveredServiceIds].sort()))throw new PortalApiError(400,'INVALID_COMMERCIAL_SCOPE');
 if(checked.source.channel!=='MANUAL')throw new PortalApiError(400,'MANUAL_SOURCE_REQUIRED');
 const result=await portalRequest(`/api/v2/carriers/${carrier.carrierId}/opportunities/${o.id}/offers`,{method:'POST',signal,headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(checked)},fetcher);
 const saved=validateIssuedOffer(parseCommercialRecord('offers',result.data,carrier.carrierId),o,checked);
 if(saved.data.source.issuerId!==carrier.operatorId)throw new PortalApiError(502,'INVALID_OFFER_ISSUER');return saved;
}
export async function withdrawCarrierOffer(carrier:CarrierPortalAccessV2,f:Offer,raw:unknown,key:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(carrier.role==='DISPATCHER'||f.carrierId!==carrier.carrierId||!validCarrierId(key))throw new PortalApiError(403,'INVALID_COMMERCIAL_SCOPE');
 const value=WorkflowInputsV2['offers.withdraw'].parse(raw);if(value.expectedVersion!==f.version)throw new PortalApiError(409,'STALE_OFFER');
 const response=await portalRequest(`/api/v2/carriers/${carrier.carrierId}/offers/${f.id}/withdrawals`,{method:'POST',signal,headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(value)},fetcher);
 const saved=parseCommercialRecord('offers',response.data,carrier.carrierId,f.id);
 if(saved.requestId!==f.requestId||saved.organizationId!==f.organizationId||saved.data.opportunityId!==f.data.opportunityId||saved.status!=='WITHDRAWN')throw new PortalApiError(502,'INVALID_COMMERCIAL_SCOPE');return saved;
}
function preparationRecord(carrier:CarrierPortalAccessV2,raw:unknown){const r=OfferPreparationRecordV2Schema.parse(raw);if(r.carrierId!==carrier.carrierId||r.operatorId!==carrier.operatorId)throw new PortalApiError(502,'INVALID_PREPARATION_SCOPE');return r;}
export async function readPreparations(carrier:CarrierPortalAccessV2,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const records:ReturnType<typeof preparationRecord>[]=[],offsets=new Set<number>();let offset:number|null=0;
 for(let page=0;page<10&&offset!==null;page++){if(offsets.has(offset))throw new PortalApiError(502,'INVALID_RESPONSE');offsets.add(offset);
  const result=await portalRequest(`/api/v2/carriers/${carrier.carrierId}/offer-preparations?limit=100&offset=${offset}`,{signal},fetcher);
  if(!Array.isArray(result.data)||result.data.length>100)throw new PortalApiError(502,'INVALID_RESPONSE');
  const rows=result.data.map(raw=>preparationRecord(carrier,raw));if(rows.some(r=>records.some(p=>p.id===r.id))||new Set(rows.map(r=>r.id)).size!==rows.length)throw new PortalApiError(502,'INVALID_RESPONSE');
  records.push(...rows);offset=result.meta?.nextOffset??null;if(result.meta?.partial===true)return {records,partial:true};
 }
 if(signal.aborted)throw new DOMException('Aborted','AbortError');return {records,partial:offset!==null};
}
export async function savePreparation(carrier:CarrierPortalAccessV2,value:OfferPreparationValue,expectedVersion:number,key:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(carrier.role==='DISPATCHER'||!validCarrierId(key))throw new PortalApiError(403,'FORBIDDEN_CARRIER_ROLE');
 const body=SaveOfferPreparationV2Schema.parse({expectedVersion,value}),result=await portalRequest(`/api/v2/carriers/${carrier.carrierId}/offer-preparations`,{method:'POST',signal,headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)},fetcher);
 const saved=preparationRecord(carrier,result.data);if(saved.value.opportunityId!==value.opportunityId||saved.value.supersedesOfferId!==value.supersedesOfferId)throw new PortalApiError(502,'INVALID_PREPARATION_SCOPE');return saved;
}
