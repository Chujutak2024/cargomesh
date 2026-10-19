import type {FleetVehicle} from './fleet-model';

/** Presentation only: retain the recorded code/model for the full vehicle record. */
export function fleetCardIdentity(vehicle:Pick<FleetVehicle,'source'|'code'|'plate'|'model'|'body'>){
 const syntheticModel=vehicle.source==='SERVICE'?/^Synthetic (.+?) QA illustration$/i.exec(vehicle.model??''):null;
 const families:Record<string,string>={rigid:'Rigid truck',articulated:'Articulated truck',curtainsider:'Curtainside truck',refrigerated:'Refrigerated truck'};
 const model=syntheticModel?(families[syntheticModel[1].toLowerCase()]??syntheticModel[1]+' truck'):vehicle.model||vehicle.body;
 const scenarioCode=vehicle.source==='SERVICE'?/^HAC50_C\d{2}_T(\d{2})$/.exec(vehicle.code):null;
 return {title:vehicle.source==='SERVICE'&&vehicle.plate?.trim()?vehicle.plate:vehicle.code,
  model,unit:scenarioCode?'Unit '+scenarioCode[1]:vehicle.code};
}
