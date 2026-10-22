/** Bounded integer speech normalization. Original transcript and consent stay untouched. */
const enUnits=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const enTens=['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const esUnits=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidos','veintitres','veinticuatro','veinticinco','veintiseis','veintisiete','veintiocho','veintinueve'];
const esTens=['treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const esHundreds=['cien','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function small(words:string[],spanish:boolean):number|null{
 const units=spanish?esUnits:enUnits,tens=spanish?esTens:enTens;
 if(words.length===1){const unit=units.indexOf(words[0]);if(unit>=0)return unit;if(spanish&&['un','una','veintiun'].includes(words[0]))return words[0]==='veintiun'?21:1;const ten=tens.indexOf(words[0]);return ten<0?null:(ten+(spanish?3:2))*10;}
 const ten=tens.indexOf(words[0]),tail=spanish&&words[1]==='y'?words.slice(2):words.slice(1);
 if(ten<0||tail.length!==1)return null;
 const unit=units.indexOf(tail[0]);return unit>0&&unit<10?(ten+(spanish?3:2))*10+unit:null;
}
function belowThousand(words:string[],spanish:boolean):number|null{
 if(!words.length)return 0;
 if(spanish){
  const hundred=esHundreds.indexOf(words[0]);
  if(hundred>=0||words[0]==='ciento'){
   if(words[0]==='cien')return words.length===1?100:null;
   const rest=words.length===1?0:small(words.slice(1),true);
   return rest!==null&&rest<100?(words[0]==='ciento'?100:(hundred+1)*100)+rest:null;
  }
 }else{
  const split=words.indexOf('hundred');
  if(split>=0){
   const head=small(words.slice(0,split),false),tail=words.slice(split+1);
   if(tail[0]==='and')tail.shift();
   const rest=tail.length?small(tail,false):0;
   return head!==null&&head>=1&&head<=9&&rest!==null&&rest<100?head*100+rest:null;
  }
 }
 return small(words,spanish);
}
function integer(words:string[],spanish:boolean):number|null{
 const scale=spanish?'mil':'thousand',index=words.indexOf(scale);
 if(index<0)return belowThousand(words,spanish);
 if(words.lastIndexOf(scale)!==index)return null;
 const head=index===0&&spanish?1:belowThousand(words.slice(0,index),spanish),tail=words.slice(index+1);
 if(!spanish&&tail[0]==='and')tail.shift();
 const rest=belowThousand(tail,spanish);
 return head!==null&&head>0&&head<1000&&rest!==null&&rest<1000?head*1000+rest:null;
}
const vocabulary=[...enUnits,...enTens,'hundred','thousand',...esUnits,...esTens,...esHundreds,'ciento','mil','un','una','veintiun'];
// Accents are allowed only in equivalent Spanish number words.
const word=vocabulary.sort((a,b)=>b.length-a.length).map(w=>w.replace(/i/g,'[ií]').replace(/o/g,'[oó]').replace(/e/g,'[eé]')).join('|');
const phrase=new RegExp(`(?<![\\p{L}\\d])(?:${word})(?:(?:[ -]+(?:(?:and|y)[ -]+)?)(?:${word}))*(?![\\p{L}\\d])`,'giu');
export function normalizeSpokenQuantities(text:string):string{
 return text.replace(phrase,(original:string,offset:number)=>{
  const before=text.slice(0,offset),after=text.slice(offset+original.length);
  const quantitative=/^\s*(?:kg\b|kilogramos?\b|kilograms?\b|kilos?\b|pallets?\b|palets?\b|cajas?\b|boxes?\b|crates?\b|units?\b|unidades?\b|cm\b|cent[ií]metros?\b|centimeters?\b|m\b|metros?\b|meters?\b|(?:x|by|por)\s)/i.test(after);
  const standalone=!before.trim()&&!after.replace(/[.!?]/g,'').trim();
  if((!quantitative&&!standalone)||/\b(?:minus|menos|negative|negativo)\s*$/i.test(before))return original;
  const words=fold(original).split(/[ -]+/),value=integer(words,false)??integer(words,true);
  return value!==null&&value>=0&&value<=999999?String(value):original;
 });
}
