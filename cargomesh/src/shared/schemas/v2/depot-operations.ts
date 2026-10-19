import {z} from 'zod';
const Opening=z.object({dayOfWeek:z.number().int().min(1).max(7),opensAt:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),closesAt:z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/)}).strict().refine(v=>v.opensAt<v.closesAt,'Split overnight hours at 24:00 and 00:00 on the following day.');
export const DepotHoursV2Schema=z.object({timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Valid IANA timezone required.'),weekly:z.array(Opening).max(28)}).strict().superRefine((v,ctx)=>{const sorted=[...v.weekly].sort((a,b)=>a.dayOfWeek-b.dayOfWeek||a.opensAt.localeCompare(b.opensAt));for(let i=1;i<sorted.length;i++)if(sorted[i].dayOfWeek===sorted[i-1].dayOfWeek&&sorted[i].opensAt<sorted[i-1].closesAt)ctx.addIssue({code:'custom',message:'Operating intervals overlap.'});});
import {TimeWindowV2Schema,EquipmentCodeV2Schema} from './freight-request';
const Id=z.string().uuid(),Text=z.string().trim().min(1).max(500),Instant=z.string().datetime({offset:true});
export const DepotActivityV2Schema=z.enum(['LOAD','UNLOAD','PARK','MAINTENANCE']);
const Evidence=z.object({reference:Text,verifiedAt:Instant,validUntil:Instant,provenanceStatus:z.enum(['VERIFIED','ESTIMATED','SIMULATED','UNKNOWN'])}).strict().refine(v=>Date.parse(v.validUntil)>Date.parse(v.verifiedAt),'Invalid evidence window.');
const Code=z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/);
const unique=<T>(v:T[])=>new Set(v).size===v.length;
export const DepotPolicyV2Schema=z.object({schemaVersion:z.literal('2.0'),active:z.boolean(),
  serviceIds:z.array(Id).min(1).max(100).refine(unique,'Duplicate service.'),
  operatingHours:DepotHoursV2Schema.nullable(),
  resources:z.array(z.object({code:Code,name:Text,activities:z.array(DepotActivityV2Schema).min(1).max(4).refine(unique),
    equipmentTypes:z.array(EquipmentCodeV2Schema).min(1).max(100).refine(unique).nullable(),maxConcurrentVehicles:z.number().int().positive().max(10000).nullable()}).strict()).min(1).max(20),
  blockedWindows:z.array(z.object({resourceCode:Code.nullable(),window:TimeWindowV2Schema,reason:Text}).strict()).max(100),evidence:Evidence.nullable(),
}).strict().superRefine((v,ctx)=>{
  if(!unique(v.resources.map(r=>r.code)))ctx.addIssue({code:'custom',message:'Duplicate resource code.'});
  if(v.blockedWindows.some(b=>b.resourceCode!==null&&!v.resources.some(r=>r.code===b.resourceCode)))ctx.addIssue({code:'custom',message:'Blocked resource is not recorded.'});
});
export const DepotSlotV2Schema=z.object({schemaVersion:z.literal('2.0'),serviceId:Id,resourceCode:Code,
  activity:DepotActivityV2Schema,equipmentType:EquipmentCodeV2Schema,window:TimeWindowV2Schema,
  units:z.number().int().positive().max(10000)}).strict().refine(v=>Date.parse(v.window.endsAt)-Date.parse(v.window.startsAt)<=14*86400000,'Depot slot cannot exceed 14 days.');
export const DepotAppointmentV2Schema=DepotSlotV2Schema.innerType().extend({executionId:Id.nullable(),
  status:z.enum(['PROPOSED','CONFIRMED','CANCELLED','COMPLETED']),reason:Text}).strict().refine(v=>Date.parse(v.window.endsAt)-Date.parse(v.window.startsAt)<=14*86400000,'Depot slot cannot exceed 14 days.');
export type DepotPolicyV2=z.infer<typeof DepotPolicyV2Schema>;
export type DepotAppointmentV2=z.infer<typeof DepotAppointmentV2Schema>;
export const DepotDecisionV2Schema=z.object({status:z.enum(['eligible','ineligible','unknown']),reasons:z.array(z.string()),
  provenanceStatus:z.enum(['VERIFIED','ESTIMATED','SIMULATED','UNKNOWN']),policyVersion:z.number().int().positive().nullable()}).strict();
export const DepotRecordV2Schema=z.object({id:Id,carrierId:Id,depotId:Id,version:z.number().int().positive(),updatedAt:Instant,value:z.unknown()}).strict();
export function parseDepotRecord(kind:'policy'|'appointment',raw:unknown){const record=DepotRecordV2Schema.parse(raw);return {...record,value:(kind==='policy'?DepotPolicyV2Schema:DepotAppointmentV2Schema).parse(record.value)};}
