import test from 'node:test';
import assert from 'node:assert/strict';
import {connectedDriver,connectedVehiclePresentation,type ConnectedFleetSnapshot} from './connected-fleet-presentation';
const carrier='10000000-0000-4000-8000-000000000001',service='20000000-0000-4000-8000-000000000002',assetId='30000000-0000-4000-8000-000000000003',driverId='40000000-0000-4000-8000-000000000004',executionId='50000000-0000-4000-8000-000000000005';
const now=Date.parse('2026-10-17T12:00:00Z'),at='2026-10-17T10:00:00Z';
const row=(id:string,value:Record<string,unknown>)=>({id,carrierId:carrier,organizationId:null,serviceId:service,version:1,createdAt:at,updatedAt:at,value});
const asset=row(assetId,{schemaVersion:'2.0',serviceId:service,code:'REAL_001',mode:'ROAD',equipmentType:'BOX_TRUCK',role:'LOAD_BEARING',usefulCapacityKg:1000,usableVolumeM3:12,operatingStatus:'AVAILABLE',homeDepotId:null,provenance:'OWN',partnerId:null,evidence:'Controlled test',roadVehicle:{plate:'TEST-001',registrationCode:null,registeredAt:null,brand:'Brand',model:'Model',variant:null,bodyType:'Box',usableDimensions:null,grossWeightLimitKg:null,odometerKm:300,conditionReason:null,axleConfig:null}});
const driver=row(driverId,{serviceId:service,fullName:'Actual driver record',licenseClass:'C',licenseValidUntil:'2028-01-01',experienceYears:null,qualifications:['GENERAL'],dutyStatus:'AVAILABLE'});
function snapshot():ConnectedFleetSnapshot{return {carrierId:carrier,assets:[asset],drivers:[driver],services:[],depots:[],partners:[],operational:{'vehicle-assignments':[],'driver-assignments':[],executions:[],maintenances:[]},visualGaps:[],partial:false,readAt:at};}
test('original presentation receives real catalog identities, never regular demo drivers or telemetry',()=>{
 const s=snapshot(),[v]=connectedVehiclePresentation(s,service,now);assert.equal(v.id,assetId);assert.equal(v.source,'SERVICE');assert.equal(v.driverProfile,null);assert.equal(v.location,null);assert.equal(v.fuelPercent,null);assert.equal(v.speedKmh,null);assert.equal(v.conditionScore,null);assert.deepEqual(v.engineDays,[]);assert.equal(v.volumeM3,12);assert.deepEqual(connectedVehiclePresentation(s,assetId,now),[]);s.assets=[];assert.deepEqual(connectedVehiclePresentation(s,service,now),[]);
});
test('standalone driver profile preserves license and missing performance without a fake photo',()=>{
 const d=connectedDriver(driver);assert.equal(d.id,driverId);assert.equal(d.name,'Actual driver record');assert.equal(d.licenseExpiresAt,'2028-01-01');for(const key of ['photo','enabled','experienceYears','joinedAt','base','shift','completedTrips','punctualityPercent'] as const)assert.equal(d[key],null,key);
});
test('only confirmed current execution assignments connect a recorded driver to a truck',()=>{
 const s=snapshot(),window={startsAt:'2026-10-17T11:00:00Z',endsAt:'2026-10-17T15:00:00Z'};
 s.operational['vehicle-assignments']=[row('va',{assetId,serviceId:service,executionId,status:'CONFIRMED',window})];
 s.operational['driver-assignments']=[row('da',{driverId,serviceId:service,executionId,status:'CONFIRMED',role:'PRIMARY',window})];
 s.operational.executions=[{...row(executionId,{serviceId:service,lastKnownPosition:null}),status:'IN_PROGRESS'}];
 const [v]=connectedVehiclePresentation(s,service,now);assert.equal(v.driverId,driverId);assert.equal(v.driverProfile?.name,'Actual driver record');assert.equal(v.driverProfileRole,'assigned');assert.equal(v.driverProfile?.punctualityPercent,null);
 s.operational['driver-assignments'].push(row('da2',{driverId,serviceId:service,executionId,status:'CONFIRMED',role:'PRIMARY',window}));assert.equal(connectedVehiclePresentation(s,service,now)[0].driverProfile,null);
});
test('annual maintenance history distinguishes known empty records from missing history',()=>{
 const s=snapshot();assert.deepEqual(connectedVehiclePresentation(s,service,now)[0].maintenanceHistory,[]);s.visualGaps=['maintenances'];assert.equal(connectedVehiclePresentation(s,service,now)[0].maintenanceHistory,null);
 s.visualGaps=[];s.operational.maintenances=[row('m',{assetId,serviceId:service,status:'COMPLETED',kind:'PREVENTIVE',blockedWindow:{startsAt:'2026-09-01T10:00:00Z',endsAt:'2026-09-01T12:00:00Z'}}),row('foreign',{assetId:driverId,serviceId:service,status:'COMPLETED',kind:'OTHER',blockedWindow:{startsAt:at,endsAt:at}})];
 assert.equal(connectedVehiclePresentation(s,service,now)[0].maintenanceHistory?.length,1);
});

test('regular link is displayed without becoming a current trip assignment',()=>{
 const s=snapshot();s.regularDrivers=[{assetId,carrierId:carrier,serviceId:service,driverId,version:1,updatedAt:at}];
 const [v]=connectedVehiclePresentation(s,service,now);
 assert.equal(v.driverProfile?.id,driverId);assert.equal(v.driverProfileRole,'regular');
 assert.equal(v.regularDriverId,driverId);assert.equal(v.driverId,null);assert.equal(v.location,null);
 s.regularDrivers[0].serviceId=assetId;assert.equal(connectedVehiclePresentation(s,service,now)[0].driverProfile,null);
});
test('confirmed trip driver takes precedence while the regular driver stays separate',()=>{
 const s=snapshot(),regularId='40000000-0000-4000-8000-000000000006';
 s.drivers.push({...driver,id:regularId,value:{...driver.value,fullName:'Regular driver record'}});
 s.regularDrivers=[{assetId,carrierId:carrier,serviceId:service,driverId:regularId,version:1,updatedAt:at}];
 const window={startsAt:'2026-10-17T11:00:00Z',endsAt:'2026-10-17T15:00:00Z'};
 s.operational['vehicle-assignments']=[row('va',{assetId,serviceId:service,executionId,status:'CONFIRMED',window})];
 s.operational['driver-assignments']=[row('da',{driverId,serviceId:service,executionId,status:'CONFIRMED',role:'PRIMARY',window})];
 s.operational.executions=[{...row(executionId,{serviceId:service,lastKnownPosition:null}),status:'IN_PROGRESS'}];
 const [v]=connectedVehiclePresentation(s,service,now);
 assert.equal(v.driverProfile?.id,driverId);assert.equal(v.driverProfileRole,'assigned');assert.equal(v.regularDriverProfile?.id,regularId);assert.equal(v.driverId,driverId);
});
