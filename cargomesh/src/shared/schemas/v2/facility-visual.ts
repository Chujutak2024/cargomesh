import {z} from 'zod';
import {depotTemplates, type DepotTemplateId} from '@/shared/facility-visual-catalog';
export const FacilityVisualTemplateSchema=z.enum(depotTemplates.map(v=>v.id) as [DepotTemplateId,...DepotTemplateId[]]);
export const FacilityVisualInputSchema=z.object({expectedVersion:z.number().int().min(0).max(2147483646),templateId:FacilityVisualTemplateSchema.nullable()}).strict();
export const FacilityVisualRecordSchema=z.object({facilityId:z.string().uuid(),organizationId:z.string().uuid(),
 templateId:FacilityVisualTemplateSchema.nullable(),version:z.number().int().nonnegative(),updatedAt:z.string().datetime({offset:true}).nullable()}).strict();
export const FacilityVisualResponseSchema=z.object({schemaVersion:z.literal('2.0'),data:FacilityVisualRecordSchema,
 meta:z.object({idempotentReplay:z.boolean()})}).strict();
export type FacilityVisualRecord=z.infer<typeof FacilityVisualRecordSchema>;
