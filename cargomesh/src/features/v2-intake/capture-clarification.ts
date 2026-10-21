export type DateClarification={alternatives:string[];timeZone:string;referenceDate:string};
export function sessionDate(now:number,timeZone:string){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(now));
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function dateClarification(text:string,timeZone:string,now=Date.now()):DateClarification|null{
 const referenceDate=sessionDate(now,timeZone);
 const dates=[...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
 const relative=/\b(?:hoy|today|ma[nñ]ana|tomorrow|pasado ma[nñ]ana|day after tomorrow)\b/i.test(text);
 const alternatives=/\b(?:o|or)\b/i.test(text)&&(/\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)||dates.length>1);
 if(!relative&&!alternatives)return null;
 if(relative){const offset=/pasado ma[nñ]ana|day after tomorrow/i.test(text)?2:/\b(?:hoy|today)\b/i.test(text)?0:1;const next=new Date(`${referenceDate}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+offset);dates.push(next.toISOString().slice(0,10));}
 return {alternatives:[...new Set(dates)].slice(0,6),timeZone,referenceDate};
}
export function needsCargoClassification(text:string){return /\b(?:material(?:es)? peligros[oa]s?|carga peligrosa|peligroso|hazardous|hazmat|dangerous goods|no s[eé].*(?:categor[ií]a|tipo de carga))\b/i.test(text);}
export function validExplicitWindow(start:string,end:string){
 const valid=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;const d=new Date(value);return Number.isFinite(d.getTime())&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`===value;};
 return valid(start)&&valid(end)&&Date.parse(start)<Date.parse(end);
}
