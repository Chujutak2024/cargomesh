import {z} from 'zod';
import {TimeWindowV2Schema} from './freight-request';
import {CarrierRoadAssessmentV2Schema} from './carrier-road-routing';
const Id=z.string().uuid(),Instant=z.string().datetime({offset:true});
export const RoadPointV2Schema=z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}).strict();
export const RoadStopInputV2Schema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('DEPOT'),depotId:Id,expectedVersion:z.number().int().positive(),confirmed:z.literal(true)}).strict(),
 z.object({kind:z.literal('ADDRESS'),address:z.string().trim().min(8).max(500),confirmed:z.literal(true)}).strict(),
 z.object({kind:z.literal('COORDINATES'),...RoadPointV2Schema.shape,label:z.string().trim().min(1).max(200),confirmed:z.literal(true)}).strict(),
]);
export const CarrierPointRoadInputV2Schema=z.object({schemaVersion:z.literal('2.0'),serviceId:Id,expectedServiceVersion:z.number().int().positive(),
 origin:RoadStopInputV2Schema,destination:RoadStopInputV2Schema,pickupWindow:TimeWindowV2Schema,deliveryWindow:TimeWindowV2Schema,
 objective:z.enum(['FASTEST','SHORTEST_RETURNED']),traffic:z.enum(['TRAFFIC_UNAWARE','TRAFFIC_AWARE_OPTIMAL']),
}).strict().refine(x=>Date.parse(x.pickupWindow.startsAt)<=Date.parse(x.deliveryWindow.startsAt)
 &&Date.parse(x.pickupWindow.endsAt)<=Date.parse(x.deliveryWindow.endsAt)
 &&Date.parse(x.deliveryWindow.endsAt)-Date.parse(x.pickupWindow.startsAt)<=31*86400000,'Ordered windows, at most 31 days, are required.');
export type RoadStopInputV2=z.infer<typeof RoadStopInputV2Schema>;
export type CarrierPointRoadInputV2=z.infer<typeof CarrierPointRoadInputV2Schema>;
export const ResolvedRoadStopV2Schema=z.object({...RoadPointV2Schema.shape,label:z.string().min(1).max(500),
 countryCode:z.string().regex(/^[A-Z]{2}$/),city:z.string().min(1).max(200).nullable(),region:z.string().max(200).nullable(),postalCode:z.string().max(100).nullable(),
 placeId:z.string().min(1).max(300).nullable(),source:z.enum(['CARRIER_DEPOT_RECORD','GOOGLE_GEOCODING']),resolvedAt:Instant,
 precision:z.enum(['RECORDED','ROOFTOP','RANGE_INTERPOLATED']),depotId:Id.nullable(),depotVersion:z.number().int().positive().nullable(),
 accessStatus:z.literal('UNVERIFIED'),
}).strict();
export type ResolvedRoadStopV2=z.infer<typeof ResolvedRoadStopV2Schema>;
export const CarrierPointRoadAssessmentV2Schema=z.object({schemaVersion:z.literal('2.0'),queryHash:z.string().regex(/^[a-f0-9]{64}$/),
 road:CarrierRoadAssessmentV2Schema,originStop:ResolvedRoadStopV2Schema,destinationStop:ResolvedRoadStopV2Schema,
 maximumRoadSnapMeters:z.literal(200),scope:z.literal('POINT_TO_POINT_PLANNING_ONLY'),
}).strict().superRefine((x,ctx)=>{if(x.road.origin.lat!==x.originStop.lat||x.road.origin.lng!==x.originStop.lng||x.road.destination.lat!==x.destinationStop.lat||x.road.destination.lng!==x.destinationStop.lng)
 ctx.addIssue({code:z.ZodIssueCode.custom,message:'Stop geometry mismatch.'});});
