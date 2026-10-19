import {z} from 'zod';
import {CarrierPointRoadInputV2Schema,CarrierPointRoadAssessmentV2Schema,type CarrierPointRoadInputV2} from '@/shared/schemas/v2/road-points';
import {portalRequest,PortalApiError} from '@/features/carrier-portal/api';
import {recordData,validCarrierId,type PortalRecord} from '@/features/carrier-portal/records';
import type {RoadFields} from './road-plan-model';
import type {RoadDisplay} from './road-plan-client';
export type StopFields={kind:'DEPOT'|'ADDRESS'|'COORDINATES';depot:string;address:string;lat:string;lng:string;label:string;confirmed:boolean};
export const emptyStop:StopFields={kind:'DEPOT',depot:'',address:'',lat:'',lng:'',label:'',confirmed:false};
function stopInput(fields:StopFields){
 if(!fields.confirmed)throw new Error('Confirm both pickup and delivery locations.');
 if(fields.kind==='DEPOT'){const [depotId,version]=fields.depot.split('@');return {kind:'DEPOT',depotId,expectedVersion:Number(version),confirmed:true};}
 if(fields.kind==='ADDRESS')return {kind:'ADDRESS',address:fields.address,confirmed:true};
 if(!fields.lat.trim()||!fields.lng.trim()||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(fields.lat.trim())||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(fields.lng.trim()))throw new Error('Enter latitude and longitude as decimal numbers.');
 return {kind:'COORDINATES',lat:Number(fields.lat),lng:Number(fields.lng),label:fields.label,confirmed:true};
}
export function pointRoadInput(fields:RoadFields,origin:StopFields,destination:StopFields,service:PortalRecord,now=Date.now()){
 if(service.id!==fields.serviceId||recordData(service).mode!=='ROAD'||recordData(service).status!=='ACTIVE')throw new Error('Select an active ROAD service.');
 const result=CarrierPointRoadInputV2Schema.safeParse({schemaVersion:'2.0',serviceId:service.id,expectedServiceVersion:service.version,origin:stopInput(origin),destination:stopInput(destination),
  pickupWindow:{startsAt:fields.pickupStart,endsAt:fields.pickupEnd},deliveryWindow:{startsAt:fields.deliveryStart,endsAt:fields.deliveryEnd},objective:fields.objective,traffic:fields.traffic});
 if(!result.success)throw new Error('Check both locations and the four ordered timestamps with explicit UTC offsets (up to 31 days).');
 if(Date.parse(result.data.pickupWindow.startsAt)<=now)throw new Error('Pickup must start in the future.');return result.data;
}
const sameWindow=(a:{startsAt:string;endsAt:string},b:{startsAt:string;endsAt:string})=>Date.parse(a.startsAt)===Date.parse(b.startsAt)&&Date.parse(a.endsAt)===Date.parse(b.endsAt);
export function parsePointRoadAssessment(raw:unknown,carrierId:string,input:CarrierPointRoadInputV2,queryHash:string){
 const parsed=CarrierPointRoadAssessmentV2Schema.parse(raw),road=parsed.road;
 if(parsed.queryHash!==queryHash||road.carrierId!==carrierId||road.serviceId!==input.serviceId||!sameWindow(road.pickupWindow,input.pickupWindow)||!sameWindow(road.deliveryWindow,input.deliveryWindow)
  ||road.coverage.scope!=='PUBLISHED_POINT_COVERAGE_ONLY'||road.coverage.references.find(r=>r.kind==='services'&&r.id===input.serviceId)?.version!==input.expectedServiceVersion
  ||road.routing?.status==='estimated'&&(road.routing.objective!==input.objective||road.routing.traffic!==input.traffic))throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 const aware=input.traffic!=='TRAFFIC_UNAWARE';if(road.timeBasis!==(aware?'PICKUP_WINDOW_START_ESTIMATE_ONLY':'TRAFFIC_UNAWARE_BASELINE')||(aware?road.requestedDepartureTime===null||Date.parse(road.requestedDepartureTime)!==Date.parse(input.pickupWindow.startsAt):road.requestedDepartureTime!==null))throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 for(const [requested,stop] of [[input.origin,parsed.originStop],[input.destination,parsed.destinationStop]] as const){
  if(requested.kind==='DEPOT'&&(stop.source!=='CARRIER_DEPOT_RECORD'||stop.depotId!==requested.depotId||stop.depotVersion!==requested.expectedVersion)
   ||requested.kind!=='DEPOT'&&stop.source!=='GOOGLE_GEOCODING'
   ||requested.kind==='COORDINATES'&&(requested.lat!==stop.lat||requested.lng!==stop.lng))throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 }
 return parsed;
}
export async function calculatePointRoad(carrierId:string,value:unknown,service:PortalRecord,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<RoadDisplay>{
 const input=CarrierPointRoadInputV2Schema.parse(value);
 if(!validCarrierId(carrierId)||service.carrierId!==carrierId||service.id!==input.serviceId||service.version!==input.expectedServiceVersion||recordData(service).mode!=='ROAD'||recordData(service).status!=='ACTIVE')throw new PortalApiError(400,'INVALID_ROAD_SERVICE');
 const bytes=new TextEncoder().encode(JSON.stringify(input)),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const response=await portalRequest(`/api/v2/carrier-portal/carriers/${carrierId}/road-point-assessments`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)},fetcher);
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const pointEvidence=parsePointRoadAssessment(response.data,carrierId,input,hash),assessment=pointEvidence.road;
 return {assessment,selectedId:assessment.routing?.status==='estimated'?assessment.routing.selectedId:'',pointEvidence};
}
