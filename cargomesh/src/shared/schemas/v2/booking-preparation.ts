import {z} from 'zod';
export const BookingPreparationInputSchema=z.object({expectedVersion:z.number().int().positive(),consent:z.literal('PREPARE_AUTHORIZED_CAPACITY')}).strict();
export const BookingPreparationResponseSchema=z.object({schemaVersion:z.literal('2.0'),data:z.object({bookingId:z.string().uuid(),status:z.enum(['PREPARED_AWAITING_CARRIER','SCHEDULED']),executionIds:z.array(z.string().uuid()),holdIds:z.array(z.string().uuid())}).strict()}).strict();
