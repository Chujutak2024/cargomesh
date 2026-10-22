import {z} from 'zod';
import {WorkflowRecordV2Schema} from '@/shared/schemas/v2/workflow';
import {QuotePolicyRecordSchema} from '@/shared/schemas/v2/quote-automation';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import {CarrierCostCalculationRecordSchema} from '@/shared/schemas/v2/operating-costs';
import {carrierVoiceOpportunity} from './carrier-voice-scope';

const clean=(value:unknown)=>String(value??'unknown').replace(/[\r\n<>]/g,' ').slice(0,160);
const amount=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?String(value):'unknown';
const windowText=(raw:unknown)=>{const parsed=TimeWindowV2Schema.safeParse(raw);return parsed.success?`${parsed.data.startsAt} to ${parsed.data.endsAt}`:'unknown';};
const briefSchema=z.object({requestId:z.string().uuid(),customerRef:z.string().uuid(),requestVersion:z.number().int().positive().nullable(),currentRequestVersion:z.number().int().positive().nullable(),isCurrent:z.boolean(),canReview:z.boolean(),pickupWindow:TimeWindowV2Schema.nullable(),deliveryWindow:TimeWindowV2Schema.nullable(),planEligibility:z.enum(['eligible','unknown','ineligible'])});

/** Server-owned facts only. Transcripts and browser draft fields never establish a quote. */
export function buildCarrierBriefing(input:{opportunity:unknown;offers:unknown[];policies:unknown[];calculation?:unknown;carrierId:string;opportunityId:string;role:string;now:number;offersComplete:boolean;policiesAvailable:boolean}){
 const row=carrierVoiceOpportunity(input.opportunity,input.carrierId,input.opportunityId),cargo=row.data.cargoSpecification;
 const parsed=briefSchema.safeParse(row.data.requestBrief),brief=parsed.success&&parsed.data.requestId===row.requestId&&parsed.data.customerRef===row.organizationId?parsed.data:null;
 const current=!!brief?.isCurrent&&brief.requestVersion!==null&&brief.requestVersion===brief.currentRequestVersion;
 const services=new Set(row.data.assignmentSnapshots.map(a=>a.serviceId));
 const offers=input.offers.map(raw=>WorkflowRecordV2Schema.parse(raw)).filter(r=>{
  if(r.carrierId!==input.carrierId||r.requestId!==row.requestId||r.organizationId!==row.organizationId)throw new Error('FORBIDDEN_VOICE_SCOPE');
  return r.kind==='offers'&&r.data.opportunityId===row.id&&r.data.planCandidateId===row.data.planId&&r.data.coveredAssignmentIds.every(id=>row.data.assignmentIds.includes(id))&&r.data.coveredServiceIds.every(id=>services.has(id));
 }).filter(r=>r.kind==='offers').filter(r=>r.status==='RECEIVED'&&Date.parse(r.data.validity.startsAt)<=input.now&&Date.parse(r.data.validity.endsAt)>input.now);
 const policies=input.role==='ADMIN'?input.policies.map(raw=>QuotePolicyRecordSchema.parse(raw)).filter(p=>{
  if(p.carrierId!==input.carrierId)throw new Error('FORBIDDEN_VOICE_SCOPE');
  return services.has(p.serviceId)&&p.value.active&&Date.parse(p.value.validUntil)>input.now;
 }):[];
 const packages=Array.isArray(cargo.units)?cargo.units.slice(0,8).map((unit:unknown)=>{
  const u=z.object({packageType:z.string().optional(),quantity:z.number(),weightPerUnitKg:z.number().optional(),volumePerUnitM3:z.number().optional(),indivisible:z.boolean().optional()}).safeParse(unit);
  return u.success?`${u.data.quantity} ${clean(u.data.packageType)}; per unit ${amount(u.data.weightPerUnitKg)} kg, ${amount(u.data.volumePerUnitM3)} m3; indivisible ${u.data.indivisible??'unknown'}`:'unit details unknown';
 }):[];
 const seenBindings=new Set<string>();
 const resources=row.data.assignmentSnapshots.flatMap(a=>{
  if(seenBindings.has(a.id))return [];seenBindings.add(a.id);
  const summary=z.object({allocationSummary:z.object({role:z.enum(['LOAD_BEARING','AUXILIARY']),equipment:z.string().min(1),units:z.array(z.object({weightKg:z.number().positive(),volumeM3:z.number().positive()}))})}).safeParse(a);
  if(summary.success)return summary.data.allocationSummary.role==='LOAD_BEARING'?[`1 ${clean(summary.data.allocationSummary.equipment)} carrying ${summary.data.allocationSummary.units.reduce((sum,u)=>sum+u.weightKg,0)} kg`]:[];
  const resource=z.object({role:z.string(),equipment:z.string(),units:z.number().int().positive()});
  const grouped=z.object({resources:z.array(z.object({resource}))}).safeParse(a),single=z.object({resource}).safeParse(a);
  const rows=grouped.success?grouped.data.resources.map(r=>r.resource):single.success?[single.data.resource]:[];
  return rows.filter(r=>r.role==='LOAD_BEARING').map(r=>`${r.units} ${clean(r.equipment)}`);
 }).slice(0,8);
 const calculation=input.role==='ADMIN'&&current?CarrierCostCalculationRecordSchema.safeParse(input.calculation):null;
 const cost=calculation?.success&&offers.some(o=>o.id===calculation.data.offerId&&o.data.price.currency==='USD'&&calculation.data.snapshot?.calculation.totalCents===Math.round(o.data.price.amount*100))?calculation.data:null;
 const facts=[
  `Request revision ${brief?.requestVersion??'unknown'}; projection current: ${current}; review allowed: ${current&&brief?.canReview===true}.`,
  `Cargo ${clean(cargo.description??cargo.categoryCode)}; category ${clean(cargo.categoryCode)}; total ${amount(cargo.totalWeightKg)} kg; ${amount(cargo.totalVolumeM3)} m3; divisible: ${typeof cargo.divisible==='boolean'?cargo.divisible:'unknown'}.`,
  `Pickup ${current?windowText(brief?.pickupWindow):'unknown'}; delivery ${current?windowText(brief?.deliveryWindow):'unknown'}.`,
  `Plan eligibility ${current?brief?.planEligibility:'unknown'}; carrying equipment ${resources.length?resources.join(', '):'unknown'}. Planned equipment is not a confirmed operational assignment or current availability.`,
  ...(packages.length?[`Packages: ${packages.join('; ')}.`]:[]),
  !current?'Request projection is stale or unverified. Revalidate before recommending any price.':offers.length?`Recorded current offers: ${offers.slice(0,3).map(o=>`${o.data.price.currency} ${o.data.price.amount}, commercial version ${o.data.offerVersion}, valid until ${o.data.validity.endsAt}, source ${clean(o.data.source.channel)}/${clean(o.data.source.evidence.provenanceStatus)}`).join('; ')}. This is a recorded offer, not a fresh capacity check.`:input.offersComplete?'No current issued offer is recorded. Do not invent a price.':'Offer read is incomplete. Do not infer that no offers exist.',
  ...(input.role==='ADMIN'?[input.policiesAvailable?`Approved policy configurations for related services: ${policies.length}. ${policies.slice(0,3).map(p=>`Version ${p.version}, basis ${p.value.basis}, auto issue ${p.value.autoIssue}, maximum resources ${p.value.maxResources??1}, auto confirm ${p.value.dispatch?.autoConfirm??false}, evidence ${p.value.provenanceStatus}`).join('; ')}. Policy configuration is not a calculated price or proof that a particular lane qualifies.`:'Policy configuration is unavailable.']:[]),
  ...(cost?.snapshot?[`Private Carrier calculation for the recorded offer only: policy version ${cost.policyVersion}; ${cost.snapshot.distanceKm} km; ${cost.snapshot.calculation.resourceCount} trucks; ${cost.snapshot.calculation.litres} litres; ${cost.snapshot.calculation.drivingSeconds/3600} driving hours; ${cost.snapshot.calculation.restSeconds/3600} rest hours; total USD ${cost.snapshot.calculation.totalCents/100}; inputs ${cost.snapshot.calculation.provenance}. Components in USD: ${cost.snapshot.calculation.components.map(c=>`${c.code} ${c.cents/100}`).join(', ')}. Never disclose this private breakdown in a Client session.`]:[]),
  'Only native CargoMesh commands can issue offers or confirm resources, after the operator reviews and confirms. Do not execute or claim a business action from this conversation.',
 ];
 return facts.join(' ').slice(0,4800);
}

export async function readCarrierBriefing(actor:import('@/server/auth/carrier').AuthenticatedCarrierContext,opportunity:unknown){
 const [{readCarrierPortalAccess},{WorkflowServiceV2},{workflowRepositoryV2}]=await Promise.all([
  import('@/server/auth/carrier-portal'),import('@/server/modules/workflow/application/workflow-service'),import('@/server/modules/workflow/infrastructure/supabase-workflow-repository')]);
 const raw=WorkflowRecordV2Schema.parse(opportunity);
 const row=carrierVoiceOpportunity(raw,actor.carrierId,raw.id);
 const access=await readCarrierPortalAccess(),role=access.find(r=>r.carrierId===actor.carrierId&&r.operatorId===actor.operatorId)?.role;
 if(!role)throw new Error('FORBIDDEN_VOICE_SCOPE');
 const service=new WorkflowServiceV2(await workflowRepositoryV2());
 const [offers,policies]=await Promise.all([
  service.read(actor,'offers',{carrierId:actor.carrierId,requestId:row.requestId,parentId:null,id:null},{limit:100,offset:0}).then(result=>({rows:Array.isArray(result.data)?result.data:[],complete:result.meta?.nextOffset===null})).catch(()=>({rows:[],complete:false})),
  role==='ADMIN'?import('@/server/modules/commercial/application/quote-service').then(({readQuotePolicies})=>readQuotePolicies(actor)).then(rows=>({rows,available:true})).catch(()=>({rows:[],available:false})):Promise.resolve({rows:[],available:false}),
 ]);
 const now=Date.now();let calculation:unknown;
 const currentOffer=offers.rows.filter(r=>r.kind==='offers'&&r.data.opportunityId===row.id&&r.data.planCandidateId===row.data.planId&&r.status==='RECEIVED'&&Date.parse(r.data.validity.startsAt)<=now&&Date.parse(r.data.validity.endsAt)>now).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 if(role==='ADMIN'&&currentOffer)try{const {quoteRpc}=await import('@/server/modules/commercial/infrastructure/supabase-quotes');calculation=await quoteRpc('read_v2_carrier_cost_calculation',{p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_offer_id:currentOffer.id});}catch{/* Native offer remains readable when private calculation is unavailable. */}
 return buildCarrierBriefing({opportunity:row,carrierId:actor.carrierId,opportunityId:row.id,role,offers:offers.rows,offersComplete:offers.complete,policies:policies.rows,policiesAvailable:policies.available,calculation,now});
}
