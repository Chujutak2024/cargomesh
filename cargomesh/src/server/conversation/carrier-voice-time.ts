import {z} from 'zod';
import {canCarrierAction,type CarrierPortalRole} from '@/features/carrier-portal/permissions';
import {carrierVoiceOpportunity} from './carrier-voice-scope';

const reviewSchema=z.object({requestId:z.string().uuid(),customerRef:z.string().uuid(),
 requestVersion:z.number().int().positive(),currentRequestVersion:z.number().int().positive(),
 isCurrent:z.literal(true),canReview:z.literal(true),requestStatus:z.literal('PENDING')});

/** Advisory facts for speech, never authorization. Native SQL revalidates every command. */
export function carrierVoiceTime(raw:unknown,carrierId:string,opportunityId:string,role:CarrierPortalRole,now:number){
 if(!Number.isFinite(now)||!Number.isFinite(new Date(now).getTime()))throw new Error('INVALID_VOICE_CLOCK');
 const row=carrierVoiceOpportunity(raw,carrierId,opportunityId);
 const deadline=Date.parse(row.data.responseDeadline);
 const review=reviewSchema.safeParse(row.data.requestBrief);
 const requestReviewable=review.success&&review.data.requestId===row.requestId&&review.data.customerRef===row.organizationId
  &&review.data.requestVersion===review.data.currentRequestVersion;
 const deadlineState=!Number.isFinite(deadline)?'UNKNOWN':deadline<=now?'EXPIRED':'OPEN';
 const permitted=deadlineState==='OPEN'&&requestReviewable;
 const mayRespond=permitted&&canCarrierAction(role,'opportunities.respond',row.status);
 const mayPrepareOffer=permitted&&canCarrierAction(role,'offers.create',row.status);
 const reason=deadlineState==='EXPIRED'?'DEADLINE_PASSED':deadlineState==='UNKNOWN'?'DEADLINE_UNKNOWN'
  :!requestReviewable?'REQUEST_NOT_REVIEWABLE':!mayPrepareOffer?'STATUS_OR_ROLE_BLOCKED':'REVIEW_ON_WEB';
 return {schemaVersion:'1.0' as const,asOf:new Date(now).toISOString(),timeZone:'America/Lima' as const,
  validUntil:new Date(Math.min(now+240000,deadlineState==='OPEN'?deadline:Infinity)).toISOString(),
  responseDeadline:Number.isFinite(deadline)?new Date(deadline).toISOString():null,
  deadlineState,opportunityStatus:row.status,requestReviewable,mayRespond,mayPrepareOffer,reason};
}
