import {createHash} from 'node:crypto';
import {z} from 'zod';
import {QuoteSearchInputSchema,QuoteSearchResponseSchema,QuoteOutcomeSchema} from '@/shared/schemas/v2/quote-automation';
import {planWholePackages} from '../domain/multi-resource-plan';
import {requestRoadInput} from '../../road-serviceability/application/evaluate-v2-road';
import {quoteCandidate} from '../domain/quote-automation';
import {V2DraftError,getV2Draft,type V2Actor} from '../../freight-requests/application/draft-service';
import {evaluateV2RoadByRequestId} from '../../road-serviceability/application/evaluate-v2-road';
import {v2DraftRepository} from '../../freight-requests/infrastructure/supabase-draft-repository';
import {loadRoadServices} from '../../road-serviceability/infrastructure/supabase-road-catalog';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {quoteRpc} from '../infrastructure/supabase-quotes';
/** Stable child keys allow a partial network failure to resume the same intent. */
export function quoteChildKey(key:string,scope:string){const h=createHash('sha256').update(key+':'+scope).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function searchRequestQuotes(actor:V2Actor,id:string,raw:unknown,rawKey:string|undefined){
 z.string().uuid().parse(id);const input=QuoteSearchInputSchema.parse(raw),key=z.string().uuid().parse(rawKey);
 const db=await createV2ServerSupabaseClient();
 const deadline=Date.parse(input.responseDeadline);
 if(deadline<=Date.now())throw new V2DraftError('RESPONSE_DEADLINE_EXPIRED','Choose a future response deadline.',400);
 const repository=await v2DraftRepository(),request=(await getV2Draft(id,actor,repository)).data;
 if(request.status!=='PENDING')throw new V2DraftError('REQUEST_NOT_SUBMITTED','Confirm the request before requesting quotes.',409);
 if(deadline>Date.parse(request.pickupWindow.startsAt))throw new V2DraftError('INVALID_RESPONSE_DEADLINE','The response deadline must precede pickup.',400);
 const services=await loadRoadServices(db);
 const evaluation=(await evaluateV2RoadByRequestId(id,input.expectedDraftVersion,actor,repository,{listRoadServices:async()=>services})).data;
 const outcomes:z.infer<typeof QuoteOutcomeSchema>[]=[];
 // Every eligible service is evaluated, including those outside the first three results.
 for(const candidate of evaluation.candidates){let selected:z.infer<typeof import('@/shared/schemas/v2/quote-automation').QuoteCandidateInputSchema>|null=quoteCandidate(candidate);
  if(!selected){const service=services.find(s=>s.id===candidate.service.id);if(service){const proposal=planWholePackages(requestRoadInput(request),request.cargoSpecification.units,request.cargoSpecification.divisible,service);if(proposal.status==='FOUND'){const first=proposal.resources[0];selected={serviceId:service.id,laneId:proposal.laneId,calendarId:first.calendarId,assetId:first.assetId,poolId:null,...(proposal.resources.length>1?{resources:proposal.resources}:{})};}else if(proposal.status==='REQUIRES_REVIEW'){outcomes.push({serviceId:service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:proposal.reason,policyVersion:null});continue;}}}
  if(!selected){
  if(candidate.status==='eligible')outcomes.push({serviceId:candidate.service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:'AUTOMATIC_ADAPTER_UNSUPPORTED',policyVersion:null});
  continue;
 }
  const value=await quoteRpc('request_v2_carrier_quote',{p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,
   p_expected_version:input.expectedDraftVersion,p_key:quoteChildKey(key,candidate.candidateId),p_deadline:input.responseDeadline,p_candidate:selected});
  outcomes.push(QuoteOutcomeSchema.parse(value));
 }
 let rankingId:string|null=null,rankingNotice:string|null=null;
 if(outcomes.length){
  const ranked=z.object({id:z.string().uuid().nullable(),notice:z.string().nullable()}).strict().parse(await quoteRpc('rank_v2_request_quotes',{
   p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,p_expected_version:input.expectedDraftVersion,p_key:quoteChildKey(key,'ranking')}));
  rankingId=ranked.id;rankingNotice=ranked.notice;
 }
 return QuoteSearchResponseSchema.parse({schemaVersion:'2.0',data:{requestId:id,requestVersion:input.expectedDraftVersion,outcomes,
  evaluatedServices:evaluation.summaryCounts.totalEvaluated,eligibleServices:new Set([...evaluation.candidates.filter(c=>c.status==='eligible').map(c=>c.service.id),...outcomes.filter(o=>o.planId!==null).map(o=>o.serviceId)]).size,
  unresolvedServices:evaluation.candidates.filter(c=>c.status==='unknown'&&!outcomes.some(o=>o.serviceId===c.service.id)).length,rankingId,rankingNotice,presentationLimit:3}});
}
