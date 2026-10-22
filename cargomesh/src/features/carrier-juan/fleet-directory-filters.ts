import type {FleetVehicle} from './fleet-model';

export type FleetCapacityFilter = 'all' | 'up-to-5' | '5-to-10' | '10-to-20' | 'over-20' | 'unknown';

export const capacityFilters: {id:FleetCapacityFilter;es:string;en:string}[] = [
  {id:'all',es:'Todo el tonelaje',en:'All capacities'},
  {id:'up-to-5',es:'Hasta 5 t',en:'Up to 5 t'},
  {id:'5-to-10',es:'Más de 5 a 10 t',en:'Over 5 to 10 t'},
  {id:'10-to-20',es:'Más de 10 a 20 t',en:'Over 10 to 20 t'},
  {id:'over-20',es:'Más de 20 t',en:'Over 20 t'},
  {id:'unknown',es:'Capacidad sin registrar',en:'Capacity not recorded'},
];

const typeNames:Record<string,[string,string]> = {
  rigid:['Furgón rígido','Rigid box truck'],articulated:['Furgón articulado','Articulated box truck'],
  refrigerated:['Refrigerado','Refrigerated'],curtainsider:['Lona lateral','Curtainsider'],
  flatbed:['Plataforma','Flatbed'],lowloader:['Cama baja','Low loader'],tanker:['Cisterna','Tanker'],
  mixer:['Mezclador','Mixer'],logging:['Maderero','Logging truck'],tipper:['Volquete','Tipper'],
  'car-carrier':['Portavehículos','Car carrier'],livestock:['Ganadero','Livestock truck'],
  crane:['Grúa','Crane truck'],refuse:['Recolector','Refuse truck'],'bulk-silo':['Silo','Bulk silo'],
  unknown:['Tipo sin registrar','Type not recorded'],
};

export function fleetTruckType(vehicle:FleetVehicle):string {
  if(vehicle.visual)return vehicle.visual.body==='box'?vehicle.visual.family:vehicle.visual.body;
  return vehicle.source==='EXAMPLE'?vehicle.variant:'unknown';
}

export function fleetTruckTypeLabel(type:string):[string,string] {
  return typeNames[type]??typeNames.unknown;
}

export function matchesDirectoryFilters(vehicle:FleetVehicle,capacity:FleetCapacityFilter,type:string):boolean {
  if(type!=='all'&&fleetTruckType(vehicle)!==type)return false;
  const kg=vehicle.capacityKg,known=Number.isFinite(kg)&&kg>0;
  switch(capacity){
    case 'all':return true;
    case 'unknown':return !known;
    case 'up-to-5':return known&&kg<=5000;
    case '5-to-10':return known&&kg>5000&&kg<=10000;
    case '10-to-20':return known&&kg>10000&&kg<=20000;
    case 'over-20':return known&&kg>20000;
  }
}
