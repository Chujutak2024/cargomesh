import {z} from 'zod';
import {TimeWindowV2Schema,EquipmentCodeV2Schema} from './freight-request';
import {DepotActivityV2Schema} from './depot-operations';
const Id=z.string().uuid(),Instant=z.string().datetime({offset:true});
const Window=TimeWindowV2Schema.refine(v=>Date.parse(v.endsAt)-Date.parse(v.startsAt)<=14*86400000,'Assessment window cannot exceed 14 days.');
const Resource=z.object({kind:z.enum(['asset','driver']),resourceId:Id,window:Window}).strict();
const Depot=z.object({depotId:Id,resourceCode:z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/),activity:DepotActivityV2Schema,equipmentType:EquipmentCodeV2Schema,window:Window,units:z.number().int().positive().max(10000)}).strict();
export const CarrierOperationalAssessmentInputV2Schema=z.object({schemaVersion:z.literal('2.0'),serviceId:Id,resources:z.array(Resource).max(8),depots:z.array(Depot).max(8)}).strict().superRefine((v,c)=>{
 const count=v.resources.length+v.depots.length;
 if(count<1||count>8)c.addIssue({code:'custom',message:'Supply between one and eight explicit requirements.'});
 if(new Set(v.resources.map(r=>r.kind+':'+r.resourceId)).size!==v.resources.length)c.addIssue({code:'custom',path:['resources'],message:'Use one window per physical resource; repeated demands require a joint scheduling case.'});
 if(new Set(v.depots.map(d=>d.depotId+':'+d.resourceCode)).size!==v.depots.length)c.addIssue({code:'custom',path:['depots'],message:'Use one demand per depot resource; repeated demands require a joint scheduling case.'});
});
const Check=z.object({kind:z.enum(['asset','driver','depot']),referenceId:Id,resourceCode:z.string().nullable(),window:Window,status:z.enum(['eligible','ineligible','unknown']),reasons:z.array(z.string()),provenanceStatus:z.enum(['VERIFIED','ESTIMATED','SIMULATED','UNKNOWN']),resourceVersion:z.number().int().positive().nullable(),policyVersion:z.number().int().positive().nullable()}).strict();
export const CarrierOperationalAssessmentV2Schema=z.object({schemaVersion:z.literal('2.0'),carrierId:Id,serviceId:Id,scope:z.literal('EXPLICIT_OPERATIONAL_REQUIREMENTS_ONLY'),status:z.enum(['eligible','ineligible','unknown']),checks:z.array(Check).min(1).max(8),startedAt:Instant,completedAt:Instant,consistency:z.literal('NON_ATOMIC_READ'),coverageEvaluated:z.literal(false),cargoCompatibilityEvaluated:z.literal(false),planEligibilityEvaluated:z.literal(false),capacityReserved:z.literal(false),requiresCommitRevalidation:z.literal(true)}).strict();
export type CarrierOperationalAssessmentInputV2=z.infer<typeof CarrierOperationalAssessmentInputV2Schema>;
export type CarrierOperationalAssessmentV2=z.infer<typeof CarrierOperationalAssessmentV2Schema>;
