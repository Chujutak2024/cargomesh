import {CarrierPointRoadService} from '@/server/modules/carrier-road-routing/application/point-road-service';
import {geocodeRoadStop} from '@/server/modules/carrier-road-routing/infrastructure/google-geocoding';
import {CarrierRoadOptionsV2Schema} from '@/shared/schemas/v2/road-options';
import {carrierRoadReferences} from '@/server/modules/carrier-road-routing/infrastructure/reference-locations';
import { Hono } from 'hono';
import { z } from 'zod';
import { carrierPortalIdentity } from './carrier-portal';
import { requireAuthenticatedCarrier } from '@/server/auth/carrier';
import { CarrierRoadService, type RoadActor } from '@/server/modules/carrier-road-routing/application/carrier-road-service';
import { CatalogServiceV2 } from '@/server/modules/catalog/application/catalog-service';
import { catalogRepositoryV2 } from '@/server/modules/catalog/infrastructure/supabase-catalog-repository';
import { coveredRoadProvider } from '@/server/modules/carrier-road-routing/infrastructure/google-road-provider';
import { V2DraftError } from '@/server/modules/freight-requests/application/draft-service';

async function body(request:Request) {
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
    throw new V2DraftError('VALIDATION_ERROR','JSON body required.',400);
  const reader=request.body?.getReader();
  if(!reader)throw new V2DraftError('VALIDATION_ERROR','JSON body required.',400);
  const parts:Uint8Array[]=[];let bytes=0;
  try {
    while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
      if(bytes>4096){await reader.cancel();throw new V2DraftError('PAYLOAD_TOO_LARGE','Routing body exceeds 4096 bytes.',413);}parts.push(part.value);}
    const all=new Uint8Array(bytes);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}
    try{return JSON.parse(new TextDecoder().decode(all)) as unknown;}
    catch{throw new V2DraftError('VALIDATION_ERROR','Valid JSON required.',400);}
  } finally {reader.releaseLock();}
}
export function createCarrierRoadRouter(dependencies:{enabled?:boolean;authenticate?:(carrierId:string)=>Promise<RoadActor>;
  service?:()=>Promise<Pick<CarrierRoadService,'assess'>>;pointService?:()=>Promise<Pick<CarrierPointRoadService,'assess'>>}={}) {
  const router=new Hono();
  const provider=coveredRoadProvider;
  router.get('/carrier-portal/carriers/:carrierId/road-assessments/options',c=>carrierPortalIdentity(c,async()=>{
    const carrierId=z.string().uuid().parse(c.req.param('carrierId'));
    const actor=await (dependencies.authenticate??requireAuthenticatedCarrier)(carrierId);
    if(actor.carrierId!==carrierId)throw new V2DraftError('FORBIDDEN_CARRIER_IDENTITY','Carrier scope mismatch.',403);
    return c.json({schemaVersion:'2.0',data:CarrierRoadOptionsV2Schema.parse({schemaVersion:'2.0',carrierId,
      enabled:dependencies.enabled??process.env.CARGOMESH_CARRIER_ROAD_ENABLED==='true',geocodingConfigured:!!process.env.GOOGLE_GEOCODING_API_KEY?.trim(),
      references:carrierRoadReferences(),scope:'REPRESENTATIVE_CITY_REFERENCES_ONLY'})});
  }));
  router.post('/carrier-portal/carriers/:carrierId/road-assessments',c=>carrierPortalIdentity(c,async()=>{
    const carrierId=z.string().uuid().parse(c.req.param('carrierId'));
    const actor=await (dependencies.authenticate??requireAuthenticatedCarrier)(carrierId);
    if(actor.carrierId!==carrierId)throw new V2DraftError('FORBIDDEN_CARRIER_IDENTITY','Carrier scope mismatch.',403);
    if(!(dependencies.enabled??process.env.CARGOMESH_CARRIER_ROAD_ENABLED==='true'))
      throw new V2DraftError('ROUTING_NOT_ENABLED','Carrier road evaluation is not enabled.',503);
    const input=await body(c.req.raw);
    const service=dependencies.service?await dependencies.service():new CarrierRoadService(new CatalogServiceV2(await catalogRepositoryV2()),provider);
    return c.json(await service.assess(actor,input));
  }));
  router.post('/carrier-portal/carriers/:carrierId/road-point-assessments',c=>carrierPortalIdentity(c,async()=>{
    const carrierId=z.string().uuid().parse(c.req.param('carrierId'));
    const actor=await (dependencies.authenticate??requireAuthenticatedCarrier)(carrierId);
    if(actor.carrierId!==carrierId)throw new V2DraftError('FORBIDDEN_CARRIER_IDENTITY','Carrier scope mismatch.',403);
    if(!(dependencies.enabled??process.env.CARGOMESH_CARRIER_ROAD_ENABLED==='true'))throw new V2DraftError('ROUTING_NOT_ENABLED','Carrier road evaluation is not enabled.',503);
    const input=await body(c.req.raw);
    const service=dependencies.pointService?await dependencies.pointService():new CarrierPointRoadService(new CatalogServiceV2(await catalogRepositoryV2()),provider,geocodeRoadStop);
    return c.json(await service.assess(actor,input));
  }));
  return router;
}
export const carrierRoadRouter=createCarrierRoadRouter();
