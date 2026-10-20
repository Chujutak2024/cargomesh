import {z} from 'zod';
import {opportunityRequestBrief} from './opportunity-request-brief';
import {WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import {CommercialEvidenceV2Schema} from '@/shared/schemas/v2/commercial';
import {PreparationFieldsV2Schema,type PreparationFields,type PreparationEvidence} from '@/shared/schemas/v2/offer-preparation';
import {offerContext,opportunityOffers,type Opportunity,type Offer,type CommercialSnapshot} from '@/features/carrier-portal/commercial-model';
import {canCarrierAction,type CarrierPortalRole} from '@/features/carrier-portal/permissions';

export const blankEvidence=(provider=''):PreparationEvidence=>({reference:'',provider,observedAt:'',validUntil:'',provenanceStatus:'UNKNOWN'});
export function emptyPreparation(provider=''):PreparationFields {return {carrierReference:'',price:'',validFrom:'',validUntil:'',estimatedPickupAt:'',estimatedDeliveryAt:'',transitDurationSeconds:'',capacityWeight:'',capacityVolume:'',source:blankEvidence(provider),evidence:[],breakdown:[],commercialTerms:[]};}
export const preparationKey=(operatorId:string,carrierId:string,opportunityId:string,supersedesId:string|null)=>[operatorId,carrierId,opportunityId,supersedesId??'new'].join(':');
export function usdCents(raw:string){
 if(!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(raw.trim()))throw new Error('Enter a USD amount with at most two decimal places.');
 const [whole,fraction='']=raw.trim().split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents>1e12)throw new Error('USD amount is outside the supported range.');return cents;
}
/** Dates must carry an explicit Z or offset. No implicit device-local conversion. */
export function explicitInstant(raw:string){return z.string().datetime({offset:true}).parse(raw.trim());}
function evidenceValue(e:PreparationEvidence){return CommercialEvidenceV2Schema.parse({...e,reference:e.reference.trim(),provider:e.provider.trim(),observedAt:explicitInstant(e.observedAt),validUntil:e.validUntil.trim()?explicitInstant(e.validUntil):null});}
export function quotedSummary(fields:PreparationFields){
 try{let quoted=0;const other:Record<string,number>={INCLUDED:0,ESTIMATED:0,EXCLUDED:0,UNKNOWN:0};
  for(const cost of fields.breakdown){const amount=cost.amount.trim()?usdCents(cost.amount):0;if(cost.treatment==='QUOTED')quoted+=(cost.kind==='DISCOUNT'?-1:1)*amount;else other[cost.treatment]+=amount;}
  return {quoted,total:fields.price.trim()?usdCents(fields.price):null,other};
 }catch{return null;}
}
export function canPrepareOffer(o:Opportunity,role:CarrierPortalRole,now:number){
 const brief=opportunityRequestBrief(o);
 return (o.data.requestBrief===undefined||brief?.canReview===true)&&Number.isFinite(now)
  &&canCarrierAction(role,'offers.create',o.status)&&Date.parse(o.data.responseDeadline)>now;
}
export function offerRequestVersion(f:Offer){const v=f.data.requestVersion;return typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:null;}
export function canChangeOffer(f:Offer,o:Opportunity|undefined,snapshot:CommercialSnapshot,role:CarrierPortalRole,now:number,replace=false){
 const referenced=snapshot.bookings.some(b=>b.carrierId===f.carrierId&&b.organizationId===f.organizationId&&b.requestId===f.requestId&&b.data.offerId===f.id&&!['CANCELLED','REJECTED'].includes(b.status));
 return !snapshot.partial&&!referenced&&f.status==='RECEIVED'&&canCarrierAction(role,replace?'offers.supersede':'offers.withdraw',f.status)
  &&(!replace||!!o&&canPrepareOffer(o,role,now));
}
export function buildOffer(o:Opportunity,assignmentIds:string[],supersedes:Offer|null,fields:PreparationFields,issuedAt:string){
 const brief=opportunityRequestBrief(o);
 if(o.data.requestBrief!==undefined&&!brief?.canReview)throw new Error('The request changed, closed or requires a new eligible plan. Refresh before preparing an offer.');
 const f=PreparationFieldsV2Schema.parse(fields),source=evidenceValue(f.source);
 const breakdown=f.breakdown.map(cost=>({...cost,amount:cost.amount.trim()?{amount:usdCents(cost.amount)/100,currency:'USD'}:null,source:evidenceValue(cost.source),observedAt:explicitInstant(cost.observedAt),details:cost.details.trim()||null}));
 const number=(value:string)=>value.trim()?z.coerce.number().finite().nonnegative().parse(value):null;
 const value=WorkflowInputsV2['offers.create'].parse({...offerContext(o,assignmentIds,supersedes,explicitInstant(issuedAt)),carrierReference:f.carrierReference.trim(),
  price:{amount:usdCents(f.price)/100,currency:'USD'},breakdown,validity:{startsAt:explicitInstant(f.validFrom),endsAt:explicitInstant(f.validUntil)},
  estimatedPickupAt:f.estimatedPickupAt.trim()?explicitInstant(f.estimatedPickupAt):null,estimatedDeliveryAt:f.estimatedDeliveryAt.trim()?explicitInstant(f.estimatedDeliveryAt):null,
  transitDurationSeconds:number(f.transitDurationSeconds),reservableCapacity:f.capacityWeight.trim()?{weightKg:number(f.capacityWeight),volumeM3:number(f.capacityVolume)}:null,
  commercialTerms:f.commercialTerms,source:{channel:'MANUAL',evidence:source},evidence:f.evidence.map(evidenceValue)});
 if(f.capacityVolume.trim()&&!f.capacityWeight.trim())throw new Error('Capacity weight is required when recording capacity volume.');
 if(value.transitDurationSeconds!==null&&!value.evidence.some(e=>e.provenanceStatus!=='UNKNOWN'))throw new Error('A transit duration requires identified evidence; otherwise leave it unknown.');
 return value;
}
export function prepareFromOffer(f:Offer):PreparationFields{
 const v=f.data,ev=(e:z.infer<typeof CommercialEvidenceV2Schema>):PreparationEvidence=>({...e,validUntil:e.validUntil??''});
 return {carrierReference:v.carrierReference,price:v.price.amount.toFixed(2),validFrom:v.validity.startsAt,validUntil:v.validity.endsAt,
  estimatedPickupAt:v.estimatedPickupAt??'',estimatedDeliveryAt:v.estimatedDeliveryAt??'',transitDurationSeconds:v.transitDurationSeconds===null?'':String(v.transitDurationSeconds),
  capacityWeight:v.reservableCapacity===null?'':String(v.reservableCapacity.weightKg),capacityVolume:v.reservableCapacity?.volumeM3==null?'':String(v.reservableCapacity.volumeM3),
  source:ev(v.source.evidence),evidence:v.evidence.map(ev),commercialTerms:v.commercialTerms,
  breakdown:v.breakdown.map(c=>({...c,amount:c.amount===null?'':c.amount.amount.toFixed(2),details:c.details??'',source:ev(c.source)}))};
}
export function offerRelations(f:Offer,o:Opportunity|null){
 return !!o&&opportunityOffers(o,{opportunities:[o],offers:[f],bookings:[],executions:[],partial:false,readAt:''}).length===1;
}
export function validateIssuedOffer(f:Offer,o:Opportunity,body:ReturnType<typeof buildOffer>){
 if(!offerRelations(f,o)||f.status!=='RECEIVED'||f.data.source.channel!=='MANUAL'||f.data.supersedesOfferId!==body.supersedesOfferId||f.data.planCandidateId!==body.planCandidateId
  ||JSON.stringify([...f.data.coveredAssignmentIds].sort())!==JSON.stringify([...body.coveredAssignmentIds].sort())||JSON.stringify([...f.data.coveredServiceIds].sort())!==JSON.stringify([...body.coveredServiceIds].sort()))throw new Error('INVALID_COMMERCIAL_SCOPE');
 const brief=opportunityRequestBrief(o);
 if(brief&&offerRequestVersion(f)!==brief.requestVersion)throw new Error('INVALID_OFFER_REQUEST_VERSION');
 return f;
}
