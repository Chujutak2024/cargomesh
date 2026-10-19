import {CarrierRoadInputV2Schema} from '@/shared/schemas/v2/carrier-road-routing';
import type {PortalRecord} from '@/features/carrier-portal/records';
import {recordData} from '@/features/carrier-portal/records';
import type {CarrierRoadOptionsV2} from '@/shared/schemas/v2/road-options';
export type RoadFields={serviceId:string;originReferenceId:string;destinationReferenceId:string;pickupStart:string;pickupEnd:string;deliveryStart:string;deliveryEnd:string;objective:'FASTEST'|'SHORTEST_RETURNED';traffic:'TRAFFIC_UNAWARE'|'TRAFFIC_AWARE_OPTIMAL'};
export const emptyRoadFields:RoadFields={serviceId:'',originReferenceId:'',destinationReferenceId:'',pickupStart:'',pickupEnd:'',deliveryStart:'',deliveryEnd:'',objective:'FASTEST',traffic:'TRAFFIC_UNAWARE'};
export function activeRoadService(row:PortalRecord){const v=recordData(row);return v.mode==='ROAD'&&v.status==='ACTIVE';}
export function roadInput(fields:RoadFields,service:PortalRecord,options:CarrierRoadOptionsV2,now=Date.now()){
 if(!activeRoadService(service)||service.id!==fields.serviceId||service.carrierId!==options.carrierId)throw new Error('Select an active ROAD service from this Carrier.');
 if(!options.enabled)throw new Error('Carrier road calculation is disabled in this environment.');
 if(!options.references.some(r=>r.id===fields.originReferenceId)||!options.references.some(r=>r.id===fields.destinationReferenceId))throw new Error('Choose supported city references.');
 if(fields.originReferenceId===fields.destinationReferenceId)throw new Error('Choose two different city references.');
 const input=CarrierRoadInputV2Schema.safeParse({schemaVersion:'2.0',serviceId:fields.serviceId,expectedServiceVersion:service.version,originReferenceId:fields.originReferenceId,destinationReferenceId:fields.destinationReferenceId,pickupWindow:{startsAt:fields.pickupStart,endsAt:fields.pickupEnd},deliveryWindow:{startsAt:fields.deliveryStart,endsAt:fields.deliveryEnd},objective:fields.objective,traffic:fields.traffic});
 if(!input.success)throw new Error('Enter ordered pickup and delivery windows with explicit Z or UTC offsets, up to 31 days.');
 if(!Number.isFinite(now)||Date.parse(input.data.pickupWindow.startsAt)<=now)throw new Error('Pickup must start in the future.');
 return input.data;
}
export function routeSummary(distanceMeters:number,durationSeconds:number){return {distance:(distanceMeters/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' km',driving:(durationSeconds/3600).toLocaleString('en-US',{maximumFractionDigits:2})+' h driving estimate'};}
