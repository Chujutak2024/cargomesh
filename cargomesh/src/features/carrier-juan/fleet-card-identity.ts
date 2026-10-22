import {vehicleDisplayName} from '@/shared/lib/display-identity';
import type {FleetVehicle} from './fleet-model';

/** Presentation only: retain the recorded code/model for the full vehicle record. */
export function fleetCardIdentity(vehicle:Pick<FleetVehicle,'source'|'code'|'plate'|'model'|'body'>&{id?:string}){
 const recordedTitle=vehicle.source==='SERVICE'&&vehicle.plate?.trim()?vehicle.plate.trim():vehicle.code;
 const title=vehicle.source==='SERVICE'?vehicleDisplayName(vehicle.id??vehicle.code,vehicle.code,vehicle.plate):recordedTitle;
 // Scenario labels are provenance, not a vehicle make or model.
 const model=vehicle.source==='SERVICE'&&/^\s*(?:\[?(?:synthetic|simulated)\]?|HAC\d+[_-])/i.test(vehicle.model??'')?'':vehicle.model||'';
 return {title,model,unit:vehicle.source==='SERVICE'?'':vehicle.code.length<=24&&vehicle.code!==title?vehicle.code:''};
}
