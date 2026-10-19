import { z } from "zod";
import { findRoadLocation } from "@/features/v2-workspace/road-locations";
import { truckVisualTypes } from "@/features/logistics-3d/truck-model";
import type { LocalDraft } from "./local-draft-model";
import type { FleetVehicle } from "./fleet-model";
import {truckTypes} from "./local-truck-preference";

export const OPERATIONS_KEY="cargomesh-coordinator-operations-v1";
const text=z.string().trim().min(2).max(160);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const SiteSchema=z.object({id:text,name:text,city:text,address:text,kind:z.enum(["BASE","WAREHOUSE","PARTNER"]),reach:z.array(text).min(1).max(30),hours:text}).strict();
export const CarrierSchema=z.object({id:text,name:text,color:z.string().regex(/^#[0-9a-f]{6}$/i),country:text,description:text,sites:z.array(SiteSchema).min(1).max(40),lanes:z.array(z.object({origin:text,destination:text}).strict()).max(120)}).strict();
export type Carrier=z.infer<typeof CarrierSchema>;
export type CarrierSite=z.infer<typeof SiteSchema>;
export const RegisteredTruckSchema=z.object({id:text,code:text,carrierId:text,siteId:text,brand:text,model:text,year:z.number().int().min(1980).max(2100),plate:z.string().trim().min(5).max(14).regex(/^[A-Za-z0-9 -]+$/),variant:z.enum(truckVisualTypes),capacityKg:z.number().finite().positive().max(100000),volumeM3:z.number().finite().positive().max(200),description:text,registeredAt:date,createdAt:z.string().datetime(),status:z.enum(["AVAILABLE","MAINTENANCE","OUT_OF_SERVICE"]),statusReason:text,odometerKm:z.number().finite().min(0).max(3000000),fuelPercent:z.number().min(0).max(100),tankLiters:z.number().positive().max(2000),consumption:z.number().positive().max(100),insuranceUntil:date,inspectionUntil:date,photo:z.string().max(400000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable()}).strict();
export type RegisteredTruck=z.infer<typeof RegisteredTruckSchema>;
const IncidentSchema=z.object({id:text,kind:z.enum(["BREAKDOWN","DELAY","ROAD","CARGO","OTHER"]),severity:z.enum(["LOW","MEDIUM","HIGH"]),description:text,location:z.string().max(160),createdAt:z.string().datetime(),resolvedAt:z.string().datetime().nullable()}).strict();
export type Incident=z.infer<typeof IncidentSchema>;
const EventSchema=z.object({id:text,kind:z.enum(["INCIDENT","REPLACEMENT","CANCELLED","RESOLVED"]),message:text,at:z.string().datetime()}).strict();
export const RequestOperationSchema=z.object({status:z.enum(["ACTIVE","CANCELLED"]),carrierId:z.string().nullable(),vehicleId:z.string().nullable(),incidents:z.array(IncidentSchema).max(100),events:z.array(EventSchema).max(200),cancelReason:z.string().nullable()}).strict();
export type RequestOperation=z.infer<typeof RequestOperationSchema>;
export const OperationsSchema=z.object({version:z.literal(1),revision:z.number().int().nonnegative(),carriers:z.array(CarrierSchema).max(50),vehicles:z.array(RegisteredTruckSchema).max(100),requests:z.record(RequestOperationSchema)}).strict();
export type OperationsState=z.infer<typeof OperationsSchema>;
const site=(id:string,name:string,city:string,reach:string[],kind:CarrierSite["kind"]="BASE"):CarrierSite=>({id,name,city,reach,kind,address:`Zona logística de ${city}`,hours:"Lun–sáb · 06:00–20:00"});
export function createOperations():OperationsState {return {version:1,revision:0,vehicles:[],requests:{},carriers:[
  {id:"tomate",name:"Tomate Transportes",country:"Perú",color:"#ca5149",description:"Distribución y carga general en la costa norte.",sites:[site("tomate-callao","Base Callao","Callao",["Lima","Callao"]),site("tomate-trujillo","Centro Trujillo","Trujillo",["Trujillo","Chiclayo"]),site("tomate-piura","Base Piura","Piura",["Piura","Sullana"])],lanes:[{origin:"Callao",destination:"Piura"},{origin:"Callao",destination:"Trujillo"},{origin:"Lima",destination:"Piura"},{origin:"Trujillo",destination:"Piura"},{origin:"Piura",destination:"Lima"},{origin:"Callao",destination:"Lima"}]},
  {id:"sur-andino",name:"Sur Andino",country:"Perú",color:"#098984",description:"Carga industrial y cadena de frío en el corredor sur.",sites:[site("sur-lima","Centro Lima","Lima",["Lima","Callao"]),site("sur-arequipa","Base Arequipa","Arequipa",["Arequipa","Ica"]),site("sur-cusco","Base Cusco","Cusco",["Cusco","Juliaca"])],lanes:[{origin:"Lima",destination:"Arequipa"},{origin:"Callao",destination:"Arequipa"},{origin:"Arequipa",destination:"Lima"},{origin:"Lima",destination:"Ica"},{origin:"Cusco",destination:"Arequipa"}]},
  {id:"continental",name:"Continental Cargo",country:"Chile / Argentina",color:"#8061be",description:"Transporte entre centros logísticos del Cono Sur.",sites:[site("continental-santiago","Base Santiago","Santiago",["Santiago","Valparaíso"]),site("continental-ba","Centro Buenos Aires","Buenos Aires",["Buenos Aires","La Plata"],"PARTNER")],lanes:[{origin:"Santiago",destination:"Buenos Aires"},{origin:"Buenos Aires",destination:"Santiago"}]},
  {id:"iberia",name:"Iberia Logística",country:"España",color:"#b58a2d",description:"Distribución entre Madrid y Barcelona.",sites:[site("iberia-madrid","Centro Madrid","Madrid",["Madrid"]),site("iberia-barcelona","Base Barcelona","Barcelona",["Barcelona"],"WAREHOUSE")],lanes:[{origin:"Madrid",destination:"Barcelona"},{origin:"Barcelona",destination:"Madrid"}]}
]};}
export const emptyRequestOperation=():RequestOperation=>({status:"ACTIVE",carrierId:null,vehicleId:null,incidents:[],events:[],cancelReason:null});
export function requestOperation(state:OperationsState,id:string){return state.requests[id]??emptyRequestOperation();}
export function decodeOperations(raw:string|null):OperationsState|null {if(!raw)return null;try {const value=OperationsSchema.parse(JSON.parse(raw));
  const carriers=new Set(value.carriers.map(c=>c.id)),vehicles=new Set(value.vehicles.map(v=>v.id));
  if(carriers.size!==value.carriers.length||vehicles.size!==value.vehicles.length||new Set(value.vehicles.map(v=>v.plate.toUpperCase().replace(/[ -]/g,""))).size!==value.vehicles.length)return null;
  if(value.vehicles.some(v=>!value.carriers.some(c=>c.id===v.carrierId&&c.sites.some(s=>s.id===v.siteId))))return null;
  return value;
}catch{return null;}}
export function carrierCovers(carrier:Carrier,originId:string,destinationId:string){
  const origin=findRoadLocation(originId)?.city,destination=findRoadLocation(destinationId)?.city;
  return !!origin&&!!destination&&carrier.lanes.some(l=>l.origin===origin&&l.destination===destination);
}
export function vehicleCarrierId(vehicle:FleetVehicle){if(vehicle.carrierId)return vehicle.carrierId;
  return ["CM-231","CM-245","CM-304","CM-289"].includes(vehicle.code)?"sur-andino":"tomate";
}
export function registeredFleet(records:RegisteredTruck[],carriers:Carrier[]):FleetVehicle[]{return records.map(v=>{
  const carrier=carriers.find(c=>c.id===v.carrierId),base=carrier?.sites.find(s=>s.id===v.siteId);
  return {id:v.id,code:v.code,source:"EXAMPLE",status:v.status,variant:v.variant,model:`${v.brand} ${v.model}`,plate:v.plate,body:truckTypes.find(type=>type.id===v.variant)!.es,odometerKm:v.odometerKm,capacityKg:v.capacityKg,updatedAt:v.createdAt,driver:null,depot:base?.name??null,location:base?.city??null,coordinates:null,speedKmh:0,fuelPercent:v.fuelPercent,conditionScore:null,utilizationPercent:null,costPerKm:null,maintenance:null,engineDays:[],createdAt:v.createdAt,registeredAt:v.registeredAt,description:v.description,statusReason:v.statusReason,statusChangedAt:v.createdAt,tankLiters:v.tankLiters,consumptionLitersPer100Km:v.consumption,workingZones:base?[{id:base.id,name:base.name,cities:base.reach,countryCode:carrier?.country==="España"?"ES":carrier?.country==="Perú"?"PE":"CL"}]:[],journey:null,maintenanceHistory:[],carrierId:v.carrierId,siteId:v.siteId,modelYear:v.year,photoDataUrl:v.photo,volumeM3:v.volumeM3,insuranceUntil:v.insuranceUntil,inspectionUntil:v.inspectionUntil};
});}
export function replacementCandidates(state:OperationsState,requestId:string,draft:LocalDraft,vehicles:FleetVehicle[],today=new Date().toISOString().slice(0,10)){const op=requestOperation(state,requestId),weight=draft.quantity*draft.unitWeightKg;
  const cold=draft.truckPreference?.type==="refrigerated"||/refriger|cadena de frío|congelad/i.test(draft.cargoDescription);
  return vehicles.filter(v=>v.status==="AVAILABLE"&&v.id!==op.vehicleId&&v.capacityKg>=weight&&(!cold||v.variant==="refrigerated")
    &&(!v.insuranceUntil||v.insuranceUntil>=today)&&(!v.inspectionUntil||v.inspectionUntil>=today)
    &&state.carriers.some(c=>c.id===vehicleCarrierId(v)&&carrierCovers(c,draft.originId,draft.destinationId))
    &&!Object.entries(state.requests).some(([id,r])=>id!==requestId&&r.status==="ACTIVE"&&r.vehicleId===v.id));
}
function updateRequest(state:OperationsState,id:string,op:RequestOperation){return {...state,revision:state.revision+1,requests:{...state.requests,[id]:op}};}
export function reportIncident(state:OperationsState,id:string,input:Omit<Incident,"createdAt"|"resolvedAt">,at:string){const op=requestOperation(state,id);if(op.status==="CANCELLED")throw new Error("La solicitud está cancelada.");const value=IncidentSchema.parse({...input,createdAt:at,resolvedAt:null});return updateRequest(state,id,{...op,incidents:[...op.incidents,value],events:[...op.events,{id:value.id,kind:"INCIDENT",message:value.description,at}]});}
export function replaceTruck(state:OperationsState,id:string,draft:LocalDraft,vehicles:FleetVehicle[],vehicleId:string,reason:string,at:string){const op=requestOperation(state,id);if(op.status==="CANCELLED")throw new Error("La solicitud está cancelada.");const vehicle=replacementCandidates(state,id,draft,vehicles,at.slice(0,10)).find(v=>v.id===vehicleId);if(!vehicle)throw new Error("El camión ya no cumple capacidad, cobertura o disponibilidad.");text.parse(reason);return updateRequest(state,id,{...op,vehicleId,carrierId:vehicleCarrierId(vehicle),incidents:op.incidents.map(i=>({...i,resolvedAt:i.resolvedAt??at})),events:[...op.events,{id:`replacement-${at}`,kind:"REPLACEMENT",message:`Reemplazo programado: ${vehicle.code}. ${reason}`.slice(0,160),at}]});}
export function cancelRequest(state:OperationsState,id:string,reason:string,at:string){const op=requestOperation(state,id);if(op.status==="CANCELLED")throw new Error("La solicitud ya está cancelada.");text.parse(reason);return updateRequest(state,id,{...op,status:"CANCELLED",cancelReason:reason,events:[...op.events,{id:`cancel-${at}`,kind:"CANCELLED",message:`Solicitud cancelada. ${reason}`.slice(0,160),at}]});}
export function resolveIncident(state:OperationsState,id:string,incidentId:string,at:string){const op=requestOperation(state,id);if(op.status==="CANCELLED")throw new Error("La solicitud está cancelada.");if(!op.incidents.some(i=>i.id===incidentId&&!i.resolvedAt))throw new Error("La incidencia ya no está abierta.");return updateRequest(state,id,{...op,incidents:op.incidents.map(i=>i.id===incidentId?{...i,resolvedAt:at}:i),events:[...op.events,{id:`resolve-${at}`,kind:"RESOLVED",message:"Incidencia resuelta; se mantiene la unidad actual.",at}]});}
export function registerTruck(state:OperationsState,input:RegisteredTruck,existing:FleetVehicle[]){const value=RegisteredTruckSchema.parse(input);
  if(!state.carriers.some(c=>c.id===value.carrierId&&c.sites.some(s=>s.id===value.siteId)))throw new Error("Selecciona una sede del carrier.");
  if(existing.some(v=>v.code.toUpperCase()===value.code.toUpperCase()||v.plate?.replace(/[ -]/g,"").toUpperCase()===value.plate.replace(/[ -]/g,"").toUpperCase()))throw new Error("La placa o código ya están registrados.");
  return {...state,revision:state.revision+1,vehicles:[...state.vehicles,value]};
}
export function addCarrierSite(state:OperationsState,carrierId:string,input:CarrierSite,lanes:Carrier["lanes"]){const site=SiteSchema.parse(input),carrier=state.carriers.find(c=>c.id===carrierId);if(!carrier)throw new Error("Carrier no disponible.");if(carrier.sites.some(s=>s.name.toLowerCase()===site.name.toLowerCase()))throw new Error("Ya existe una sede con este nombre.");const valid=CarrierSchema.parse({...carrier,sites:[...carrier.sites,site],lanes:[...carrier.lanes,...lanes]});return {...state,revision:state.revision+1,carriers:state.carriers.map(c=>c.id===carrierId?valid:c)};}
