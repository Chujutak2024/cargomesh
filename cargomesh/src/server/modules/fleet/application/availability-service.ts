import {z} from 'zod';
import {CatalogServiceV2,type CatalogActorV2} from '../../catalog/application/catalog-service';
import {WorkflowServiceV2} from '../../workflow/application/workflow-service';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import {evaluateFleetAvailability,fleetWindowsOverlap,type FleetAgenda,type FleetWindow} from '../domain/assignment-policy';
import {V2DraftError} from '../../freight-requests/application/draft-service';
const Id=z.string().uuid();
export const AvailabilityInput=z.object({serviceId:Id,kind:z.enum(['asset','driver']),resourceId:Id,window:TimeWindowV2Schema}).strict();
type Value=Record<string,unknown>;
type Row={id:string;version:number;status?:string;value?:unknown;data?:unknown};
const value=(r:Row):Value=>(r.value??r.data) as Value;
const window=(v:unknown):FleetWindow=>TimeWindowV2Schema.parse(v);
const activeAssignment=(r:Row)=>['PROPOSED','CONFIRMED'].includes(String(value(r).status));
export function licenseExclusiveInstant(date:string,timezone:string){
 const next=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
 const local=(at:number)=>{const p=formatter.formatToParts(at);return ['year','month','day'].map(k=>p.find(v=>v.type===k)!.value).join('-');};
 let low=Date.parse(next+'T00:00:00Z')-2*86400000,high=low+4*86400000;
 while(low<high){const mid=Math.floor((low+high)/2);if(local(mid)>=next)high=mid;else low=mid+1;}
 return new Date(low).toISOString();
}
export function evaluateResourceWindow(input:z.infer<typeof AvailabilityInput>,rows:Record<string,Row[]>,partial:boolean,at:string){
 const resources=rows[input.kind==='asset'?'assets':'drivers'];
 const resource=resources.find(r=>r.id===input.resourceId&&value(r).serviceId===input.serviceId);
 if(!resource)throw new V2DraftError('RESOURCE_NOT_FOUND','Resource not found in this service.',404);
 const v=value(resource),occupied:FleetWindow[]=[],blocked:string[]=[],unknown:string[]=[];
 let agenda:FleetAgenda|null=null,provenance='UNKNOWN';
 const assignmentRows=rows[input.kind==='asset'?'vehicle-assignments':'driver-assignments'];
 for(const r of assignmentRows.filter(activeAssignment))if(value(r)[input.kind==='asset'?'assetId':'driverId']===resource.id)occupied.push(window(value(r).window));
 if(input.kind==='asset'){
  for(const r of rows.maintenances)if(value(r).assetId===resource.id&&['SCHEDULED','IN_PROGRESS'].includes(String(value(r).status)))occupied.push(window(value(r).blockedWindow));
  if(v.operatingStatus!=='AVAILABLE')blocked.push('ASSET_UNAVAILABLE');
  const resourceCalendars=rows.calendars.filter(r=>value(r).assetId===resource.id),calendarIds=new Set(resourceCalendars.map(r=>r.id));
  for(const r of rows['repositioning-blocks'])if(calendarIds.has(String(value(r).calendarId))&&['PLANNED','IN_PROGRESS'].includes(String(value(r).status)))occupied.push(window(value(r).occupiedWindow));
  for(const r of rows.holds){const h=value(r);if(!calendarIds.has(String(h.calendarId))||!h.active)continue;if(r.status==='CONFIRMED'||r.status==='HELD'&&(!h.expiresAt||Date.parse(String(h.expiresAt))>Date.parse(at)))occupied.push(window(h.window));}
  const calendars=rows.calendars.filter(r=>value(r).assetId===resource.id&&Date.parse(window(value(r).horizon).startsAt)<=Date.parse(input.window.startsAt)&&Date.parse(window(value(r).horizon).endsAt)>=Date.parse(input.window.endsAt));
  if(calendars.length!==1)unknown.push(calendars.length?'MULTIPLE_RESOURCE_CALENDARS':'AGENDA_UNKNOWN');else{
   const c=value(calendars[0]);provenance=String(c.freshness);
   agenda={complete:c.complete===true,evidence:['VERIFIED','SIMULATED'].includes(provenance)&&c.lastVerifiedAt&&c.validUntil?{reference:String(c.source),verifiedAt:String(c.lastVerifiedAt),validUntil:String(c.validUntil)}:null,availableWindows:z.array(TimeWindowV2Schema).parse(c.availableWindows),occupiedWindows:occupied};
  }
 }else{
  const e=v.evidence as Value|null;provenance=String(e?.provenanceStatus??'UNKNOWN');
  const evidence=e&&['VERIFIED','SIMULATED'].includes(provenance)?{reference:String(e.reference),verifiedAt:String(e.verifiedAt),validUntil:String(e.validUntil)}:null;
  agenda={complete:false,evidence,availableWindows:z.array(TimeWindowV2Schema).parse(v.availableWindows),occupiedWindows:occupied};
  if(v.dutyStatus==='UNKNOWN')unknown.push('DRIVER_DUTY_STATUS_UNKNOWN');else if(!['AVAILABLE','ON_DUTY'].includes(String(v.dutyStatus)))blocked.push('DRIVER_DUTY_STATUS_BLOCKED');
  if(Date.parse(licenseExclusiveInstant(String(v.licenseValidUntil),String(v.licenseTimezone)))<Date.parse(input.window.endsAt))blocked.push('LICENSE_EXPIRED_FOR_WINDOW');
  if(!v.dutyWindow||v.maximumDutySeconds==null)unknown.push('DRIVER_DUTY_UNKNOWN');else{
   const duty=window(v.dutyWindow);
   if(Date.parse(duty.startsAt)>Date.parse(input.window.startsAt)||Date.parse(duty.endsAt)<Date.parse(input.window.endsAt))blocked.push('OUTSIDE_DUTY_WINDOW');
   const committedSeconds=occupied.filter(w=>fleetWindowsOverlap(w,duty)).reduce((sum,w)=>sum+(Date.parse(w.endsAt)-Date.parse(w.startsAt))/1000,0);
   if(committedSeconds+Number(v.usedDutySeconds)+(Date.parse(input.window.endsAt)-Date.parse(input.window.startsAt))/1000>Number(v.maximumDutySeconds))blocked.push('DRIVER_DUTY_LIMIT_EXCEEDED');
  }
 }
 if(occupied.some(w=>fleetWindowsOverlap(w,input.window)))blocked.push('RESOURCE_OCCUPIED');
 const decision=evaluateFleetAvailability(agenda,input.window,at);
 (decision.status==='ineligible'?blocked:unknown).push(...decision.reasons);
 if(partial)unknown.push('PARTIAL_RESOURCE_READ');
 return {status:blocked.length?'ineligible' as const:unknown.length?'unknown' as const:'eligible' as const,reasons:[...new Set([...blocked,...unknown])],scope:'RESOURCE_WINDOW_ONLY' as const,provenanceStatus:provenance,resourceId:resource.id,serviceId:input.serviceId,resourceVersion:resource.version,checkedAt:at,window:input.window};
}
export class CarrierAvailabilityService {
 constructor(private readonly catalog:CatalogServiceV2,private readonly workflow:WorkflowServiceV2){}
 async evaluate(actor:Extract<CatalogActorV2,{kind:'carrier'}>,raw:unknown){
  const input=AvailabilityInput.parse(raw);const batch=await this.evaluateMany(actor,[input]);return {schemaVersion:'2.0' as const,data:batch.data[0]};
 }
 async evaluateMany(actor:Extract<CatalogActorV2,{kind:'carrier'}>,raw:unknown){
  const inputs=z.array(AvailabilityInput).min(1).max(8).parse(raw);
  const keys=[...new Set(inputs.flatMap(input=>input.kind==='asset'?['assets','calendars','maintenances','repositioning-blocks','vehicle-assignments','holds']:['drivers','driver-assignments']))];
  let partial=false;const rows:Record<string,Row[]>={};
  await Promise.all(keys.map(async key=>{const records:Row[]=[];let offset:number|null=0;
   for(let p=0;p<10&&offset!==null;p++){
    const result: {data:unknown;meta?:{nextOffset?:number|null}}=key==='holds'?await this.workflow.read(actor,key,{carrierId:actor.carrierId,requestId:null,parentId:null,id:null},{limit:100,offset}):await this.catalog.list(actor,key as Parameters<CatalogServiceV2['list']>[1],{carrierId:actor.carrierId,serviceId:null},{limit:100,offset});
    const list=z.array(z.unknown()).parse(result.data) as Row[];records.push(...list);offset='meta' in result?result.meta?.nextOffset??null:null;
   }if(offset!==null)partial=true;rows[key]=records;
  }));
  const at=new Date().toISOString();return {schemaVersion:'2.0' as const,data:inputs.map(input=>evaluateResourceWindow(input,rows,partial,at))};
 }
}
