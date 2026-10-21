import type {IntakeOptionsData} from "./contracts";
import type {ConversationField} from "./conversation-fields";
import {parseConversationField} from "./conversation-fields";
import {dateClarification,validExplicitWindow,type DateClarification} from "./capture-clarification";

const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const hours:Record<string,number>={una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12};
function exactDate(text:string,pending:DateClarification|null,timeZone:string,now:number):string|null{
 const iso=/\b(\d{4}-\d{2}-\d{2})\b/.exec(text);if(iso)return iso[1];
 const natural=/\b(\d{1,2}) de ([a-z]+) (?:de |del )?(\d{4})\b/i.exec(text);
 if(natural){const month=months.indexOf(natural[2].toLowerCase());if(month>=0)return `${natural[3]}-${String(month+1).padStart(2,'0')}-${natural[1].padStart(2,'0')}`;return null;}
 const relative=dateClarification(text,timeZone,now);
 if(relative)return relative.alternatives.length===1&&!/\b(?:o|or)\b/i.test(text)?relative.alternatives[0]:null;
 if(/\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\bel\s+\d{1,2}\b/i.test(text))return null;
 // A follow-up may choose a single already proposed date, but never choose among alternatives.
 return pending?.alternatives.length===1?pending.alternatives[0]:null;
}
export function spokenCaptureClarification(text:string,pending:{date:DateClarification|null;classification:boolean},options:IntakeOptionsData,timeZone:string,now=Date.now(),roleHint?:"pickup"|"delivery"){
 const fields:Array<{field:ConversationField;value:string}>=[];
 let dateResolved=false,classificationResolved=false;
 const pickupExplicit=/\b(?:recojo|recogida|retiro|pickup|collection)\b/i.test(text),deliveryExplicit=/\b(?:entrega|delivery)\b/i.test(text);
 const pickup=pickupExplicit||(!deliveryExplicit&&roleHint==="pickup"),delivery=deliveryExplicit||(!pickupExplicit&&roleHint==="delivery");
 const day=exactDate(text,pending.date,timeZone,now);
 // A full local window needs an explicit role and unambiguous 24h/AM/PM clock.
 const normalized=text.toLowerCase().replace(/\b(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g,word=>String(hours[word]));
 const range=/\b(?:de|desde|from)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\s*(?:a|hasta|to|until)\s+(?:las\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i.exec(normalized);
 if(day&&pickup!==delivery&&range&&!/\b(?:no|quiz[aá]s|tal vez|maybe|not)\b/i.test(text)){
  const common=/de la ma[nñ]ana|morning/i.test(text)?'am':/de la tarde|de la noche|afternoon|evening/i.test(text)?'pm':null;
  const clock=(h:string,m:string|undefined,meridiem:string|undefined)=>{
   let hour=Number(h);const mer=(meridiem?.replace(/[.\s]/g,'')??common);
   if(mer){if(hour<1||hour>12)return null;hour=hour%12+(mer==='pm'?12:0);}
   else if(!m&&hour<13)return null;
   const minute=Number(m??0);if(hour>23||minute>59)return null;
   return `${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  };
  const start=clock(range[1],range[2],range[3]??range[6]),end=clock(range[4],range[5],range[6]);
  if(start&&end&&validExplicitWindow(start,end)){
   fields.push({field:pickup?'pickupWindowStartsAt':'deliveryWindowStartsAt',value:start},{field:pickup?'pickupWindowEndsAt':'deliveryWindowEndsAt',value:end});dateResolved=true;
  }
 }
 if(pending.classification&&!/\b(?:no confirmo|no he revisado|creo|quiz[aá]s|tal vez|not confirm|maybe)\b/i.test(text)&&/\b(?:confirmo|confirm|he revisado|i reviewed)\b/i.test(text)){
  const category=/\b(?:categor[ií]a|category)\s*(?:es|is|:)?\s*([^,;.]+)/i.exec(text);
  const product=/\b(?:producto(?: es)?|contienen|cargo is|product is)\s*:?\s*([^,;.]+)/i.exec(text);
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const exact=category?options.cargoCategories.filter(c=>[c.code,c.labelEs,c.labelEn].some(label=>normalize(label)===normalize(category[1]))):[];
  const code=exact.length===1?exact[0].code:category?parseConversationField('categoryCode',category[1].trim(),options):null;
  if(code&&product&&product[1].trim().length>=3){fields.push({field:'categoryCode',value:code},{field:'cargoDescription',value:product[1].trim().slice(0,200)});classificationResolved=true;}
 }
 return {fields,dateResolved,classificationResolved};
}
