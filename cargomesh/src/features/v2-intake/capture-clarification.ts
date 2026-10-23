export type DateClarification={alternatives:string[];timeZone:string;referenceDate:string;role?:"pickup"|"delivery";startTime?:string;endTime?:string;windows?:Partial<Record<"pickup"|"delivery",{startsOn?:string;endsOn?:string}>>};
export function remainingDateClarification(pending:DateClarification|null,role:"pickup"|"delivery"):DateClarification|null {
 const windows={...pending?.windows};delete windows[role];
 return pending&&Object.keys(windows).length?{alternatives:[],timeZone:pending.timeZone,referenceDate:pending.referenceDate,windows}:null;
}
/** Explicit dates only: invalid calendar dates are never rolled into another month. */
export function explicitDates(text:string):string[] {
 return [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)].flatMap(m=>{
  const iso=m[1]?`${m[1]}-${m[2]}-${m[3]}`:`${m[6]}-${m[5].padStart(2,'0')}-${m[4].padStart(2,'0')}`;
  const date=new Date(iso+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso?[iso]:[];
 });
}
export function sessionDate(now:number,timeZone:string){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(now));
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function dateClarification(text:string,timeZone:string,now=Date.now()):DateClarification|null{
 const referenceDate=sessionDate(now,timeZone);
 const dates=explicitDates(text);
 const dateText=text.replace(/\b(?:de|por)\s+la\s+ma[nñ]ana\b/gi,"");
 const relative=/\b(?:hoy|today|ma[nñ]ana|tomorrow|pasado ma[nñ]ana|day after tomorrow)\b/i.test(dateText);
 const alternatives=/\b(?:o|or)\b/i.test(text)&&(/\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)||dates.length>1);
 if(!relative&&!alternatives&&!dates.length)return null;
 if(relative){const offset=/pasado ma[nñ]ana|day after tomorrow/i.test(dateText)?2:/\b(?:hoy|today)\b/i.test(dateText)?0:1;const next=new Date(`${referenceDate}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+offset);dates.push(next.toISOString().slice(0,10));}
 return {alternatives:[...new Set(dates)].slice(0,6),timeZone,referenceDate};
}
export function needsCargoClassification(text:string){return /\b(?:material(?:es)? peligros[oa]s?|carga peligrosa|peligroso|hazardous|hazmat|dangerous goods|no s[eé].*(?:categor[ií]a|tipo de carga))\b/i.test(text);}
export function validExplicitWindow(start:string,end:string){
 const valid=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;const d=new Date(value);return Number.isFinite(d.getTime())&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`===value;};
 return valid(start)&&valid(end)&&Date.parse(start)<Date.parse(end);
}
