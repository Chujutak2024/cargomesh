import {z} from 'zod';
const id=z.string().uuid(), money=z.number().finite().min(0).max(1e8).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001);
export const QuotePolicyValueSchema=z.object({
 schemaVersion:z.literal('2.0'),serviceId:id,laneId:id,active:z.boolean(),autoIssue:z.boolean(),
 basis:z.enum(['PER_TRIP','PER_KM']),baseAmount:money,ratePerKm:money,minimumAmount:money,
 fuelAmount:money,tollAmount:money,handlingAmount:money,taxAmount:money,
 validityMinutes:z.number().int().min(5).max(1440),confirmationMinutes:z.number().int().min(5).max(1440),
 validUntil:z.string().datetime({offset:true}),terms:z.string().trim().min(1).max(2000),
 provenanceStatus:z.enum(['VERIFIED','SIMULATED']),acknowledgeAuthority:z.literal(true),
}).strict().refine(v=>v.basis==='PER_KM'?v.ratePerKm>0:v.ratePerKm===0)
 .refine(v=>v.baseAmount+v.minimumAmount+v.ratePerKm>0);
export const SaveQuotePolicySchema=z.object({expectedVersion:z.number().int().nonnegative(),value:QuotePolicyValueSchema}).strict();
export const QuoteSearchInputSchema=z.object({schemaVersion:z.literal('2.0'),expectedDraftVersion:z.number().int().positive(),responseDeadline:z.string().datetime({offset:true}),consent:z.literal('REQUEST_QUOTES')}).strict();
export const QuoteCandidateInputSchema=z.object({serviceId:id,laneId:id,calendarId:id,assetId:id.nullable(),poolId:id.nullable()}).strict()
 .refine(v=>(v.assetId===null)!==(v.poolId===null));
export const QuoteOutcomeSchema=z.object({serviceId:id,planId:id.nullable(),opportunityId:id.nullable(),offerId:id.nullable(),
 status:z.enum(['OFFERED','AWAITING_CARRIER','REQUIRES_REVIEW']),reason:z.string(),policyVersion:z.number().int().nullable()}).strict();
export const QuoteSearchResponseSchema=z.object({schemaVersion:z.literal('2.0'),data:z.object({requestId:id,requestVersion:z.number().int().positive(),
 outcomes:z.array(QuoteOutcomeSchema),evaluatedServices:z.number().int().nonnegative(),eligibleServices:z.number().int().nonnegative(),
 unresolvedServices:z.number().int().nonnegative(),rankingId:id.nullable(),rankingNotice:z.string().nullable(),presentationLimit:z.literal(3)})}).strict();
export type QuotePolicyValue=z.infer<typeof QuotePolicyValueSchema>;
export const QuotePolicyRecordSchema=z.object({id,carrierId:id,serviceId:id,laneId:id,version:z.number().int().positive(),value:QuotePolicyValueSchema,updatedAt:z.string().datetime({offset:true})}).strict();
export const QuoteHistorySchema=z.array(z.object({requestId:id,reference:z.string(),createdAt:z.string().datetime({offset:true}),
 totalWeightKg:z.number().positive(),totalVolumeM3:z.number().positive(),quotedPrices:z.array(z.object({amount:z.number().positive(),currency:z.literal('USD'),issuedAt:z.string().datetime({offset:true}),status:z.string(),basis:z.literal('HISTORICAL_QUOTE_NOT_CURRENT_PRICE')}).strict())}).strict()).max(5);
export const QuoteConfirmationSchema=z.object({bookingId:id,version:z.number().int().positive(),bookingStatus:z.string(),deadline:z.string().datetime({offset:true}),maxDeadline:z.string().datetime({offset:true}),proposedDeadline:z.string().datetime({offset:true}).nullable(),extensionUsed:z.boolean()}).strict();
export const QuoteConfirmationInputSchema=z.object({action:z.enum(['PROPOSE','APPROVE','DECLINE','EXPIRE']),expectedVersion:z.number().int().positive(),deadline:z.string().datetime({offset:true}).nullable(),reason:z.string().trim().min(1).max(300)}).strict().refine(v=>v.action!=='PROPOSE'||v.deadline!==null);
