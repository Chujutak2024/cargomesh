import type {IntakeOptionsData} from "./contracts";
import type {ConversationField} from "./conversation-fields";
import {parseConversationField} from "./conversation-fields";
import {type DateClarification} from "./capture-clarification";

import {resolveSpokenDateWindow} from "./spoken-date-window";

export function spokenCaptureClarification(text:string,pending:{date:DateClarification|null;classification:boolean},options:IntakeOptionsData,timeZone:string,now=Date.now(),roleHint?:"pickup"|"delivery"){
 const fields:Array<{field:ConversationField;value:string}>=[];
 let dateResolved=false,classificationResolved=false;
 const dateResult=resolveSpokenDateWindow(text,pending.date,timeZone,now,roleHint);
 fields.push(...dateResult.fields); dateResolved=dateResult.dateResolved;
 if(pending.classification&&!/\b(?:no confirmo|no he revisado|creo|quiz[aá]s|tal vez|not confirm|maybe)\b/i.test(text)&&/\b(?:confirmo|confirm|he revisado|i reviewed)\b/i.test(text)){
  const category=/\b(?:categor[ií]a|category)\s*(?:es|is|:)?\s*([^,;.]+)/i.exec(text);
  const product=/\b(?:producto(?: es)?|contienen|cargo is|product is)\s*:?\s*([^,;.]+)/i.exec(text);
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const exact=category?options.cargoCategories.filter(c=>[c.code,c.labelEs,c.labelEn].some(label=>normalize(label)===normalize(category[1]))):[];
  const code=exact.length===1?exact[0].code:category?parseConversationField('categoryCode',category[1].trim(),options):null;
  if(code&&product&&product[1].trim().length>=3){fields.push({field:'categoryCode',value:code},{field:'cargoDescription',value:product[1].trim().slice(0,200)});classificationResolved=true;}
 }
 return {fields,dateResolved,classificationResolved,pendingDate:dateResult.pendingDate};
}
