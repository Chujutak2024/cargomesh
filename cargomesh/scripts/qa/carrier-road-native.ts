/** LOCAL READ-ONLY harness. Does not mint/verify browser JWTs or touch hosted Supabase. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Hono} from 'hono';
import {CatalogServiceV2,type CatalogRepositoryV2} from '@/server/modules/catalog/application/catalog-service';
import {CarrierRoadService,type RoadActor} from '@/server/modules/carrier-road-routing/application/carrier-road-service';
import {createCoveredRoadProvider} from '@/server/modules/carrier-road-routing/infrastructure/google-road-provider';
import {createCarrierRoadRouter} from '@/server/hono/routes/carrier-road-routing';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
import {z} from 'zod';

const appDir=resolve(process.cwd()),root=resolve(appDir,'..');
assert.equal(JSON.parse(readFileSync(resolve(appDir,'package.json'),'utf8')).name,'cargomesh','Run from cargomesh/');
const container='supabase_db_hac45-carrier-local',bank='hac50_scenario_fleet80_global_v1';
const manifest=JSON.parse(readFileSync(resolve(root,'supabase/scenarios/v2-carrier-fleet-80/manifest.json'),'utf8'));
const output=process.argv[2];if(!output)throw Error('Evidence directory required');mkdirSync(output,{recursive:true});
const id=z.string().uuid();
const literal=(value:string|null)=>value===null?'null':"'"+id.parse(value)+"'";
const sql=(query:string)=>execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',bank],
  {input:query,encoding:'utf8',maxBuffer:12*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const marker=sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database();");
assert.equal(marker,'LOCAL_ONLY:v2-carrier-fleet-80','Owned local scenario bank required');
const countQuery="select jsonb_build_object('carriers',(select count(*) from public.carriers),'areas',(select count(*) from public.service_areas),'lanes',(select count(*) from public.service_lanes),'assets',(select count(*) from public.transport_assets),'drivers',(select count(*) from public.drivers),'bookings',(select count(*) from public.bookings));";
const before=sql(countQuery);
const env=readFileSync(resolve(appDir,'.env.local'),'utf8');
const key=env.match(/^GOOGLE_ROUTES_API_KEY\s*=\s*(.+)\s*$/m)?.[1].trim().replace(/^['"]|['"]$/g,'');
assert.ok(key,'Private server Routes credential required');
let providerCalls=0,catalogReads=0;
const upstreamDiagnostics:unknown[]=[];
const real=createCoveredRoadProvider({apiKey:key,fetcher:async(...args)=>{providerCalls++;const response=await fetch(...args);
  if(!response.ok){const data=await response.clone().json();upstreamDiagnostics.push({httpStatus:response.status,
    status:data.error?.status??null,message:typeof data.error?.message==='string'
      ?data.error.message.replaceAll(key!,'[REDACTED]').replace(/AIza[0-9A-Za-z_-]+/g,'[REDACTED]').slice(0,400):null});}
  return response;}});
const report:{[key:string]:unknown}={checkedAt:new Date().toISOString(),bank,sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  provenance:'SIMULATED_CARRIER_CATALOG_WITH_REAL_GOOGLE_ROUTES',
  authScope:'NATIVE_POSTGRES_AUTHENTICATED_ROLE_AND_IDENTITY; BROWSER_JWT_SIGNATURE_NOT_EXERCISED',
  geometryPersisted:false,results:[],completed:false};
const results:Record<string,unknown>[]=[];
function context(label:string){
  const carrier=manifest.carriers.find((c:{label:string})=>c.label===label);assert.ok(carrier);
  const actor:RoadActor={kind:'carrier',carrierId:carrier.id,operatorId:carrier.operatorId,organizationId:null};
  const session=(statement:string)=>'begin read only; set local role authenticated; set local request.jwt.claims = '
    +"'"+JSON.stringify({sub:id.parse(carrier.userId),role:'authenticated'})+"'; "+statement+'; rollback;';
  const identity=()=>JSON.parse(sql(session(`select public.get_v2_carrier_identity(${literal(carrier.id)})`)));
  const repository:CatalogRepositoryV2={command:async()=>{throw Error('No writes allowed');},read:async(_actor,kind,scope,page,recordId)=>{
    assert.ok(['carriers','services','areas','lanes','partners'].includes(kind));catalogReads++;
    return JSON.parse(sql(session(`select public.read_v2_carrier_catalog(${literal(carrier.operatorId)},'${kind}',${literal(scope.carrierId)},${literal(scope.serviceId)},${literal(recordId)},${page.limit},${page.offset})`)));
  }};
  const app=new Hono().basePath('/api/v2');
  app.route('/',createCarrierRoadRouter({enabled:true,authenticate:async carrierId=>{
    const verified=identity();if(verified.carrierId!==carrierId||verified.operatorId!==actor.operatorId)
      throw new V2DraftError('FORBIDDEN_CARRIER_IDENTITY','Carrier scope mismatch.',403);return actor;},
    service:async()=>new CarrierRoadService(new CatalogServiceV2(repository),real)}));
  const request=(query:Record<string,unknown>,auth=true)=>app.request(`http://localhost:8080/api/v2/carrier-portal/carriers/${carrier.id}/road-assessments`,
    {method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer local-sql-harness'}:{})},body:JSON.stringify(query)});
  return {carrier,actor,identity,repository,request};
}
const c04=context('C04');
const query={schemaVersion:'2.0',serviceId:c04.carrier.serviceIds[0],originReferenceId:'chiclayo',destinationReferenceId:'lima',
  pickupWindow:{startsAt:'2026-10-18T08:00:00Z',endsAt:'2026-10-18T10:00:00Z'},
  deliveryWindow:{startsAt:'2026-10-19T08:00:00Z',endsAt:'2026-10-19T10:00:00Z'},objective:'FASTEST',traffic:'TRAFFIC_UNAWARE'};
async function run(name:string,ctx:ReturnType<typeof context>,input:Record<string,unknown>,expected:string,paid:number){
  const previous=providerCalls;const response=await ctx.request(input);const body=await response.json();
  report.lastObservation={name,httpStatus:response.status,errorCode:body.error?.code??null,
    coverageStatus:body.data?.coverage?.status??null,routeStatus:body.data?.routing?.status??null,
    routeReason:body.data?.routing?.reason??null};
  assert.equal(response.status,200,name+': HTTP');assert.equal(body.data.coverage.status,expected,name+': coverage');
  assert.equal(providerCalls-previous,paid,name+': upstream call count');
  const r=body.data.routing;
  if(paid){assert.equal(r.status,'estimated');assert.equal(r.source,'GOOGLE_ROUTES_API');assert.equal(r.truckAccess,'UNVERIFIED');}
  else assert.equal(r,null,name+': no fallback route');
  const safe={name,httpStatus:response.status,coverage:body.data.coverage.status,reasons:body.data.coverage.reasons,
    catalogFingerprint:body.data.catalogFingerprint,selectedLaneId:body.data.coverage.selectedLaneId,
    providerCalls:providerCalls-previous,requestedDepartureTime:body.data.requestedDepartureTime,
    routeStatus:r?.status??null,objective:r?.objective??null,selectedId:r?.selectedId??null,
    alternatives:(r?.alternatives??[]).map((a:{id:string;distanceMeters:number;durationSeconds:number;points:unknown[]})=>
      ({id:a.id,distanceMeters:a.distanceMeters,durationSeconds:a.durationSeconds,pointCount:a.points.length,
        geometrySha256:createHash('sha256').update(JSON.stringify(a.points)).digest('hex')})),
    fullEligibilityEvaluated:body.data.fullEligibilityEvaluated,travelAuthorization:body.data.travelAuthorization};
  results.push(safe);console.log(JSON.stringify(safe));
}
async function main(){try {
  if(process.argv.includes('--aware-only')) {
    await run('C04 future pickup traffic-aware estimate',c04,{...query,traffic:'TRAFFIC_AWARE_OPTIMAL'},'eligible',1);
  } else {
  await run('C04 declared Chiclayo to Lima; fastest',c04,query,'eligible',1);
  await run('C04 declared Chiclayo to Lima; shortest returned',c04,{...query,objective:'SHORTEST_RETURNED'},'eligible',1);
  await run('C04 reverse lane not published',c04,{...query,originReferenceId:'lima',destinationReferenceId:'chiclayo'},'ineligible',0);
  await run('C04 Piura outside pickup footprint',c04,{...query,originReferenceId:'piura'},'ineligible',0);
  await run('C04 expired coverage',c04,{...query,pickupWindow:{startsAt:'2026-10-31T08:00:00Z',endsAt:'2026-10-31T10:00:00Z'},
    deliveryWindow:{startsAt:'2026-11-01T08:00:00Z',endsAt:'2026-11-01T10:00:00Z'}},'unknown',0);
  const c09=context('C09');
  await run('C09 Madrid to Barcelona is not a direct declared lane',c09,{...query,serviceId:c09.carrier.serviceIds[0],originReferenceId:'madrid',destinationReferenceId:'barcelona'},'ineligible',0);
  const c01=context('C01');
  await run('C01 time-specific pickup exclusion',c01,{...query,serviceId:c01.carrier.serviceIds[0],originReferenceId:'lima',destinationReferenceId:'lima',
    pickupWindow:{startsAt:'2026-10-18T12:15:00Z',endsAt:'2026-10-18T12:45:00Z'}},'ineligible',0);
  const unauth=await c04.request(query,false);assert.equal(unauth.status,401);results.push({name:'Missing HTTP identity',httpStatus:401,providerCalls:0});
  let denied=false;try{await c04.repository.read(c04.actor,'carriers',{carrierId:c09.carrier.id,serviceId:null},{limit:1,offset:0},c09.carrier.id);}
  catch(error){denied=/FORBIDDEN|PT403/.test(String((error as {stderr?:string}).stderr??''));}
  assert.equal(denied,true,'Native catalog must deny foreign Carrier');results.push({name:'Native foreign Carrier scope denied',denied:true,providerCalls:0});
  }
  report.completed=true;
}catch{
  report.error='NATIVE_ROAD_VALIDATION_FAILED; no credentials/provider bodies recorded';process.exitCode=1;
}finally{
  assert.equal(sql(countQuery),before,'Read-only validation must not alter dataset counts');
  Object.assign(report,{results,providerCalls,catalogReads,upstreamDiagnostics,readOnlyCountsPreserved:true});
  writeFileSync(resolve(output,'NATIVE_RESULTS.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({completed:report.completed,providerCalls,catalogReads,readOnlyCountsPreserved:true}));
}}
void main();
