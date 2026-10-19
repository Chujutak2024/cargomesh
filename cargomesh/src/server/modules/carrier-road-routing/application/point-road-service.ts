import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CarrierPointRoadInputV2Schema,CarrierPointRoadAssessmentV2Schema,ResolvedRoadStopV2Schema,type RoadStopInputV2,type ResolvedRoadStopV2} from '@/shared/schemas/v2/road-points';
import {ProviderRoadCalculationV2Schema} from '@/shared/schemas/v2/carrier-road-routing';
import {parseCatalogRecordV2,CatalogInputsV2} from '@/shared/schemas/v2/catalog';
import {CarrierRoadService,coverageFingerprint,type CoverageCatalogReader,type CoveredRoadProvider,type RoadActor} from './carrier-road-service';
import {evaluateCarrierCoverage} from '../domain/coverage-policy';
import {stopDistance,type GeocodeStop} from '../infrastructure/google-geocoding';
import {selectRoadAlternative} from '@/server/maps/road-routing';
import {V2DraftError} from '../../freight-requests/application/draft-service';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class CarrierPointRoadService{
 constructor(private readonly catalog:CoverageCatalogReader,private readonly provider:CoveredRoadProvider,private readonly geocode:GeocodeStop,private readonly clock:()=>string=()=>new Date().toISOString()){}
 async assess(actor:RoadActor,raw:unknown){
  z.string().uuid().parse(actor.carrierId);z.string().uuid().parse(actor.operatorId);
  const input=CarrierPointRoadInputV2Schema.parse(raw),now=this.clock();
  if(Date.parse(input.pickupWindow.startsAt)<=Date.parse(now))throw new V2DraftError('PICKUP_WINDOW_IN_PAST','A future pickup window is required.',400);
  const reader=new CarrierRoadService(this.catalog,this.provider,this.clock),before=await reader.readCoverage(actor,input.serviceId),stamp=coverageFingerprint(before);
  if(before.service.version!==input.expectedServiceVersion)throw new V2DraftError('STALE_COVERAGE','Service version changed.',409);
  if(before.carrier.value.status!=='ACTIVE'||before.service.value.status!=='ACTIVE'||before.service.value.mode!=='ROAD')throw new V2DraftError('INVALID_ROAD_SERVICE','An active Carrier and ROAD service are required.',422);
  if(!before.complete)throw new V2DraftError('INCOMPLETE_COVERAGE','Refresh the incomplete coverage catalog.',409);
  const depotChecks:Array<()=>Promise<void>>=[];
  const resolve=async(stop:RoadStopInputV2):Promise<ResolvedRoadStopV2>=>{
   if(stop.kind!=='DEPOT'){
    const resolved=ResolvedRoadStopV2Schema.parse(await this.geocode(actor.carrierId,stop));
    if(resolved.source!=='GOOGLE_GEOCODING'||resolved.depotId!==null||resolved.depotVersion!==null||Date.parse(resolved.resolvedAt)>Date.parse(this.clock())
     ||stop.kind==='COORDINATES'&&(resolved.lat!==stop.lat||resolved.lng!==stop.lng))throw new V2DraftError('INVALID_GEOCODING_RESPONSE','Location correlation failed.',502);
    return resolved;
   }
   const read=async()=>{
    const row=parseCatalogRecordV2('depots',(await this.catalog.get(actor,'depots',{carrierId:actor.carrierId,serviceId:null},stop.depotId)).data);
    if(row.id!==stop.depotId||row.carrierId!==actor.carrierId||row.organizationId!==null)throw new V2DraftError('FORBIDDEN_CATALOG','Site scope mismatch.',403);
    return row;
   };
   const row=await read(),value=CatalogInputsV2.depots.parse(row.value),loc=value.location;
   if(row.version!==stop.expectedVersion)throw new V2DraftError('STALE_LOCATION','The saved site changed. Refresh planning sites.',409);
   if(!value.active||loc.lat===null||loc.lng===null)throw new V2DraftError('LOCATION_COORDINATES_REQUIRED','Select an active saved site with coordinates.',422);
   const original=hash(row);depotChecks.push(async()=>{if(hash(await read())!==original)throw new V2DraftError('STALE_LOCATION','The saved site changed. Geometry was discarded.',409);});
   return ResolvedRoadStopV2Schema.parse({lat:loc.lat,lng:loc.lng,label:loc.label,countryCode:loc.countryCode,city:loc.city,region:loc.region,postalCode:null,
    placeId:null,source:'CARRIER_DEPOT_RECORD',resolvedAt:now,precision:'RECORDED',depotId:row.id,depotVersion:row.version,accessStatus:'UNVERIFIED'});
  };
  // Resolve sequentially: an invalid pickup must not incur a second address lookup.
  const origin=await resolve(input.origin),destination=await resolve(input.destination);
  const recheck=async()=>{if(coverageFingerprint(await reader.readCoverage(actor,input.serviceId))!==stamp)throw new V2DraftError('STALE_COVERAGE','Coverage changed. Recalculate.',409);for(const check of depotChecks)await check();};
  await recheck();
  const coverage=evaluateCarrierCoverage(before,{origin,destination,pickupWindow:input.pickupWindow,deliveryWindow:input.deliveryWindow,now});
  const reference=(stop:ResolvedRoadStopV2)=>({id:hash(stop).slice(0,40),lat:stop.lat,lng:stop.lng,city:stop.city,countryCode:stop.countryCode});
  let routing:z.infer<typeof ProviderRoadCalculationV2Schema>|null=null;
  let notCalculatedReason:'COVERAGE_NOT_ESTABLISHED'|'SAME_STOP'|null=null;
  if(coverage.status!=='eligible')notCalculatedReason='COVERAGE_NOT_ESTABLISHED';
  else if(stopDistance(origin,destination)<1)notCalculatedReason='SAME_STOP';
  else{
   const waypoint=(stop:ResolvedRoadStopV2)=>({...reference(stop),city:stop.city??'Unresolved city',...(stop.placeId?{placeId:stop.placeId}:{}),maxSnapMeters:200});
   routing=ProviderRoadCalculationV2Schema.parse(await this.provider({carrierId:actor.carrierId,origin:waypoint(origin),destination:waypoint(destination),objective:input.objective,traffic:input.traffic,
    departureTime:input.traffic==='TRAFFIC_UNAWARE'?undefined:input.pickupWindow.startsAt}));
   if(routing.status==='estimated'){
    if(routing.objective!==input.objective||routing.traffic!==input.traffic||routing.selectedId!==selectRoadAlternative(routing.alternatives,input.objective)?.id
     ||routing.alternatives.some(r=>stopDistance(origin,r.points[0])>200||stopDistance(destination,r.points.at(-1)!)>200))throw new V2DraftError('INVALID_ROUTING_RESPONSE','Point route correlation failed.',502);
   }
   await recheck();
  }
  return {schemaVersion:'2.0' as const,data:CarrierPointRoadAssessmentV2Schema.parse({schemaVersion:'2.0',queryHash:hash(input),originStop:origin,destinationStop:destination,
   maximumRoadSnapMeters:200,scope:'POINT_TO_POINT_PLANNING_ONLY',road:{schemaVersion:'2.0',carrierId:actor.carrierId,serviceId:input.serviceId,checkedAt:now,
    scope:'COVERAGE_AND_ROAD_ESTIMATE_ONLY',evidenceScope:'PUBLISHED_CARRIER_CATALOG',origin:reference(origin),destination:reference(destination),pickupWindow:input.pickupWindow,deliveryWindow:input.deliveryWindow,
    catalogFingerprint:stamp,coverage,routing,notCalculatedReason,requestedDepartureTime:input.traffic==='TRAFFIC_UNAWARE'?null:input.pickupWindow.startsAt,
    timeBasis:input.traffic==='TRAFFIC_UNAWARE'?'TRAFFIC_UNAWARE_BASELINE':'PICKUP_WINDOW_START_ESTIMATE_ONLY',consistency:'NON_ATOMIC_READ_RECHECKED_AFTER_PROVIDER',
    fullEligibilityEvaluated:false,availabilityEvaluated:false,cargoCompatibilityEvaluated:false,transitCountriesEvaluated:false,capacityReserved:false,travelAuthorization:'UNKNOWN',requiresCommitRevalidation:true}})};
 }
}
