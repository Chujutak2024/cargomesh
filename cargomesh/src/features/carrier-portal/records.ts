import {recordDisplayName} from '@/shared/lib/display-identity';
import { z } from "zod";
import { parseCatalogRecordV2, type CatalogKindV2 } from "@/shared/schemas/v2/catalog";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import { PortalApiError } from "./api";
import type { PortalResource } from "./resources";

export type PortalRecord = {id:string;version:number;status?:string;updatedAt:string;value?:unknown;data?:unknown;carrierId:string|null;serviceId?:string|null};
export function parseRecords(resource:PortalResource,data:unknown,carrierId:string):PortalRecord[] {
 if(!Array.isArray(data)) throw new PortalApiError(502,"INVALID_RESPONSE");
 try {return data.map(raw=>{
  const record=resource.family==="catalog"?parseCatalogRecordV2(resource.key as CatalogKindV2,raw):WorkflowRecordV2Schema.parse(raw);
  if(record.carrierId!==carrierId) throw new Error("Carrier mismatch");
  if(resource.family==="workflow" && "kind" in record && record.kind!==resource.key) throw new Error("Kind mismatch");
  return record;
 });}catch{throw new PortalApiError(502,"INVALID_RESPONSE");}
}
export function recordData(record:PortalRecord):Record<string,unknown>{
 const value=record.value??record.data;return value && typeof value==="object"?value as Record<string,unknown>:{};
}
export function recordName(record:PortalRecord){return recordDisplayName(record.id,recordData(record),'kind' in record&&typeof record.kind==='string'?record.kind:undefined);}
export function recordStatus(record:PortalRecord){return String(record.status??recordData(record).status??recordData(record).operatingStatus??"—");}
export function validCarrierId(value:string){return z.string().uuid().safeParse(value).success;}
export function carrierCommandPath(carrierId:string,resource:PortalResource,recordId:string,parentId:string,suffix:string){
 const base="/api/v2/carriers/"+encodeURIComponent(carrierId);
 if(resource.key==="incidents")return base+"/incidents/"+encodeURIComponent(recordId)+"/"+suffix;
 return base+"/"+resource.path.replace("{parent}",encodeURIComponent(parentId))+"/"+encodeURIComponent(recordId)+"/"+suffix;
}
