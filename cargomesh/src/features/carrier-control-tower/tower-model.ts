import {vehicleDisplayName,driverDisplayName,displayReference,locationDisplayLabel,cargoDisplayDescription} from '@/shared/lib/display-identity';
import {z} from 'zod';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';
import {parseCommercialRecord} from '@/features/carrier-portal/commercial-model';

export const towerKeys=['executions','bookings','offers','opportunities','assets','drivers','vehicle-assignments','driver-assignments','depots'] as const;
export type TowerKey=typeof towerKeys[number];
export type TowerSnapshot={carrierId:string;records:Record<TowerKey,PortalRecord[]>;loaded:Record<TowerKey,boolean>;partial:boolean;issues:string[];readAt:string};
export type Point={lat:number;lng:number};
export type TowerItem={id:string;operationId:string|null;bookingId:string|null;requestId:string|null;organizationId:string|null;vehicle:string;vehicleIds:string[];driver:string;origin:string;destination:string;cargo:string;equipment:string;status:string;position:Point|null;observedAt:string|null;provenance:string;positionIssue:string;plannedEnd:string|null;issues:string[]};
export type TowerSite={id:string;name:string;location:string;active:boolean;position:Point|null};
const PointSchema=z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)});
const Instant=z.string().datetime({offset:true});
export function point(value:unknown):Point|null{const parsed=PointSchema.safeParse(value);return parsed.success?parsed.data:null;}
const text=(value:unknown,fallback:string)=>typeof value==='string'&&value.trim()?value:fallback;
// Catalog and workflow records have different envelopes; do not join catalog names by city or code.
type Scoped=PortalRecord&{organizationId?:string|null;requestId?:string|null};
const related=(a:Scoped,b:Scoped)=>a.carrierId===b.carrierId&&typeof a.organizationId==='string'&&typeof a.requestId==='string'&&a.organizationId===b.organizationId&&a.requestId===b.requestId;
const overlap=(a:unknown,b:{startsAt:string;endsAt:string})=>{const w=z.object({startsAt:Instant,endsAt:Instant}).safeParse(a);return w.success&&Date.parse(w.data.startsAt)<Date.parse(b.endsAt)&&Date.parse(w.data.endsAt)>Date.parse(b.startsAt);};
export function towerSites(snapshot:TowerSnapshot):TowerSite[]{return snapshot.records.depots.map(row=>{const d=recordData(row),l=d.location as Record<string,unknown>|undefined;return {id:row.id,name:text(d.name,row.id.slice(0,8)),active:d.active===true,location:[l?.city,l?.countryCode].filter(v=>typeof v==='string').join(', '),position:point(l)};});}
export function towerItems(snapshot:TowerSnapshot,now=Date.now()):TowerItem[]{
 const r=snapshot.records,assigned=new Set<string>();
 const operations=r.executions.map(raw=>{
  const e=parseCommercialRecord('executions',raw,snapshot.carrierId),issues:string[]=[];
  const b=r.bookings.find(b=>b.id===e.data.bookingId&&related(b,e));
  const offerId=b?recordData(b).offerId:null;
  const f=r.offers.find(f=>f.id===offerId&&b&&related(f,b)&&Array.isArray(recordData(f).coveredServiceIds)&&(recordData(f).coveredServiceIds as unknown[]).includes(e.data.serviceId));
  const fData=f?recordData(f):null;
  const o=f?r.opportunities.find(o=>o.id===fData?.opportunityId&&related(o,f)&&recordData(o).planId===fData?.planCandidateId):null;
  if(!b)issues.push('Booking context unavailable.');if(!f)issues.push('Selected offer context unavailable.');if(!o)issues.push('Customer route and cargo context unavailable.');
  const vehicles=r['vehicle-assignments'].filter(row=>{const a=recordData(row);return a.executionId===e.id&&a.serviceId===e.data.serviceId&&a.status==='CONFIRMED'&&overlap(a.window,e.data.plannedWindow);}).flatMap(row=>{const a=recordData(row),asset=r.assets.find(v=>v.id===a.assetId&&recordData(v).serviceId===e.data.serviceId);return asset?[asset]:[];});
  const uniqueVehicles=[...new Map(vehicles.map(v=>[v.id,v])).values()];uniqueVehicles.forEach(v=>assigned.add(v.id));
  const drivers=r['driver-assignments'].filter(row=>{const a=recordData(row);return a.executionId===e.id&&a.serviceId===e.data.serviceId&&a.status==='CONFIRMED'&&overlap(a.window,e.data.plannedWindow);}).flatMap(row=>{const a=recordData(row),d=r.drivers.find(d=>d.id===a.driverId&&recordData(d).serviceId===e.data.serviceId);return d?[driverDisplayName(text(recordData(d).fullName,'Unnamed driver'),d.id)]:[];});
  const rawPosition=point(e.data.lastKnownPosition),time=Instant.safeParse(e.data.lastObservedAt);
  const observedAt=time.success&&Date.parse(time.data)<=now?time.data:null;
  const proof=z.object({provenanceStatus:z.enum(['VERIFIED','ESTIMATED','SIMULATED','UNKNOWN'])}).safeParse(e.data.positionEvidence);
  const provenance=proof.success?proof.data.provenanceStatus:'UNKNOWN';
  const position=rawPosition&&observedAt?rawPosition:null;
  const data=o?recordData(o):{},origin=data.origin as Record<string,unknown>|undefined,destination=data.destination as Record<string,unknown>|undefined,cargo=data.cargoSpecification as Record<string,unknown>|undefined;
  if(!uniqueVehicles.length)issues.push('No confirmed vehicle link available.');
  if(!drivers.length)issues.push('No confirmed driver link available.');
  return {id:e.id,operationId:e.id,bookingId:b?.id??null,requestId:e.requestId,organizationId:e.organizationId,vehicle:uniqueVehicles.map(v=>vehicleDisplayName(v.id,String(recordData(v).code??v.id),(recordData(v).roadVehicle as {plate?:string}|undefined)?.plate)).join(', ')||'Vehicle assignment unavailable',vehicleIds:uniqueVehicles.map(v=>v.id),driver:[...new Set(drivers)].join(', ')||'Driver assignment unavailable',origin:locationDisplayLabel(text(origin?.label,text(origin?.city,'Origin unavailable'))),destination:locationDisplayLabel(text(destination?.label,text(destination?.city,'Destination unavailable'))),cargo:cargoDisplayDescription(typeof cargo?.description==='string'?cargo.description:null,typeof cargo?.categoryCode==='string'?cargo.categoryCode:null),equipment:[...new Set(uniqueVehicles.map(v=>text(recordData(v).equipmentType,'Unknown equipment')))].join(', ')||'Equipment unavailable',status:e.status,position,observedAt,provenance,positionIssue:position?'':rawPosition?'Position timestamp unavailable or invalid.':'Position unavailable',plannedEnd:e.data.plannedWindow.endsAt,issues};
 });
 // A vehicle without a linked operation still belongs in the accessible directory, never at its home depot.
 const vehicles=r.assets.filter(row=>recordData(row).mode==='ROAD'&&!assigned.has(row.id)).map(row=>{const a=recordData(row);return {id:'asset:'+row.id,operationId:null,bookingId:null,requestId:null,organizationId:null,vehicle:vehicleDisplayName(row.id,String(a.code??row.id),(a.roadVehicle as {plate?:string}|undefined)?.plate),vehicleIds:[row.id],driver:'No linked operation',origin:'No linked operation',destination:'Not recorded',cargo:'Not recorded',equipment:text(a.equipmentType,'Unknown equipment'),status:text(a.operatingStatus,'UNKNOWN'),position:null,observedAt:null,provenance:'UNKNOWN',positionIssue:'Position unavailable',plannedEnd:null,issues:['Catalog operating condition does not confirm booking availability.']};});
 return [...operations,...vehicles];
}
export function filterTower(items:TowerItem[],query:string,status:string){const q=query.trim().toLowerCase();return items.filter(item=>(status==='All'||item.status===status)&&[item.id,displayReference(item.operationId,'OP'),item.vehicle,item.driver,item.origin,item.destination,item.cargo].join(' ').toLowerCase().includes(q));}
export function towerDate(value:string|null){return value?new Date(value).toLocaleString('en-US',{timeZone:'UTC'})+' UTC':'Not recorded';}
