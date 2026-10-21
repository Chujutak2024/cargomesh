import {z} from 'zod';
import {CommercialEvidenceV2Schema} from './evidence';
/** EXPIRED is derived from evidence and execution time, never a persisted decision. */
export const RouteAdmissionInputSchema=z.object({decision:z.enum(['ALLOWED','DENIED','UNKNOWN']),reasonCode:z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/)}).strict();
export const RouteAdmissionAssessmentSchema=z.object({state:z.enum(['ALLOWED','DENIED','UNKNOWN','EXPIRED']),reasonCode:z.string().min(1).max(80)}).strict();
export const RouteAdmissionRecordSchema=z.object({assetId:z.string().uuid(),limitId:z.string().uuid(),version:z.number().int().positive(),
 compatibilityConfirmed:z.boolean(),admission:RouteAdmissionInputSchema.nullable(),source:CommercialEvidenceV2Schema.nullable()}).strict();
export type RouteAdmissionRecord=z.infer<typeof RouteAdmissionRecordSchema>;
export type RouteAdmissionAssessment=z.infer<typeof RouteAdmissionAssessmentSchema>;
