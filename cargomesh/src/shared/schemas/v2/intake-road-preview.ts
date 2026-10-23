import {z} from 'zod';
export const IntakeRoadQuery=z.object({originId:z.string().uuid(),destinationId:z.string().uuid()}).strict();
const point=z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}).strict();
export const IntakeRoadResponse=z.object({schemaVersion:z.literal('2.0'),data:z.object({
 originId:z.string().uuid(),destinationId:z.string().uuid(),
 result:z.discriminatedUnion('status',[
  z.object({status:z.literal('estimated'),source:z.literal('GOOGLE_ROUTES_API'),calculatedAt:z.string().datetime({offset:true}),
   distanceMeters:z.number().positive(),durationSeconds:z.number().positive(),points:z.array(point).min(2).max(200000),truckAccess:z.literal('UNVERIFIED')}).strict(),
  z.object({status:z.enum(['blocked','unavailable']),reason:z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/)}).strict(),
 ]),
}).strict()}).strict();
export type IntakeRoadResult=z.infer<typeof IntakeRoadResponse>['data']['result'];
