import type {Opportunity} from './commercial-model';

type Leg = {sequence?:unknown; mode?:unknown; estimatedDistanceKm?:unknown; source?:unknown};
type Snapshot = {resource?:{equipment?:unknown}; routeLeg?:Leg};

/** Only persisted ROAD legs and one unambiguous load-bearing equipment type are quotable. */
export function carrierEstimateBasis(opportunity:Opportunity, assignmentIds:string[]){
 const snapshots=opportunity.data.assignmentSnapshots.filter(row=>assignmentIds.includes(String(row.legAssignmentId??row.id))) as Snapshot[];
 if(!snapshots.length||assignmentIds.some(id=>!snapshots.some(row=>String((row as Snapshot & {legAssignmentId?:unknown;id?:unknown}).legAssignmentId??(row as {id?:unknown}).id)===id)))return null;
 const equipment=[...new Set(snapshots.map(row=>row.resource?.equipment).filter((v):v is string=>typeof v==='string'&&v.length>0))];
 if(equipment.length!==1)return null;
 const legs=new Map<string,number>();
 for(const row of snapshots){const leg=row.routeLeg;if(!leg||leg.mode!=='ROAD'||!Number.isInteger(leg.sequence)||Number(leg.sequence)<=0||typeof leg.estimatedDistanceKm!=='number'||!Number.isFinite(leg.estimatedDistanceKm)||leg.estimatedDistanceKm<=0)return null;
  const key=String(leg.sequence);const previous=legs.get(key);if(previous!==undefined&&previous!==leg.estimatedDistanceKm)return null;legs.set(key,leg.estimatedDistanceKm);
 }
 const distanceKm=[...legs.values()].reduce((a,b)=>a+b,0);
 return distanceKm>0&&Number.isFinite(distanceKm)?{distanceKm,equipmentType:equipment[0],legSequences:[...legs.keys()].map(Number)}:null;
}

export function carrierPriceEstimate(distanceKm:number,usdPerKm:number){
 if(!Number.isFinite(distanceKm)||distanceKm<=0||!Number.isFinite(usdPerKm)||usdPerKm<=0)return null;
 const cents=Math.round(distanceKm*usdPerKm*100);
 return Number.isSafeInteger(cents)&&cents>0&&cents<=1e12?cents/100:null;
}

export function acceptsSuggestedPrice(text:string){
 return (/\b(?:use|accept|send|quote|offer|go with)\s+(?:the\s+)?(?:suggested|estimated|recommended|that|this)\s+(?:price|amount|quote|estimate|rate)?\b/i.test(text)
   || /(?:me gusta|acepto|dale|usa|envía|envia)\s+(?:(?:ese|este|el)\s+)?(?:precio|monto|estimado)/i.test(text))
  &&!/\b(?:don't|do not|not|no|instead|change|modify|cambia|cámbialo|cambialo)\b/i.test(text);
}
