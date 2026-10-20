import {z} from 'zod';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';

// Read-only extension owned by the Carrier projection; shared workflow schemas
// stay compatible with the coordinated Client C6 contract.
export const OpportunityRequestBriefSchema=z.object({
 schemaVersion:z.literal('1.0'),requestId:z.string().uuid(),requestCode:z.string().min(1),
 requestVersion:z.number().int().positive().nullable(),currentRequestVersion:z.number().int().positive().nullable(),
 customerRef:z.string().uuid(),pickupWindow:TimeWindowV2Schema.nullable(),deliveryWindow:TimeWindowV2Schema.nullable(),
 acceptedModes:z.array(z.enum(['ROAD','RAIL','SEA','AIR'])).nullable(),
 requiredEquipment:z.string().nullable(),preferredEquipment:z.string().nullable(),
 contactsVisibility:z.literal('WITHHELD'),locationPrecision:z.literal('CITY'),
 isCurrent:z.boolean(),canReview:z.boolean(),requestStatus:z.string(),
 planEligibility:z.enum(['eligible','unknown','ineligible']),pendingRequirements:z.array(z.string()),exclusionReasons:z.array(z.string()),
}).strict();

export function opportunityRequestBrief(row:Opportunity){
 const parsed=OpportunityRequestBriefSchema.safeParse(row.data.requestBrief);
 if(!parsed.success||parsed.data.requestId!==row.requestId||parsed.data.customerRef!==row.organizationId)return null;
 const brief=parsed.data;
 if(brief.isCurrent&&(brief.requestVersion===null||brief.requestVersion!==brief.currentRequestVersion))return null;
 if(brief.canReview&&(!brief.isCurrent||brief.requestStatus!=='PENDING'))return null;
 return brief;
}
