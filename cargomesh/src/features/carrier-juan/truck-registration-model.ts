import {FleetInputsV2} from '@/shared/schemas/v2/fleet';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';

/** Only fields supported by the canonical asset contract are sent. Existing hidden fields survive revisions. */
export function registeredAsset(form:FormData,serviceId:string,record?:PortalRecord){
 const old=record?FleetInputsV2.assets.parse(recordData(record)):null;
 if(old&&(old.serviceId!==serviceId||old.mode!=='ROAD'))throw new Error('Vehicle context changed. Reload before editing.');
 const text=(key:string)=>String(form.get(key)??'').trim();
 const nullable=(key:string)=>text(key)||null;
 const number=(key:string)=>text(key)===''?null:Number(text(key));
 const role=text('role'),provenance=text('provenance');
 return FleetInputsV2.assets.parse({
  ...(old??{}),schemaVersion:'2.0',serviceId,code:text('code').toUpperCase(),mode:'ROAD',equipmentType:text('equipment').toUpperCase(),role,
  usefulCapacityKg:role==='AUXILIARY'?0:number('capacity'),usableVolumeM3:role==='AUXILIARY'?null:number('volume'),
  operatingStatus:text('status'),homeDepotId:nullable('site'),provenance,partnerId:provenance==='PARTNER'?nullable('partner'):null,evidence:nullable('evidence'),
  roadVehicle:{...(old?.roadVehicle??{registrationCode:null,variant:null,usableDimensions:null,grossWeightLimitKg:null,axleConfig:null}),
   plate:text('plate').toUpperCase(),brand:nullable('brand'),model:nullable('model'),bodyType:text('variant'),registeredAt:nullable('registeredAt'),odometerKm:number('odometer'),conditionReason:nullable('statusReason')}
 });
}
