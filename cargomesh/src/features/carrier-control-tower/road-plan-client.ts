import {z} from 'zod';
import type {CarrierPointRoadAssessmentV2Schema} from '@/shared/schemas/v2/road-points';
import {CarrierRoadInputV2Schema,CarrierRoadAssessmentV2Schema,type CarrierRoadInputV2} from '@/shared/schemas/v2/carrier-road-routing';
import {CarrierRoadOptionsV2Schema} from '@/shared/schemas/v2/road-options';
import {portalRequest,PortalApiError} from '@/features/carrier-portal/api';
import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import {recordData,validCarrierId,type PortalRecord} from '@/features/carrier-portal/records';
export type RoadAssessment=z.infer<typeof CarrierRoadAssessmentV2Schema>;
export type RoadAlternative=Extract<NonNullable<RoadAssessment['routing']>,{status:'estimated'}>['alternatives'][number];
export type RoadDisplay={assessment:RoadAssessment;selectedId:string;pointEvidence?:z.infer<typeof CarrierPointRoadAssessmentV2Schema>};
export async function readRoadPlanner(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(!validCarrierId(carrierId))throw new PortalApiError(400,'INVALID_CARRIER_SCOPE');
 const [options,services]=await Promise.all([portalRequest(`/api/v2/carrier-portal/carriers/${carrierId}/road-assessments/options`,{signal},fetcher),readFleetResource(carrierId,'services',signal,fetcher)]);
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const parsed=CarrierRoadOptionsV2Schema.parse(options.data);if(parsed.carrierId!==carrierId)throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 return {carrierId,options:parsed,services:services.records.filter(r=>recordData(r).mode==='ROAD'),partial:services.truncated};
}
const sameWindow=(a:{startsAt:string;endsAt:string},b:{startsAt:string;endsAt:string})=>Date.parse(a.startsAt)===Date.parse(b.startsAt)&&Date.parse(a.endsAt)===Date.parse(b.endsAt);
export function parseRoadAssessment(raw:unknown,carrierId:string,input:CarrierRoadInputV2){
 const result=CarrierRoadAssessmentV2Schema.parse(raw);
 if(result.carrierId!==carrierId||result.serviceId!==input.serviceId||result.origin.id!==input.originReferenceId||result.destination.id!==input.destinationReferenceId||!sameWindow(result.pickupWindow,input.pickupWindow)||!sameWindow(result.deliveryWindow,input.deliveryWindow))throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 if(result.routing?.status==='estimated'&&(result.routing.objective!==input.objective||result.routing.traffic!==input.traffic))throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 const trafficAware=input.traffic!=='TRAFFIC_UNAWARE';
 if(result.timeBasis!==(trafficAware?'PICKUP_WINDOW_START_ESTIMATE_ONLY':'TRAFFIC_UNAWARE_BASELINE')||(trafficAware?result.requestedDepartureTime===null||Date.parse(result.requestedDepartureTime)!==Date.parse(input.pickupWindow.startsAt):result.requestedDepartureTime!==null))throw new PortalApiError(502,'INVALID_ROAD_SCOPE');
 const reference=result.coverage.references.find(r=>r.kind==='services'&&r.id===input.serviceId);
 if(input.expectedServiceVersion!==undefined&&reference?.version!==input.expectedServiceVersion)throw new PortalApiError(409,'STALE_COVERAGE');
 return result;
}
export async function calculateCarrierRoad(carrierId:string,value:unknown,service:PortalRecord,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const input=CarrierRoadInputV2Schema.parse(value);
 if(!validCarrierId(carrierId)||service.carrierId!==carrierId||service.id!==input.serviceId||service.version!==input.expectedServiceVersion||recordData(service).mode!=='ROAD'||recordData(service).status!=='ACTIVE')throw new PortalApiError(400,'INVALID_ROAD_SERVICE');
 const response=await portalRequest(`/api/v2/carrier-portal/carriers/${carrierId}/road-assessments`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)},fetcher);
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 return parseRoadAssessment(response.data,carrierId,input);
}
export function roadAlternatives(display:RoadDisplay|null):RoadAlternative[]{return display?.assessment.routing?.status==='estimated'?display.assessment.routing.alternatives:[];}
export function selectedRoad(display:RoadDisplay|null):RoadAlternative|null{return roadAlternatives(display).find(route=>route.id===display?.selectedId)??null;}
export function roadFailure(error:unknown){
 const code=error instanceof PortalApiError?error.code:'';
 const messages:Record<string,string>={GEOCODING_NOT_CONFIGURED:'Address resolution is not configured on the server. Use a saved Carrier site with coordinates or configure Geocoding.',GEOCODING_DENIED:'Google denied address resolution. Review the server Geocoding credential.',GEOCODING_UNAVAILABLE:'Address resolution is unavailable. No city-center substitute was used.',GEOCODING_RATE_LIMITED:'Address resolution budget reached. Wait before retrying.',LOCATION_NOT_FOUND:'No precise address was found. Check street, number, city and country.',LOCATION_AMBIGUOUS:'Several addresses match. Enter a more specific address.',LOCATION_PRECISION_REQUIRED:'Select a precise property or entrance. Broad areas and city centers cannot be used as exact stops.',LOCATION_COUNTRY_UNKNOWN:'The address country could not be established.',STALE_LOCATION:'A saved site changed. Refresh planning sites and select it again.',LOCATION_COORDINATES_REQUIRED:'The saved site is inactive or has no coordinates.',INCOMPLETE_COVERAGE:'Coverage catalog is incomplete. Refresh before calculating.',ROUTING_NOT_ENABLED:'Carrier road calculation is not enabled in this environment.',ROUTES_NOT_CONFIGURED:'The server Routes credential is not configured.',ROUTING_RATE_LIMITED:'Calculation budget reached. Wait before retrying.',STALE_COVERAGE:'Coverage changed. Refresh the service catalog and calculate again.',INVALID_CITY_REFERENCE:'A city reference is no longer supported. Refresh the planner.',PICKUP_WINDOW_IN_PAST:'Pickup must start in the future.',PROVIDER_DENIED:'Google denied the routing request. Server credential access requires review.',INVALID_ROAD_SCOPE:'The returned route does not match this planning query. It was discarded.'};
 return messages[code]??(error instanceof PortalApiError&&error.status===401?'Sign in to access Carrier route calculation.':error instanceof PortalApiError&&error.status===403?'Your account cannot access this Carrier route calculation.':'Calculation unavailable. No replacement route was drawn.');
}
