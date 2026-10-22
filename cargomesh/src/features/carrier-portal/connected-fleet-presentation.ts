import {driverDisplayName,vehicleDisplayName} from '@/shared/lib/display-identity';
import type {RegularDriverRecordV2} from '@/shared/schemas/v2/regular-driver';
import {associateAssetVisual} from "@/features/logistics-3d/asset-visual";
import type {FleetDriver} from './fleet-drivers';
import {serviceFleet,type FleetVehicle} from './fleet-model';
import type {readConnectedFleet} from './connected-fleet-client';
import {recordData,type PortalRecord} from './records';
export type ConnectedFleetSnapshot=Omit<Awaited<ReturnType<typeof readConnectedFleet>>,'regularDrivers'|'regularDriversUnavailable'>&{regularDrivers?:RegularDriverRecordV2[];regularDriversUnavailable?:boolean};
export function connectedDriver(record:PortalRecord,vehicle?:FleetVehicle):FleetDriver{
 const d=recordData(record);
 return {id:record.id,name:driverDisplayName(String(d.fullName),record.id),enabled:null,vehicleCode:vehicle?vehicleDisplayName(vehicle.id,vehicle.code,vehicle.plate):'',photo:null,
  licenseClass:String(d.licenseClass),licenseExpiresAt:String(d.licenseValidUntil),experienceYears:typeof d.experienceYears==='number'?d.experienceYears:null,
  joinedAt:null,base:null,shift:null,specialties:Array.isArray(d.qualifications)?d.qualifications.map(String):[],completedTrips:null,punctualityPercent:null};
}
export function connectedVehiclePresentation(snapshot:ConnectedFleetSnapshot,serviceId:string,now=Date.now()):FleetVehicle[]{
 const services=new Set(snapshot.services.filter(row=>recordData(row).mode==='ROAD'&&(!serviceId||row.id===serviceId)).map(row=>row.id));
 const vehicles=serviceFleet({assets:snapshot.assets.filter(r=>serviceId?recordData(r).serviceId===serviceId:services.has(String(recordData(r).serviceId))),drivers:snapshot.drivers,
  depots:snapshot.depots,vehicleAssignments:snapshot.operational['vehicle-assignments'],driverAssignments:snapshot.operational['driver-assignments'],
  executions:snapshot.operational.executions,maintenances:snapshot.operational.maintenances},now);
 return vehicles.map(vehicle=>{
  const row=snapshot.assets.find(r=>r.id===vehicle.id)!,asset=recordData(row),assetServiceId=String(asset.serviceId);
  const driver=vehicle.driverId?snapshot.drivers.find(r=>r.id===vehicle.driverId):null;
  const regular=snapshot.regularDrivers?.find(row=>row.assetId===vehicle.id&&row.carrierId===snapshot.carrierId&&row.serviceId===assetServiceId);
  const regularDriver=regular?.driverId?snapshot.drivers.find(row=>row.id===regular.driverId&&recordData(row).serviceId===assetServiceId):null;
  const displayedDriver=driver??regularDriver;
  const road=asset.roadVehicle as {bodyType:string;model:string|null;variant:string|null};
  const visual=associateAssetVisual({equipmentType:String(asset.equipmentType),bodyType:road.bodyType,modelName:road.model,designHint:road.variant,referenceKey:vehicle.id});
  return {...vehicle,serviceId:assetServiceId,visual,...(visual?{variant:visual.family}:{}),carrierId:snapshot.carrierId,siteId:typeof asset.homeDepotId==='string'?asset.homeDepotId:undefined,
   ...(typeof asset.usableVolumeM3==='number'?{volumeM3:asset.usableVolumeM3}:{}),driverProfile:displayedDriver?connectedDriver(displayedDriver,vehicle):null,driverProfileRole:driver?'assigned':regularDriver?'regular':null,regularDriverId:regularDriver?.id??null,regularDriverProfile:regularDriver?connectedDriver(regularDriver,vehicle):null,
   maintenanceHistory:snapshot.visualGaps.includes('maintenances')?null:snapshot.operational.maintenances.filter(r=>{
    const v=recordData(r);return v.assetId===vehicle.id&&v.serviceId===assetServiceId&&v.status==='COMPLETED';
   }).map(r=>{const v=recordData(r),window=v.blockedWindow as {startsAt:string;endsAt:string};return {id:r.id,kind:String(v.kind),status:String(v.status),...window};})};
 });
}
