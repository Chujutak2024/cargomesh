import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CarrierRoadInputV2Schema, CarrierRoadAssessmentV2Schema, ProviderRoadCalculationV2Schema } from '@/shared/schemas/v2/carrier-road-routing';
export type RoadRoutingStop={id:string;city:string;countryCode:string;lat:number;lng:number;placeId?:string;maxSnapMeters?:number};
import { findCarrierRoadLocation as findRoadLocation } from '../infrastructure/reference-locations';
import type { CatalogActorV2, CatalogServiceV2 } from '../../catalog/application/catalog-service';
import type { CatalogRecordV2, CatalogScopeV2 } from '@/shared/schemas/v2/catalog';
import { V2DraftError } from '../../freight-requests/application/draft-service';
import { coverageRecord, evaluateCarrierCoverage, type CoverageSnapshot } from '../domain/coverage-policy';
import type { RoadCalculation, RouteObjective, TrafficPreference } from '@/features/road-route-lab/contract';
import { selectRoadAlternative } from '@/server/maps/road-routing';

export type RoadActor = Extract<CatalogActorV2,{kind:'carrier'}>;
export type CoveredRoadProvider = (input:{carrierId:string;origin:RoadRoutingStop;destination:RoadRoutingStop;
  objective:RouteObjective;traffic:TrafficPreference;departureTime?:string})=>Promise<RoadCalculation>;
export type CoverageCatalogReader = Pick<CatalogServiceV2,'get'|'list'>;
const Id=z.string().uuid();
function canonical(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  const record=value as Record<string,unknown>;
  return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonical(record[key])).join(',')+'}';
}
export function coverageFingerprint(snapshot:CoverageSnapshot) {
  return createHash('sha256').update(canonical(snapshot)).digest('hex');
}
function scoped(row:CatalogRecordV2,actor:RoadActor,serviceId:string|null) {
  if(row.carrierId!==actor.carrierId||row.organizationId!==null||serviceId!==null&&row.serviceId!==serviceId)
    throw new V2DraftError('FORBIDDEN_CATALOG','Catalog scope mismatch.',403);
  return row;
}
export class CarrierRoadService {
  constructor(private readonly catalog:CoverageCatalogReader,private readonly provider:CoveredRoadProvider,
    private readonly clock:()=>string=()=>new Date().toISOString()){}

  async readCoverage(actor:RoadActor,serviceId:string):Promise<CoverageSnapshot> {
    const carrierScope={carrierId:actor.carrierId,serviceId:null};
    const serviceScope={carrierId:actor.carrierId,serviceId};
    const carrier=coverageRecord('carriers',scoped((await this.catalog.get(actor,'carriers',carrierScope,actor.carrierId)).data,actor,null));
    const service=coverageRecord('services',scoped((await this.catalog.get(actor,'services',carrierScope,serviceId)).data,actor,null));
    if(carrier.id!==actor.carrierId||service.id!==serviceId)throw new V2DraftError('INVALID_CATALOG_RESPONSE','Catalog identity mismatch.',502);
    let complete=true;
    const collection=async(kind:'areas'|'lanes'|'partners',scope:CatalogScopeV2)=>{
      const data:CatalogRecordV2[]=[];
      for(let offset=0;offset<1000;offset+=100){
        const result=await this.catalog.list(actor,kind,scope,{limit:100,offset});
        if(result.data.length>100||result.meta.offset!==offset||result.meta.limit!==100
          ||result.meta.nextOffset!==null&&result.meta.nextOffset!==offset+100)
          throw new V2DraftError('INVALID_CATALOG_RESPONSE','Invalid catalog page.',502);
        for(const raw of result.data)data.push(coverageRecord(kind,scoped(raw,actor,scope.serviceId)));
        if(new Set(data.map(r=>r.id)).size!==data.length)throw new V2DraftError('INVALID_CATALOG_RESPONSE','Duplicate catalog identity.',502);
        if(result.meta.nextOffset===null)return data.sort((a,b)=>a.id.localeCompare(b.id));
      }
      complete=false;return data.sort((a,b)=>a.id.localeCompare(b.id));
    };
    const areas=(await collection('areas',serviceScope)).map(r=>coverageRecord('areas',r));
    const lanes=(await collection('lanes',serviceScope)).map(r=>coverageRecord('lanes',r));
    const partners=areas.some(r=>r.value.source==='PARTNER')
      ?(await collection('partners',carrierScope)).map(r=>coverageRecord('partners',r)):[];
    return {carrier,service,areas,lanes,partners,complete};
  }

  async assess(actor:RoadActor,raw:unknown) {
    Id.parse(actor.operatorId);Id.parse(actor.carrierId);
    const input=CarrierRoadInputV2Schema.parse(raw),now=this.clock();
    const origin=findRoadLocation(input.originReferenceId),destination=findRoadLocation(input.destinationReferenceId);
    if(!origin||!destination)throw new V2DraftError('INVALID_CITY_REFERENCE','Supported server city references are required.',400);
    if(Date.parse(input.pickupWindow.startsAt)<Date.parse(now))throw new V2DraftError('PICKUP_WINDOW_IN_PAST','A future pickup window is required for this estimate.',400);
    const before=await this.readCoverage(actor,input.serviceId),stamp=coverageFingerprint(before);
    if(input.expectedServiceVersion!==undefined&&input.expectedServiceVersion!==before.service.version)
      throw new V2DraftError('STALE_COVERAGE','Service version changed; re-evaluate coverage.',409);
    // RoadLocation.region is a continent/UI group, never an administrative region.
    const coverage=evaluateCarrierCoverage(before,{origin:{countryCode:origin.countryCode,city:origin.city},
      destination:{countryCode:destination.countryCode,city:destination.city},pickupWindow:input.pickupWindow,
      deliveryWindow:input.deliveryWindow,now});
    let notCalculatedReason:'COVERAGE_NOT_ESTABLISHED'|'SAME_CITY_REFERENCE'|'DISCONNECTED_NETWORKS'|null=null;
    let routing:RoadCalculation|null=null;
    if(coverage.status!=='eligible')notCalculatedReason='COVERAGE_NOT_ESTABLISHED';
    else if(origin.id===destination.id)notCalculatedReason='SAME_CITY_REFERENCE';
    else if(origin.landNetwork!==destination.landNetwork)notCalculatedReason='DISCONNECTED_NETWORKS';
    else {
      const result=await this.provider({carrierId:actor.carrierId,origin,destination,objective:input.objective,
        traffic:input.traffic,departureTime:input.traffic==='TRAFFIC_UNAWARE'?undefined:input.pickupWindow.startsAt});
      const parsed=ProviderRoadCalculationV2Schema.safeParse(result);
      if(!parsed.success)throw new V2DraftError('INVALID_ROUTING_RESPONSE','Invalid provider result.',502);
      routing=parsed.data;
      if(routing.status==='estimated') {
        if(routing.objective!==input.objective||routing.traffic!==input.traffic
          ||routing.selectedId!==selectRoadAlternative(routing.alternatives,input.objective)?.id)
          throw new V2DraftError('INVALID_ROUTING_RESPONSE','Routing request correlation failed.',502);
        if(coverageFingerprint(await this.readCoverage(actor,input.serviceId))!==stamp)
          throw new V2DraftError('STALE_COVERAGE','Catalog changed during calculation; geometry discarded.',409);
      }
    }
    const reference=({id,city,countryCode,lat,lng}:RoadRoutingStop)=>({id,city,countryCode,lat,lng});
    return {schemaVersion:'2.0' as const,data:CarrierRoadAssessmentV2Schema.parse({
      schemaVersion:'2.0',carrierId:actor.carrierId,serviceId:input.serviceId,checkedAt:now,
      scope:'COVERAGE_AND_ROAD_ESTIMATE_ONLY',evidenceScope:'PUBLISHED_CARRIER_CATALOG',
      origin:reference(origin),destination:reference(destination),pickupWindow:input.pickupWindow,deliveryWindow:input.deliveryWindow,
      catalogFingerprint:stamp,coverage,routing,notCalculatedReason,
      requestedDepartureTime:input.traffic==='TRAFFIC_UNAWARE'?null:input.pickupWindow.startsAt,
      timeBasis:input.traffic==='TRAFFIC_UNAWARE'?'TRAFFIC_UNAWARE_BASELINE':'PICKUP_WINDOW_START_ESTIMATE_ONLY',
      consistency:'NON_ATOMIC_READ_RECHECKED_AFTER_PROVIDER',
      fullEligibilityEvaluated:false,availabilityEvaluated:false,cargoCompatibilityEvaluated:false,transitCountriesEvaluated:false,capacityReserved:false,
      travelAuthorization:'UNKNOWN',requiresCommitRevalidation:true})};
  }
}
