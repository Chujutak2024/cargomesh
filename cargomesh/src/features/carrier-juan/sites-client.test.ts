import test from 'node:test';
import assert from 'node:assert/strict';
import {readSitesCatalog,readServiceCoverage} from './sites-client';
import {readDepotOperations} from '@/features/carrier-portal/depot-operations-client';
import {areaLabel,canEditSites,keepSiteSelection,laneChoices,siteEditorPath,siteEditorSchema,validateSiteSaved} from './sites-model';
import {portalRequest,mutationReceipt} from '@/features/carrier-portal/api';
import {fleetContext} from './connected-fleet-state';
const carrier='10000000-0000-4000-8000-000000000001',service='20000000-0000-4000-8000-000000000002',depot='30000000-0000-4000-8000-000000000003',other='40000000-0000-4000-8000-000000000004';
const at='2026-10-17T10:00:00Z';
const depotValue={schemaVersion:'2.0',code:'TEST_DEPOT',name:'Recorded depot',location:{label:'Recorded location',countryCode:'PE',region:null,city:'Lima',lat:null,lng:null},active:true,handling:[]};
const areaValue={schemaVersion:'2.0',role:'PICKUP',inclusion:'INCLUDE',geography:{granularity:'CITY',countryCode:'PE',region:null,city:'Lima',postalCode:null},source:'OWN',partnerId:null,evidence:null,verifiedAt:null,validFrom:null,validUntil:null,active:true};
const row=(value:unknown,id=depot,serviceId:string|null=null)=>({id,carrierId:carrier,serviceId,organizationId:null,version:2,createdAt:at,updatedAt:at,value});
const response=(data:unknown,meta:object={nextOffset:null})=>Response.json({schemaVersion:'2.0',data,meta});
const failure=(status:number,code='TEST_ERROR')=>Response.json({error:{code}},{status});
const signal=()=>new AbortController().signal;

test('empty catalogs remain empty, never loaded from local examples',async()=>{
 const result=await readSitesCatalog(carrier,signal(),async()=>response([]));
 assert.deepEqual(result.depots,[]);assert.equal(result.partial,false);assert.deepEqual(result.services,[]);
});
test('physical depots remain readable when a dependent catalog fails; writes are blocked',async()=>{
 const result=await readSitesCatalog(carrier,signal(),async path=>String(path).includes('/depots')?response([row(depotValue)]):failure(500));
 assert.equal(result.depots[0].id,depot);assert.equal(result.issues.length,2);assert.equal(canEditSites('ADMIN',true,result.partial),false);
});
test('authorization failures invalidate all catalogs and cannot become partial success',async()=>{
 await assert.rejects(readSitesCatalog(carrier,signal(),async path=>String(path).includes('depots')?response([row(depotValue)]):failure(403,'REVOKED')),/REVOKED/);
});
test('catalog readers reject data belonging to another carrier',async()=>{
 const result=await readSitesCatalog(carrier,signal(),async()=>response([{...row(depotValue),carrierId:other}]));
 assert.equal(result.depots.length,0);assert.equal(result.partial,true);
});
test('coverage uses the selected service URL and rejects foreign service records',async()=>{
 const result=await readServiceCoverage(carrier,service,signal(),async path=>{assert.ok(String(path).includes('/services/'+service+'/'));return String(path).includes('/areas')?response([row(areaValue,depot,other)]):response([]);});
 assert.equal(result.areas.length,0);assert.equal(result.partial,true);
});
test('explicit partial metadata and bounded pagination both prevent edits',async()=>{
 const result=await readSitesCatalog(carrier,signal(),async()=>response([],{partial:true,nextOffset:null}));assert.equal(result.partial,true);
 let calls=0;const bounded=await readServiceCoverage(carrier,service,signal(),async path=>{calls++;const u=new URL(String(path),'http://localhost');return response([],{nextOffset:Number(u.searchParams.get('offset'))+100});});
 assert.equal(bounded.partial,true);assert.equal(calls,20);
});
test('aborted late reads are discarded even if the transport returns a response',async()=>{
 const controller=new AbortController();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const pending=readSitesCatalog(carrier,controller.signal,async()=>{await gate;return response([row(depotValue)]);});controller.abort();release();
 await assert.rejects(pending,error=>(error as Error).name==='AbortError');
});
test('selection survives refresh and safely falls back after a selected depot is removed',()=>{
 assert.equal(keepSiteSelection(depot,[row(depotValue)]),depot);assert.equal(keepSiteSelection(other,[row(depotValue)]),depot);assert.equal(keepSiteSelection(depot,[]),'');
});
test('ADMIN is required, including complete reads and a loaded context',()=>{
 for(const role of ['OPERATOR','DISPATCHER',''])assert.equal(canEditSites(role,true,false),false);
 assert.equal(canEditSites('ADMIN',true,false),true);assert.equal(canEditSites('ADMIN',false,false),false);assert.equal(canEditSites('ADMIN',true,true),false);
});
test('lane endpoints use authorized pickup/delivery inclusions; exclusions are never chosen as coverage',()=>{
 const included=row(areaValue),excluded=row({...areaValue,inclusion:'EXCLUDE'},other,service);
 assert.deepEqual(laneChoices([included,excluded],'PICKUP').map(r=>r.id),[depot]);assert.deepEqual(laneChoices([included],'DELIVERY'),[]);
 assert.match(areaLabel(included),/Lima/);
});
test('canonical editors hide fixed identifiers and reject inconsistent geography and references',()=>{
 const schema=siteEditorSchema('areas',{source:'OWN',partnerId:null});
 const {schemaVersion:_version,source:_source,partnerId:_partner,...editable}=areaValue;
 assert.deepEqual(schema.parse(editable),areaValue);
 assert.equal(schema.safeParse({...editable,partnerId:other}).success,false);
 assert.equal(schema.safeParse({...editable,geography:{...editable.geography,granularity:'COUNTRY'}}).success,false);
 assert.equal(siteEditorSchema('areas',{source:'PARTNER',partnerId:''}).safeParse(editable).success,false);
 assert.equal(siteEditorSchema('depots',{}).safeParse({...depotValue,location:{...depotValue.location,lat:5}}).success,false);
});
test('revision paths and receipts preserve scope and expected version; stale conflicts cannot look successful',async()=>{
 const record=row(depotValue),path=siteEditorPath(carrier,service,'depots',record),body={expectedVersion:record.version,value:depotValue};
 assert.ok(path.endsWith('/depots/'+depot+'/revisions'));
 assert.throws(()=>siteEditorPath(carrier,service,'areas',row(areaValue,depot,other)),/INVALID_CONTEXT/);
 const first=mutationReceipt(null,path,body,()=>other);assert.equal(mutationReceipt(first,path,body,()=>depot).key,other);
 assert.equal(mutationReceipt(first,path,{...body,expectedVersion:3},()=>depot).key,depot);
 await assert.rejects(portalRequest(path,{method:'POST',body:JSON.stringify(body)},async()=>failure(409,'STALE_DRAFT')),/STALE_DRAFT/);
 assert.throws(()=>validateSiteSaved('depots',carrier,service,record,{...record,carrierId:other}),/INVALID_RESPONSE/);
});
test('controlled save then refresh selects the saved revision without changing the selected depot',async()=>{
 let current=row(depotValue);const path=siteEditorPath(carrier,service,'depots',current);
 const fetcher:typeof fetch=async(input,init)=>{if(init?.method==='POST'){const body=JSON.parse(String(init.body));assert.equal(body.expectedVersion,2);assert.equal(new Headers(init.headers).get('Idempotency-Key'),other);current={...current,version:3,value:{...depotValue,name:'Revised depot'}};return response(current);}return String(input).includes('/depots')?response([current]):response([]);};
 const saved=await portalRequest(path,{method:'POST',headers:{'Idempotency-Key':other},body:JSON.stringify({expectedVersion:2,value:{...depotValue,name:'Revised depot'}})},fetcher);
 validateSiteSaved('depots',carrier,service,current,saved.data);const refreshed=await readSitesCatalog(carrier,signal(),fetcher);
 assert.equal(keepSiteSelection(depot,refreshed.depots),depot);assert.equal(refreshed.depots[0].version,3);
});
const policy={id:depot,carrierId:carrier,depotId:depot,version:2,updatedAt:at,value:{schemaVersion:'2.0',active:true,serviceIds:[service],operatingHours:null,resources:[{code:'BAY',name:'Recorded bay',activities:['LOAD'],equipmentTypes:null,maxConcurrentVehicles:null}],blockedWindows:[],evidence:null}};
test('missing depot operation installation leaves unknown policy and explicit pending controls',async()=>{
 const result=await readDepotOperations(carrier,depot,signal(),async path=>String(path).includes('executions')?response([]):failure(503,'DEPOT_OPERATIONS_NOT_INSTALLED'));
 assert.equal(result.policy,null);assert.equal(result.partial,true);assert.match(result.issues.join(' '),/not installed/);
});
test('partial appointments preserve a valid policy but disable mutation',async()=>{
 const result=await readDepotOperations(carrier,depot,signal(),async path=>String(path).endsWith('/operations')?response(policy):response([],{partial:true}));
 assert.equal(result.policy?.id,depot);assert.equal(result.partial,true);
});
test('depot operations reject mixed carrier/depot scope and revoked execution access',async()=>{
 await assert.rejects(readDepotOperations(carrier,depot,signal(),async path=>String(path).endsWith('/operations')?response({...policy,depotId:other}):response([])),/INVALID_RESPONSE/);
 await assert.rejects(readDepotOperations(carrier,depot,signal(),async path=>String(path).includes('executions')?failure(401,'UNAUTHORIZED'):String(path).endsWith('/operations')?response(policy):response([])),/UNAUTHORIZED/);
});
test('Sites can share a non-road service while Fleet keeps its road-only projection',()=>{
 const access=[{carrierId:carrier,operatorId:depot,role:'ADMIN' as const,carrierName:'Test',displayName:'Test'}];
 const snapshot={carrierId:carrier,assets:[],services:[row({mode:'SEA',status:'ACTIVE'},service)],depots:[],drivers:[],partners:[],operational:{'vehicle-assignments':[],'driver-assignments':[],executions:[],maintenances:[]},visualGaps:[],partial:false,readAt:at};
 assert.equal(fleetContext(access,carrier,service,snapshot,true).service?.id,service);assert.equal(fleetContext(access,carrier,service,snapshot).service,null);
 assert.equal(fleetContext(access,other,service,snapshot,true).current,null);
});
