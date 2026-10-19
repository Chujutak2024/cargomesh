import {recordData,type PortalRecord} from '@/features/carrier-portal/records';

const DAY=86_400_000;
type Scope={carrierId:string;serviceId:string;driverId:string};
export type ActivityDay={date:string;hours:number|null};

/** Confirmed assignment windows, never telemetry or a performance score. */
export function driverActivity(records:PortalRecord[],scope:Scope,at:string,days:number,unavailable=false){
 const clock=Date.parse(at);
 if(!Number.isFinite(clock)||![7,14,30].includes(days))return {series:[] as ActivityDay[],count:null};
 const end=Math.floor(clock/DAY)*DAY+DAY,start=end-days*DAY;
 const matching=records.filter(row=>{const d=recordData(row);return row.carrierId===scope.carrierId&&d.serviceId===scope.serviceId&&d.driverId===scope.driverId&&d.status==='CONFIRMED';});
 let invalid=false;
 const windows=matching.flatMap(row=>{const w=recordData(row).window as {startsAt?:string;endsAt?:string}|null;
  const a=Date.parse(w?.startsAt??''),b=Date.parse(w?.endsAt??'');
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){invalid=true;return [];}
  return b>start&&a<end?[[Math.max(a,start),Math.min(b,end)] as const]:[];
 }).sort((a,b)=>a[0]-b[0]);
 const merged:number[][]=[];
 for(const [a,b] of windows){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}
 return {count:unavailable||invalid?null:windows.length,series:Array.from({length:days},(_,i)=>{
  const a=start+i*DAY,b=a+DAY;
  return {date:new Date(a).toISOString().slice(0,10),hours:unavailable||invalid?null:merged.reduce((sum,[x,y])=>sum+Math.max(0,Math.min(b,y)-Math.max(a,x)),0)/3_600_000};
 })};
}

/** Show recorded duty policy and license dates without declaring availability. */
export function driverFacts(row:PortalRecord,at:string){
 const d=recordData(row),clock=Date.parse(at);
 const used=typeof d.usedDutySeconds==='number'&&Number.isFinite(d.usedDutySeconds)&&d.usedDutySeconds>=0?d.usedDutySeconds:null;
 const limit=typeof d.maximumDutySeconds==='number'&&Number.isFinite(d.maximumDutySeconds)&&d.maximumDutySeconds>0?d.maximumDutySeconds:null;
 const window=d.dutyWindow as {startsAt?:string;endsAt?:string}|null;
 const current=!!window&&Number.isFinite(clock)&&Date.parse(window.startsAt??'')<=clock&&Date.parse(window.endsAt??'')>clock;
 let license:'expired'|'recorded'|'unknown'='unknown';
 const expires=typeof d.licenseValidUntil==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.licenseValidUntil)?d.licenseValidUntil:null;
 if(expires&&Number.isFinite(clock)&&typeof d.licenseTimezone==='string'){
  try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:d.licenseTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(clock);
   const part=(key:string)=>parts.find(p=>p.type===key)?.value;
   const date=`${part('year')}-${part('month')}-${part('day')}`;
   license=expires<date?'expired':'recorded';
  }catch{/* Unknown timezone cannot establish validity. */}
 }
 const state=typeof d.dutyStatus==='string'&&['AVAILABLE','ON_DUTY','OFF_DUTY','SUSPENDED'].includes(d.dutyStatus)?d.dutyStatus:'UNKNOWN';
 return {state,expires,license,usedHours:used===null?null:used/3600,limitHours:limit===null?null:limit/3600,
  percent:used!==null&&limit!==null&&used<=limit?used/limit*100:null,current,window};
}
