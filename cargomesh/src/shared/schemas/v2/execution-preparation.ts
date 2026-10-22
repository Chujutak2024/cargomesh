import {z} from 'zod';
export const ExecutionPreparationSchema=z.object({schemaVersion:z.literal('2.0'),executionId:z.string().uuid(),
 organizationId:z.string().uuid(),requestId:z.string().uuid(),status:z.enum(['ASSIGNED','PENDING','UNKNOWN']),
 vehicleCount:z.number().int().nonnegative(),driverCount:z.number().int().nonnegative(),requiredVehicles:z.number().int().nonnegative(),
 checkedAt:z.string().datetime({offset:true}),operationalClearance:z.literal('NOT_EVALUATED')}).strict();
export type ExecutionPreparation=z.infer<typeof ExecutionPreparationSchema>;
