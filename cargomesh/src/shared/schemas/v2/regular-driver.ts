import {z} from 'zod';
const Id=z.string().uuid();
export const RegularDriverValue=z.object({schemaVersion:z.literal('2.0'),serviceId:Id,
 driverId:Id.nullable(),expectedVersion:z.number().int().nonnegative()}).strict();
export const RegularDriverRecord=z.object({assetId:Id,carrierId:Id,serviceId:Id,
 driverId:Id.nullable(),version:z.number().int().positive(),updatedAt:z.string().datetime({offset:true})}).strict();
export type RegularDriverRecordV2=z.infer<typeof RegularDriverRecord>;
