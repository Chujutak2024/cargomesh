import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredAsset} from './truck-registration-model';
import {saveConnectedVehicle} from '@/features/carrier-portal/connected-fleet-client';
import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import {connectedVehiclePresentation,type ConnectedFleetSnapshot} from '@/features/carrier-portal/connected-fleet-presentation';
const carrierId='10000000-0000-4000-8000-000000000001',serviceId='20000000-0000-4000-8000-000000000002',id='30000000-0000-4000-8000-000000000003',key='40000000-0000-4000-8000-000000000004';
function form(){const data=new FormData();for(const [key,value] of Object.entries({code:'CM_401',plate:'ABC-123',brand:'Brand',model:'Model',variant:'logging',equipment:'TRACTOR_TRAILER',role:'LOAD_BEARING',capacity:'12000',volume:'60',status:'OUT_OF_SERVICE',site:'',provenance:'OWN',partner:'',evidence:'Controlled input',registeredAt:'2026-10-17',odometer:'0',statusReason:'Pending assignment'}))data.set(key,value);return data;}
const row=(value:ReturnType<typeof registeredAsset>)=>({id,carrierId,organizationId:null,serviceId,version:2,createdAt:'2026-10-17T00:00:00Z',updatedAt:'2026-10-17T00:00:00Z',value});
test('the original registration fields map to the canonical payload; unsupported UI values are not submitted',()=>{
 const input=form();for(const field of ['year','description','fuel','tank','consumption','insurance','inspection','photo'])input.set(field,'not a production field');
 const value=registeredAsset(input,serviceId);assert.equal(value.code,'CM_401');assert.equal(value.usefulCapacityKg,12000);assert.equal(value.roadVehicle?.odometerKm,0);assert.equal(value.equipmentType,'TRACTOR_TRAILER');assert.equal(value.homeDepotId,null);assert.equal(value.roadVehicle?.registeredAt,'2026-10-17');
 for(const field of ['year','description','fuel','tank','photo'])assert.ok(!(field in value));
});
test('revising a truck retains optional fields not edited in the original form',()=>{
 const initial=registeredAsset(form(),serviceId);initial.roadVehicle={...initial.roadVehicle!,registrationCode:'REGISTERED',axleConfig:'6x4',grossWeightLimitKg:26000,usableDimensions:{length:600,width:240,height:260},variant:'Existing variant'};
 const revised=registeredAsset(form(),serviceId,row(initial));assert.equal(revised.roadVehicle?.registrationCode,'REGISTERED');assert.equal(revised.roadVehicle?.axleConfig,'6x4');assert.equal(revised.roadVehicle?.grossWeightLimitKg,26000);assert.deepEqual(revised.roadVehicle?.usableDimensions,initial.roadVehicle.usableDimensions);assert.equal(revised.roadVehicle?.variant,'Existing variant');
 assert.throws(()=>registeredAsset(form(),carrierId,row(initial)),/context changed/);
});
test('auxiliary capacity, partner identity, invalid numeric input and dates follow backend constraints',()=>{
 const auxiliary=form();auxiliary.set('role','AUXILIARY');auxiliary.delete('capacity');auxiliary.delete('volume');const v=registeredAsset(auxiliary,serviceId);assert.equal(v.usefulCapacityKg,0);assert.equal(v.usableVolumeM3,null);
 const partner=form();partner.set('provenance','PARTNER');assert.throws(()=>registeredAsset(partner,serviceId));partner.set('partner',key);assert.equal(registeredAsset(partner,serviceId).partnerId,key);
 for(const [field,value] of [['capacity','0'],['volume','NaN'],['registeredAt','2026-02-30'],['equipment','LOGGING']]){const invalid=form();invalid.set(field,value);assert.throws(()=>registeredAsset(invalid,serviceId));}
});
test('registration payload round-trips through the existing save/read adapters into Juan card data',async()=>{
 const value=registeredAsset(form(),serviceId),record=row(value);let written=false;
 const fetcher:typeof fetch=async(url,init)=>{
  if(init?.method==='POST'){assert.equal(new Headers(init.headers).get('Idempotency-Key'),key);assert.deepEqual(JSON.parse(String(init.body)),value);written=true;return Response.json({schemaVersion:'2.0',data:record});}
  assert.ok(written);return Response.json({schemaVersion:'2.0',data:[record],meta:{nextOffset:null}});
 };
 const saved=await saveConnectedVehicle({carrierId,serviceId,value,key,signal:new AbortController().signal},fetcher);
 const records=await readFleetResource(carrierId,'assets',new AbortController().signal,fetcher);
 const snapshot:ConnectedFleetSnapshot={carrierId,assets:records.records,drivers:[],services:[],depots:[],partners:[],partial:false,visualGaps:[],operational:{'vehicle-assignments':[],'driver-assignments':[],executions:[],maintenances:[]},readAt:record.updatedAt};
 const [card]=connectedVehiclePresentation(snapshot,serviceId);assert.equal(card.id,saved.id);assert.equal(card.code,'CM_401');assert.equal(card.variant,'logging');assert.equal(card.source,'SERVICE');assert.equal(card.fuelPercent,null);assert.equal(card.driverProfile,null);
});
