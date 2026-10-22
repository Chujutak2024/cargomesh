import {z} from 'zod';
import {LocationInputV2Schema,TimeWindowV2Schema} from './freight-request';
const id=z.string().uuid();
export const RecoveryAllocationSchema=z.object({unitIndex:z.number().int().nonnegative(),quantity:z.number().int().positive()}).strict();
export const CreateIncidentRecoverySchema=z.object({
 schemaVersion:z.literal('2.0'),expectedIncidentVersion:z.number().int().positive(),
 cause:z.enum(['CARRIER_ACCIDENT','CARRIER_NONCOMPLIANCE']),
 reservationIds:z.array(id).min(1).max(100).refine(v=>new Set(v).size===v.length,'Choose each affected reservation once.'),
 origin:LocationInputV2Schema,pickupWindow:TimeWindowV2Schema,deliveryWindow:TimeWindowV2Schema,
 timeZone:z.string().min(1).max(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}),
 remainingAllocations:z.array(RecoveryAllocationSchema).min(1).max(100).optional(),confirmRemainingCargo:z.boolean().optional(),
 consent:z.literal('AUTHORIZE_RECOVERY_SEARCH'),
}).strict().superRefine((v,ctx)=>{
 if(Date.parse(v.deliveryWindow.endsAt)<=Date.parse(v.pickupWindow.startsAt))ctx.addIssue({code:'custom',path:['deliveryWindow'],message:'Delivery must follow pickup.'});
 if(v.remainingAllocations&&new Set(v.remainingAllocations.map(a=>a.unitIndex)).size!==v.remainingAllocations.length)ctx.addIssue({code:'custom',path:['remainingAllocations'],message:'Each cargo group must appear once.'});
});
export const IncidentRecoverySchema=z.object({
 id,incidentId:id,originalRequestId:id,originalBookingId:id,originalExecutionId:id,failedCarrierId:id,
 replacementRequestId:id,replacementBookingId:id.nullable(),status:z.enum(['SEARCHING','REPLACED']),
 cause:z.enum(['CARRIER_ACCIDENT','CARRIER_NONCOMPLIANCE']),priority:z.literal('URGENT'),urgencySurcharge:z.literal(0),
 phase:z.enum(['NEEDS_ATTENTION','AWAITING_CLIENT','AWAITING_CARRIER','REPLACED']),
 version:z.number().int().positive(),createdAt:z.string().datetime({offset:true}),updatedAt:z.string().datetime({offset:true}),reservationIds:z.array(id).min(1),
}).strict();
export const IncidentRecoveryContextSchema=z.object({cases:z.array(IncidentRecoverySchema),incidents:z.array(z.object({
 id,version:z.number().int().positive(),status:z.literal('OPEN'),kind:z.string(),description:z.string(),executionId:id,
 executionStatus:z.enum(['PLANNED','IN_PROGRESS']),reservations:z.array(z.object({id,weightKg:z.number().positive().nullable(),volumeM3:z.number().positive().nullable(),allocations:z.array(RecoveryAllocationSchema).nullable()}).strict()),
}).strict())}).strict();
export const RecoveryQuoteContextSchema=z.object({recoveryId:id,failedCarrierId:id,priority:z.literal('URGENT'),urgencySurcharge:z.literal(0)}).strict().nullable();
export type IncidentRecovery=z.infer<typeof IncidentRecoverySchema>;
