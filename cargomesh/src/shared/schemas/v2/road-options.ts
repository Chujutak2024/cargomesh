import {z} from 'zod';
/** Server-owned representative cities; not commercial facilities or evidence of coverage. */
export const CarrierRoadOptionsV2Schema=z.object({schemaVersion:z.literal('2.0'),carrierId:z.string().uuid(),enabled:z.boolean(),geocodingConfigured:z.boolean().optional(),
 references:z.array(z.object({id:z.string().min(1).max(50),city:z.string().min(1).max(200),countryCode:z.string().regex(/^[A-Z]{2}$/)}).strict()).min(1).max(500),
 scope:z.literal('REPRESENTATIVE_CITY_REFERENCES_ONLY'),
}).strict().refine(v=>new Set(v.references.map(r=>r.id)).size===v.references.length,'Duplicate reference.');
export type CarrierRoadOptionsV2=z.infer<typeof CarrierRoadOptionsV2Schema>;
