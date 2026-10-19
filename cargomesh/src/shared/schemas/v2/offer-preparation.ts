import {z} from 'zod';
import {OfferCostComponentV2Schema,CommercialEvidenceV2Schema} from './commercial';
const Id=z.string().uuid(),Text=z.string().max(2000),Short=z.string().max(100);
const component=OfferCostComponentV2Schema.innerType().shape;
/** Incomplete strings are intentional: preparation is distinct from a valid issued offer. */
export const PreparationEvidenceV2Schema=z.object({reference:z.string().max(500),provider:z.string().max(150),observedAt:Short,validUntil:Short,
 provenanceStatus:CommercialEvidenceV2Schema.innerType().shape.provenanceStatus}).strict();
export const PreparationFieldsV2Schema=z.object({carrierReference:z.string().max(200),price:Short,validFrom:Short,validUntil:Short,
 estimatedPickupAt:Short,estimatedDeliveryAt:Short,transitDurationSeconds:Short,capacityWeight:Short,capacityVolume:Short,
 source:PreparationEvidenceV2Schema,evidence:z.array(PreparationEvidenceV2Schema).max(100),
 breakdown:z.array(z.object({kind:component.kind,treatment:component.treatment,amount:Short,observedAt:Short,details:z.string().max(1000),source:PreparationEvidenceV2Schema}).strict()).max(100),
 commercialTerms:z.array(z.object({code:Text,description:Text}).strict()).max(100)}).strict();
export const OfferPreparationValueV2Schema=z.object({schemaVersion:z.literal('2.0'),opportunityId:Id,
 assignmentIds:z.array(Id).max(100).refine(v=>new Set(v).size===v.length,'Duplicate assignments.'),supersedesOfferId:Id.nullable(),fields:PreparationFieldsV2Schema}).strict();
export const SaveOfferPreparationV2Schema=z.object({expectedVersion:z.number().int().nonnegative(),value:OfferPreparationValueV2Schema}).strict();
export const OfferPreparationRecordV2Schema=z.object({id:Id,carrierId:Id,operatorId:Id,userId:Id,organizationId:Id,requestId:Id,
 version:z.number().int().positive(),updatedAt:z.string().datetime({offset:true}),value:OfferPreparationValueV2Schema}).strict();
export type PreparationFields=z.infer<typeof PreparationFieldsV2Schema>;
export type PreparationEvidence=z.infer<typeof PreparationEvidenceV2Schema>;
export type OfferPreparationValue=z.infer<typeof OfferPreparationValueV2Schema>;
export type OfferPreparationRecord=z.infer<typeof OfferPreparationRecordV2Schema>;
