import {DispatchOptionSchema} from '@/shared/schemas/v2/dispatch';
import {RecoveryQuoteContextSchema} from '@/shared/schemas/v2/incident-recovery';
import {recoveryCandidates} from '../domain/recovery-candidates';
import {proposeDispatchAlternatives,compareDispatchPlans} from '../domain/dispatch-alternatives';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {QuoteSearchInputSchema,QuoteSearchResponseSchema,QuoteOutcomeSchema,QuoteCandidateInputSchema} from '@/shared/schemas/v2/quote-automation';
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
 if(deadline>Date.parse(request.planningPreferences?request.pickupWindow.endsAt:request.pickupWindow.startsAt))throw new V2DraftError('INVALID_RESPONSE_DEADLINE','The response deadline must precede pickup.',400);
 const Selection=z.object({candidateId:z.string(),candidate:QuoteCandidateInputSchema}).strict();
 const Intent=z.object({outcomes:z.array(QuoteOutcomeSchema.refine(o=>o.status==='REQUIRES_REVIEW'&&o.offerId===null&&o.planId===null&&o.opportunityId===null)).max(1000),selections:z.array(Selection).max(1000),evaluatedServices:z.number().int().nonnegative(),eligibleServices:z.number().int().nonnegative(),unresolvedServices:z.number().int().nonnegative()}).strict();
 const intentArgs={p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,p_expected_version:input.expectedDraftVersion,p_key:key,p_deadline:input.responseDeadline};
 const recorded=request.planningPreferences?await quoteRpc('dispatch_v2_search_intent',{...intentArgs,p_value:null}):null;
 let planIntent: z.infer<typeof Intent>;
 if(recorded!==null)planIntent=Intent.parse(recorded);
 else {
 const recovery=RecoveryQuoteContextSchema.parse(await quoteRpc('read_v2_recovery_quote_context',{p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id}));
 const blocked=z.array(z.string().uuid()).parse(await quoteRpc('read_v2_recovery_blocked_calendars',{p_organization_id:actor.organizationId,p_member_id:actor.memberId}));
 const services=recoveryCandidates(await loadRoadServices(db),recovery?.failedCarrierId??null,blocked);
 const evaluation=(await evaluateV2RoadByRequestId(id,input.expectedDraftVersion,actor,repository,{listRoadServices:async()=>services})).data;
 if(evaluation.summaryCounts.totalEvaluated>1000)throw new V2DraftError('DISPATCH_SEARCH_UNIVERSE_LIMIT','The service universe exceeds the automatic dispatch limit. Request manual review.',409);
 const dispatchOptions=request.planningPreferences?z.array(DispatchOptionSchema).parse(await quoteRpc('read_v2_dispatch_options_with_admission',{p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,p_expected_version:input.expectedDraftVersion})):[];
 const searchTime=Date.now();
 const selections:z.infer<typeof Selection>[]=[];
 const outcomes:z.infer<typeof QuoteOutcomeSchema>[]=[];
 // Every eligible service is evaluated, including those outside the first three results.
 for(const candidate of evaluation.candidates){let selected:z.infer<typeof import('@/shared/schemas/v2/quote-automation').QuoteCandidateInputSchema>|null=quoteCandidate(candidate);
  if(request.planningPreferences){
   const service=services.find(s=>s.id===candidate.service.id),options=dispatchOptions.filter(o=>o.serviceId===candidate.service.id);
   const proposals=service?options.map(option=>proposeDispatchAlternatives(request,request.planningPreferences!,requestRoadInput(request),service,option,searchTime,deadline)):[];
   const plans=proposals.flatMap(p=>p.status==='FOUND'?p.plans:[]);
   if(!plans.length){outcomes.push({serviceId:candidate.service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:options.length?(proposals.find(p=>p.status!=='FOUND') as {reason:string}|undefined)?.reason??'NO_VERIFIED_DISPATCH_PLAN':'DISPATCH_POLICY_OR_ROUTE_REQUIRED',policyVersion:null});continue;}
   // An exhausted search is unresolved; do not publish a falsely cheapest partial result.
   if(plans.length>128||proposals.some(p=>p.status!=='FOUND'&&/LIMIT/.test(p.reason))){outcomes.push({serviceId:candidate.service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:'DISPATCH_COST_SEARCH_LIMIT',policyVersion:null});continue;}
   const toCandidate=(plan:typeof plans[number])=>{const first=plan.resources[0];return {serviceId:candidate.service.id,laneId:plan.laneId,calendarId:first.calendarId,assetId:first.assetId,poolId:null,schedule:plan.schedule,...(plan.resources.length>1?{resources:plan.resources}:{})};};
   if(options.some(o=>o.costMode==='COST_PLUS')){
    const previews=z.array(z.object({index:z.number().int().nonnegative(),status:z.enum(['READY','REQUIRES_REVIEW']),totalCents:z.number().int().positive().nullable(),reason:z.string().nullable()}).strict()).parse(await quoteRpc('preview_v2_dispatch_costs',{p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,p_expected_version:input.expectedDraftVersion,p_candidates:plans.map(toCandidate)}));
    if(previews.length!==plans.length||previews.some((p,i)=>p.index!==i))throw new V2DraftError('INVALID_COST_PREVIEW','Invalid cost correlation.',502);
    const priced=previews.flatMap(p=>p.status==='READY'&&p.totalCents!==null?[{plan:plans[p.index],schedule:plans[p.index].schedule,totalCents:p.totalCents}]:[]).sort((a,b)=>compareDispatchPlans(a,b,request.planningPreferences!.urgency));
    if(!priced.length){outcomes.push({serviceId:candidate.service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:previews[0]?.reason??'NO_VERIFIED_COST_PLAN',policyVersion:null});continue;}
    selected=toCandidate(priced[0].plan);
   }else{
    plans.sort((a,b)=>Date.parse(a.schedule.deliveryAt)-Date.parse(b.schedule.deliveryAt)||Date.parse(a.schedule.pickupAt)-Date.parse(b.schedule.pickupAt)||a.schedule.routeId.localeCompare(b.schedule.routeId));selected=toCandidate(plans[0]);
   }
  }

  if(!selected){const service=services.find(s=>s.id===candidate.service.id);if(service){const proposal=planWholePackages(requestRoadInput(request),request.cargoSpecification.units,request.cargoSpecification.divisible,service);if(proposal.status==='FOUND'){const first=proposal.resources[0];selected={serviceId:service.id,laneId:proposal.laneId,calendarId:first.calendarId,assetId:first.assetId,poolId:null,...(proposal.resources.length>1?{resources:proposal.resources}:{})};}else if(proposal.status==='REQUIRES_REVIEW'){outcomes.push({serviceId:service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:proposal.reason,policyVersion:null});continue;}}}
  if(!selected){
  if(candidate.status==='eligible')outcomes.push({serviceId:candidate.service.id,planId:null,opportunityId:null,offerId:null,status:'REQUIRES_REVIEW',reason:'AUTOMATIC_ADAPTER_UNSUPPORTED',policyVersion:null});
  continue;
 }
  selections.push({candidateId:candidate.candidateId,candidate:selected});
 }
 const proposed=Intent.parse({outcomes,selections,evaluatedServices:evaluation.summaryCounts.totalEvaluated,eligibleServices:new Set([...evaluation.candidates.filter(c=>c.status==='eligible').map(c=>c.service.id),...selections.map(o=>o.candidate.serviceId)]).size,unresolvedServices:evaluation.candidates.filter(c=>c.status==='unknown'&&!selections.some(o=>o.candidate.serviceId===c.service.id)&&!outcomes.some(o=>o.serviceId===c.service.id)).length});
 planIntent=request.planningPreferences?Intent.parse(await quoteRpc('dispatch_v2_search_intent',{...intentArgs,p_value:proposed})):proposed;
 }
 const outcomes=[...planIntent.outcomes];
 for(const {candidateId,candidate:selected} of planIntent.selections){
  const value=await quoteRpc('request_v2_carrier_quote',{p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,
   p_expected_version:input.expectedDraftVersion,p_key:quoteChildKey(key,candidateId),p_deadline:input.responseDeadline,p_candidate:selected});
  outcomes.push(QuoteOutcomeSchema.parse(value));
 }
 let rankingId:string|null=null,rankingNotice:string|null=null;
 if(outcomes.length){
  const ranked=z.object({id:z.string().uuid().nullable(),notice:z.string().nullable()}).strict().parse(await quoteRpc('rank_v2_request_quotes',{
   p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:id,p_expected_version:input.expectedDraftVersion,p_key:quoteChildKey(key,'ranking')}));
  rankingId=ranked.id;rankingNotice=ranked.notice;
 }
 return QuoteSearchResponseSchema.parse({schemaVersion:'2.0',data:{requestId:id,requestVersion:input.expectedDraftVersion,outcomes,
  evaluatedServices:planIntent.evaluatedServices,eligibleServices:planIntent.eligibleServices,
  unresolvedServices:planIntent.unresolvedServices,rankingId,rankingNotice,presentationLimit:3}});
}
