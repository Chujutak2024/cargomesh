import {z} from 'zod';
import type {IntakeRoadResult} from '@/shared/schemas/v2/intake-road-preview';
type Point={lat:number;lng:number};
const point=z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)});
const route=z.object({points:z.array(point).min(2).max(200000),distanceMeters:z.number().finite().positive(),durationMillis:z.number().finite().positive(),
 legs:z.array(z.object({steps:z.array(z.object({travelMode:z.string(),maneuver:z.string().min(1)})).min(1)})).min(1)});
function distance(a:Point,b:Point){const rad=(v:number)=>v*Math.PI/180,h=Math.sin(rad(a.lat-b.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(a.lng-b.lng)/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));}
/** Browser Routes returns meters/milliseconds. Geometry and every step require evidence. */
export function browserRoadResult(raw:unknown,origin:Point,destination:Point,calculatedAt:string):IntakeRoadResult{
 const parsed=route.safeParse(raw);
 if(!parsed.success)return {status:'unavailable',reason:'NO_VALID_ROAD_ROUTE'};
 const value=parsed.data;
 if(value.legs.some(leg=>leg.steps.some(step=>step.travelMode!=='DRIVING'||['FERRY','FERRY_TRAIN'].includes(step.maneuver))))return {status:'unavailable',reason:'NON_ROAD_SEGMENT'};
 if(distance(origin,value.points[0])>5000||distance(destination,value.points.at(-1)!)>5000)return {status:'unavailable',reason:'ENDPOINT_MISMATCH'};
 return {status:'estimated',source:'GOOGLE_ROUTES_API',calculatedAt,truckAccess:'UNVERIFIED',distanceMeters:value.distanceMeters,durationSeconds:value.durationMillis/1000,points:value.points};
}
