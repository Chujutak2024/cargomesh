import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { CatalogServiceV2, type CatalogRepositoryV2 } from '../../catalog/application/catalog-service';
import { V2DraftError } from '../../freight-requests/application/draft-service';
import { CarrierRoadService, type CoveredRoadProvider, type RoadActor } from './carrier-road-service';
import { evaluateCarrierCoverage, coverageRecord, type CoverageSnapshot } from '../domain/coverage-policy';
import { createCoveredRoadProvider } from '../infrastructure/google-road-provider';
import { createCarrierRoadRouter } from '@/server/hono/routes/carrier-road-routing';
import { CarrierRoadInputV2Schema } from '@/shared/schemas/v2/carrier-road-routing';
import type { CatalogKindV2, CatalogRecordV2 } from '@/shared/schemas/v2/catalog';
import { calculateRoadRoutes } from '@/server/maps/road-routing';
import { findRoadLocation } from '@/features/v2-workspace/road-locations';

// Synthetic transport fixtures only. These two-point stubs never reach the app or live Google.
const id=(n:number)=>`a5170000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const carrierId=id(1),serviceId=id(2),operatorId=id(3),now='2026-10-17T12:00:00Z';
const actor:RoadActor={kind:'carrier',operatorId,carrierId,organizationId:null};
const window={startsAt:'2026-10-18T08:00:00Z',endsAt:'2026-10-18T10:00:00Z'};
const query={schemaVersion:'2.0' as const,serviceId,originReferenceId:'chiclayo',destinationReferenceId:'lima',
  pickupWindow:window,deliveryWindow:{startsAt:'2026-10-19T08:00:00Z',endsAt:'2026-10-19T10:00:00Z'},
  objective:'FASTEST' as const,traffic:'TRAFFIC_UNAWARE' as const};
const evidence={evidence:'SIMULATED unit fixture',verifiedAt:'2026-10-16T00:00:00Z',
  validFrom:'2026-10-16T00:00:00Z',validUntil:'2026-10-30T00:00:00Z',active:true};
function fixture():CoverageSnapshot {
  const record=(n:number,value:unknown,scoped=false)=>({id:id(n),carrierId,serviceId:scoped?serviceId:null,
    organizationId:null,version:1,createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',value});
  const area=(n:number,city:string,role:'PICKUP'|'DELIVERY')=>coverageRecord('areas',record(n,{schemaVersion:'2.0',
    role,inclusion:'INCLUDE',geography:{granularity:'CITY',countryCode:'PE',region:null,city,postalCode:null},
    source:'OWN',partnerId:null,...evidence},true));
  return {carrier:coverageRecord('carriers',record(1,{schemaVersion:'2.0',code:'TEST_CARRIER',commercialName:'Synthetic test',
    legalName:null,businessIdType:null,businessIdValue:null,registeredCountry:'JP',providerType:'CARRIER',status:'ACTIVE',operationalPhone:null})),
    service:coverageRecord('services',record(2,{schemaVersion:'2.0',mode:'ROAD',serviceClass:'FTL',maxWeightKg:10000,maxVolumeM3:30,
      responseChannels:['MANUAL'],status:'ACTIVE',admittedCargoTypes:[],temperatureRange:null,requiredCertifications:[],
      supportsHazardous:false,supportsFragile:false,supportsOversized:false})),
    areas:[area(10,'Chiclayo','PICKUP'),area(11,'Chiclayo','DELIVERY'),area(12,'Lima','PICKUP'),area(13,'Lima','DELIVERY')],
    lanes:[coverageRecord('lanes',record(20,{schemaVersion:'2.0',pickupAreaId:id(10),deliveryAreaId:id(13),
      kind:'DIRECT',mode:'ROAD',borderReviewRequired:false,...evidence,plannedTransitMinutes:null,
      transitProvenanceStatus:'UNKNOWN',crossBorderProhibited:false,crossBorderProhibitionReference:null},true))],partners:[],complete:true};
}
const decision=(s=fixture(),extra:Record<string,unknown>={})=>evaluateCarrierCoverage(s,{origin:{countryCode:'PE',city:'Chiclayo'},
  destination:{countryCode:'PE',city:'Lima'},pickupWindow:query.pickupWindow,deliveryWindow:query.deliveryWindow,now,...extra});
function setup(s=fixture(),providerHook?:(input:Parameters<CoveredRoadProvider>[0])=>void) {
  let providerCalls=0;const reads:string[]=[];
  const rows=(kind:CatalogKindV2):CatalogRecordV2[]=>kind==='carriers'?[s.carrier]:kind==='services'?[s.service]
    :kind==='areas'?s.areas:kind==='lanes'?s.lanes:kind==='partners'?s.partners:[];
  const repository:CatalogRepositoryV2={command:async()=>{throw Error('No writes allowed');},
    read:async(_actor,kind,_scope,page,recordId)=>{reads.push(kind);
      const data=rows(kind);return recordId?data.filter(r=>r.id===recordId):data.slice(page.offset,page.offset+page.limit);}};
  const provider:CoveredRoadProvider=async input=>{
    providerCalls++;providerHook?.(input);
    return {status:'estimated',source:'GOOGLE_ROUTES_API',calculatedAt:now,policyVersion:'returned-road-alternatives/v1',
      scope:'RETURNED_ALTERNATIVES_ONLY',truckAccess:'UNVERIFIED',objective:input.objective,traffic:input.traffic,
      selectedId:'google-0',alternatives:[{id:'google-0',providerIndex:0,distanceMeters:1000,durationSeconds:100,
        points:[{lat:input.origin.lat,lng:input.origin.lng},{lat:input.destination.lat,lng:input.destination.lng}],warnings:[]}],rejected:[]};
  };
  const catalog=new CatalogServiceV2(repository);
  return {s,catalog,repository,provider,reads,service:new CarrierRoadService(catalog,provider,()=>now),calls:()=>providerCalls};
}

test('coverage is service-specific, directed and independent of registration country or depots',()=>{
  const d=decision();assert.equal(d.status,'eligible');assert.equal(d.selectedLaneId,id(20));
  assert.equal(d.scope,'PUBLISHED_CITY_REFERENCE_COVERAGE_ONLY');assert.equal(d.references.length,7);
  assert.ok(d.references.some(r=>r.evidence?.startsWith('SIMULATED')));
  const inverse=decision(fixture(),{origin:{countryCode:'PE',city:'Lima'},destination:{countryCode:'PE',city:'Chiclayo'}});
  assert.equal(inverse.status,'ineligible');assert.ok(inverse.reasons.includes('NO_DIRECTED_LANE'));
});
test('known unsupported city is negative while absent catalogs remain unknown',()=>{
  assert.ok(decision(fixture(),{origin:{countryCode:'PE',city:'Piura'}}).reasons.includes('NO_PICKUP_COVERAGE'));
  const s=fixture();s.areas=[];assert.equal(decision(s).status,'unknown');
});
test('an evidenced exclusion starting partway through pickup overrides inclusion',()=>{
  const s=fixture(),exclusion=structuredClone(s.areas[0]);exclusion.id=id(30);exclusion.value.inclusion='EXCLUDE';
  exclusion.value.validFrom='2026-10-18T09:00:00Z';s.areas.push(exclusion);
  assert.equal(decision(s).status,'ineligible');assert.ok(decision(s).reasons.includes('PICKUP_EXCLUDED'));
});
test('non-overlapping exclusions do not block, but missing exclusion evidence is unknown',()=>{
  const s=fixture(),exclusion=structuredClone(s.areas[0]);exclusion.id=id(30);exclusion.value.inclusion='EXCLUDE';
  exclusion.value.validFrom=window.endsAt;s.areas.push(exclusion);assert.equal(decision(s).status,'eligible');
  exclusion.value.validFrom=window.startsAt;exclusion.value.evidence=null;assert.equal(decision(s).status,'unknown');
});
test('unsupported postal/region/polygon exclusions cannot be ignored for a city reference',()=>{
  for(const granularity of ['POSTAL_CODE','REGION','POLYGON'] as const){
    const s=fixture(),exclusion=structuredClone(s.areas[0]);exclusion.id=id(30);exclusion.value.inclusion='EXCLUDE';
    exclusion.value.geography=granularity==='POLYGON'?{granularity,countryCode:'PE',region:null,city:null,postalCode:null,
      geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}:
      {granularity,countryCode:'PE',region:granularity==='REGION'?'Lambayeque':null,
        city:granularity==='POSTAL_CODE'?'Chiclayo':null,postalCode:granularity==='POSTAL_CODE'?'14001':null};
    s.areas.push(exclusion);assert.equal(decision(s).status,'unknown',granularity);
  }
});
test('missing, future or expired inclusion evidence prevents a positive decision',()=>{
  for(const modify of [(s:CoverageSnapshot)=>{s.areas[0].value.evidence=null;},
    (s:CoverageSnapshot)=>{s.areas[0].value.verifiedAt='2026-10-18T00:00:00Z';},
    (s:CoverageSnapshot)=>{s.areas[0].value.validUntil='2026-10-17T00:00:00Z';},
    (s:CoverageSnapshot)=>{s.areas[0].value.validUntil='2026-10-18T09:00:00Z';}]){
    const s=fixture();modify(s);assert.equal(decision(s).status,'unknown');
  }
});
test('lane evidence must cover the complete pickup-to-delivery interval',()=>{
  const s=fixture();s.lanes[0].value.validUntil='2026-10-19T09:00:00Z';assert.equal(decision(s).status,'unknown');
  s.lanes=[];assert.ok(decision(s).reasons.includes('LANE_UNKNOWN'));
});
test('a persisted partner can serve coverage without partnerCarrierRef; agreement expiry blocks it',()=>{
  const s=fixture();s.areas[0].value.source='PARTNER';s.areas[0].value.partnerId=id(40);
  s.partners=[coverageRecord('partners',{...s.carrier,id:id(40),value:{schemaVersion:'2.0',registeredName:'SIMULATED partner',
    partnerCarrierRef:null,agreementValidFrom:evidence.validFrom,agreementValidUntil:evidence.validUntil,
    status:'ACTIVE',coverageEvidence:'SIMULATED agreement'}})];
  assert.equal(decision(s).status,'eligible');s.partners[0].value.agreementValidUntil='2026-10-18T09:00:00Z';
  assert.equal(decision(s).status,'unknown');s.partners=[];assert.equal(decision(s).status,'unknown');
});
test('inactive carrier/service, unsupported mode and published prohibition remain negative',()=>{
  for(const modify of [(s:CoverageSnapshot)=>{s.carrier.value.status='INACTIVE';},
    (s:CoverageSnapshot)=>{s.service.value.status='INACTIVE';},(s:CoverageSnapshot)=>{s.service.value.mode='AIR';},
    (s:CoverageSnapshot)=>{s.lanes[0].value.crossBorderProhibited=true;s.lanes[0].value.crossBorderProhibitionReference='SIMULATED prohibition';}]){
    const s=fixture();modify(s);assert.equal(decision(s).status,'ineligible');
  }
});
test('international road coverage can pass but does not establish border authorization',()=>{
  const s=fixture();s.areas[3].value.geography.countryCode='CL';
  const d=decision(s,{destination:{countryCode:'CL',city:'Lima'}});assert.equal(d.status,'eligible');assert.equal(d.borderReviewRequired,true);
});
test('incomplete catalog never confirms coverage',()=>{const s=fixture();s.complete=false;assert.equal(decision(s).status,'unknown');});
test('strict input rejects arbitrary coordinates, geometry, invalid windows and unknown keys',()=>{
  for(const input of [{...query,polyline:'invented'},{...query,originReferenceId:'x',origin:{lat:0,lng:0}},
    {...query,deliveryWindow:{startsAt:'2026-09-01T00:00:00Z',endsAt:'2026-09-02T00:00:00Z'}}])
    assert.equal(CarrierRoadInputV2Schema.safeParse(input).success,false);
});

test('provider is called only after persisted coverage reads and receives exact departure/city references',async()=>{
  const s=setup(fixture(),input=>{assert.deepEqual(s.reads,['carriers','services','areas','lanes']);
    assert.equal(input.departureTime,undefined);assert.equal(input.origin.id,'chiclayo');});
  const result=await s.service.assess(actor,query);assert.equal(s.calls(),1);assert.equal(result.data.routing?.status,'estimated');
  assert.equal(result.data.fullEligibilityEvaluated,false);assert.equal(result.data.travelAuthorization,'UNKNOWN');
  assert.equal(s.reads.length,8);assert.match(result.data.catalogFingerprint,/^[a-f0-9]{64}$/);
  assert.equal(result.data.requestedDepartureTime,null);assert.equal(result.data.timeBasis,'TRAFFIC_UNAWARE_BASELINE');
});
test('traffic-aware calculation uses pickup start and labels that limited time basis',async()=>{
  const s=setup(fixture(),input=>assert.equal(input.departureTime,query.pickupWindow.startsAt));
  const r=await s.service.assess(actor,{...query,traffic:'TRAFFIC_AWARE_OPTIMAL'});
  assert.equal(r.data.requestedDepartureTime,query.pickupWindow.startsAt);assert.equal(r.data.timeBasis,'PICKUP_WINDOW_START_ESTIMATE_ONLY');
});
test('inverse, outside coverage and expired evidence make zero provider calls',async()=>{
  for(const variant of ['inverse','outside','expired'] as const){
    const s=setup();if(variant==='expired')s.s.areas[0].value.validUntil='2026-10-17T00:00:00Z';
    const q=variant==='inverse'?{...query,originReferenceId:'lima',destinationReferenceId:'chiclayo'}
      :variant==='outside'?{...query,originReferenceId:'piura'}:query;
    const result=await s.service.assess(actor,q);assert.equal(s.calls(),0);assert.equal(result.data.routing,null);
    assert.equal(result.data.notCalculatedReason,'COVERAGE_NOT_ESTABLISHED');
  }
});
test('an administrative region cannot be filled from a UI continent group',async()=>{
  const s=setup();s.s.areas[0].value.geography.region='south-america';
  const r=await s.service.assess(actor,query);assert.equal(r.data.coverage.status,'unknown');assert.equal(s.calls(),0);
});
test('foreign catalog record and missing service stop before provider access',async()=>{
  const s=setup();s.s.areas[0].carrierId=id(99);
  await assert.rejects(s.service.assess(actor,query),(e:unknown)=>e instanceof V2DraftError&&e.httpStatus===403);assert.equal(s.calls(),0);
  const empty=setup();await assert.rejects(empty.service.assess(actor,{...query,serviceId:id(99)}),/not found/i);assert.equal(empty.calls(),0);
});
test('unsupported city, stale caller version and past pickup cannot call the provider',async()=>{
  const s=setup();
  for(const q of [{...query,originReferenceId:'not-supported'},{...query,expectedServiceVersion:2},
    {...query,pickupWindow:{startsAt:'2026-10-16T08:00:00Z',endsAt:'2026-10-16T10:00:00Z'}}])
    await assert.rejects(s.service.assess(actor,q),V2DraftError);
  assert.equal(s.calls(),0);
});
test('catalog revision during the provider call discards geometry',async()=>{
  const s=setup(fixture(),()=>{s.s.areas[0].version++;});
  await assert.rejects(s.service.assess(actor,query),(e:unknown)=>e instanceof V2DraftError&&e.code==='STALE_COVERAGE');
  assert.equal(s.calls(),1);
});
test('partial catalog beyond the bounded read horizon cannot trigger a paid route',async()=>{
  const s=setup();
  s.s.areas=Array.from({length:1001},(_,i)=>({...structuredClone(s.s.areas[i%4]),id:id(100+i)}));
  const r=await s.service.assess(actor,query);assert.equal(s.calls(),0);assert.ok(r.data.coverage.reasons.includes('CATALOG_INCOMPLETE'));
});
test('same city reference never fabricates an intra-city road route',async()=>{
  const s=setup();s.s.lanes[0].value.pickupAreaId=id(12);
  const r=await s.service.assess(actor,{...query,originReferenceId:'lima'});
  assert.equal(r.data.coverage.status,'eligible');assert.equal(r.data.notCalculatedReason,'SAME_CITY_REFERENCE');assert.equal(s.calls(),0);
});
test('provider denial retains coverage but yields no replacement geometry',async()=>{
  const s=setup(),service=new CarrierRoadService(s.catalog,async()=>({status:'unavailable',reason:'PROVIDER_DENIED',alternatives:[]}),()=>now);
  const r=await service.assess(actor,query);assert.equal(r.data.coverage.status,'eligible');assert.equal(r.data.routing?.status,'unavailable');
});
test('provider objective mismatch is rejected as an invalid correlation',async()=>{
  const s=setup(),provider:CoveredRoadProvider=async input=>{
    const r=await s.provider(input);if(r.status==='estimated')r.objective='SHORTEST_RETURNED';return r;};
  await assert.rejects(new CarrierRoadService(s.catalog,provider,()=>now).assess(actor,query),/correlation/i);
});
test('explicit future departure is forwarded into the Google request body',async()=>{
  let forwarded=false;await calculateRoadRoutes({origin:findRoadLocation('chiclayo')!,destination:findRoadLocation('lima')!,
    objective:'FASTEST',traffic:'TRAFFIC_AWARE_OPTIMAL',departureTime:query.pickupWindow.startsAt,apiKey:'unit-test-only',
    fetcher:async(_url,init)=>{forwarded=JSON.parse(String(init?.body)).departureTime===query.pickupWindow.startsAt;return new Response(null,{status:503});}});
  assert.equal(forwarded,true);
});
test('traffic-unaware requests never send a timestamp rejected by Google',async()=>{
  let checked=false;await calculateRoadRoutes({origin:findRoadLocation('chiclayo')!,destination:findRoadLocation('lima')!,
    objective:'FASTEST',traffic:'TRAFFIC_UNAWARE',departureTime:query.pickupWindow.startsAt,apiKey:'unit-test-only',
    fetcher:async(_url,init)=>{assert.equal('departureTime' in JSON.parse(String(init?.body)),false);checked=true;return new Response(null,{status:503});}});
  assert.equal(checked,true);
});
test('provider budget is carrier-scoped and globally bounded, with a one-minute reset',async()=>{
  let clock=0,calls=0;const provider=createCoveredRoadProvider({apiKey:'unit-test-only',now:()=>clock,
    fetcher:async()=>{calls++;return new Response(null,{status:503});}});
  const q={carrierId,origin:findRoadLocation('chiclayo')!,destination:findRoadLocation('lima')!,objective:'FASTEST' as const,
    traffic:'TRAFFIC_UNAWARE' as const,departureTime:query.pickupWindow.startsAt};
  for(let i=0;i<10;i++)await provider(q);
  await assert.rejects(provider(q),(e:unknown)=>e instanceof V2DraftError&&e.httpStatus===429);
  for(const c of [id(98),id(99)])for(let i=0;i<10;i++)await provider({...q,carrierId:c});
  await assert.rejects(provider({...q,carrierId:id(97)}),/budget/i);assert.equal(calls,30);
  clock=60000;await provider(q);assert.equal(calls,31);
});
test('missing server credential cannot reach the transport',async()=>{
  const provider=createCoveredRoadProvider({fetcher:async()=>{throw Error('Unexpected fetch');}});
  await assert.rejects(provider({carrierId,origin:findRoadLocation('chiclayo')!,destination:findRoadLocation('lima')!,
    objective:'FASTEST',traffic:'TRAFFIC_UNAWARE',departureTime:query.pickupWindow.startsAt}),/credential/i);
});

const url=`http://localhost:8080/api/v2/carrier-portal/carriers/${carrierId}/road-assessments`;
function http(enabled=true) {
  const s=setup(),app=new Hono().basePath('/api/v2');
  app.route('/',createCarrierRoadRouter({enabled,authenticate:async requested=>{
    if(requested!==carrierId)throw new V2DraftError('FORBIDDEN_CARRIER_IDENTITY','Forbidden.',403);return actor;},service:async()=>s.service}));
  const request=(body:unknown=query,headers:Record<string,string>={Authorization:'Bearer synthetic-test'})=>
    app.request(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
  return {...s,app,request};
}
test('HTTP authentication and same-origin cookie checks precede catalog and provider access',async()=>{
  const s=http();assert.equal((await s.request(query,{})).status,401);
  assert.equal((await s.request(query,{Authorization:'broken'})).status,401);
  assert.equal((await s.request(query,{Cookie:'synthetic=test',Origin:'https://foreign.invalid'})).status,403);
  assert.equal(s.reads.length,0);assert.equal(s.calls(),0);
});
test('HTTP private cache headers and feature gate are explicit',async()=>{
  const r=await http().request();assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store, private');
  const s=http(false);assert.equal((await s.request()).status,503);assert.equal(s.reads.length,0);
});
test('HTTP strict body, media type, malformed JSON and size checks block provider calls',async()=>{
  const s=http();
  assert.equal((await s.request({...query,geojson:'forged'})).status,400);
  assert.equal((await s.request('{')).status,400);
  assert.equal((await s.request('x'.repeat(5000))).status,413);
  assert.equal((await s.request(query,{'Content-Type':'text/plain',Authorization:'Bearer synthetic-test'})).status,400);
  assert.equal(s.calls(),0);
});
test('HTTP cross-carrier requests remain forbidden',async()=>{
  const s=http();const r=await s.app.request(url.replace(carrierId,id(88)),{method:'POST',headers:{Authorization:'Bearer synthetic-test','Content-Type':'application/json'},body:JSON.stringify(query)});
  assert.equal(r.status,403);assert.equal(s.calls(),0);
});
