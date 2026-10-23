import { interpretDeterministically, isOpenQuestion } from "@/features/v2-conversation-prep/interpretation";
import { normalizeSpokenQuantities } from "@/features/v2-conversation-prep/spoken-quantities";
import { parseConversationField, type GuidedConversationField, type ConversationField } from "./conversation-fields";
import type { IntakeOptionsData } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";

type Fact = { field: GuidedConversationField; value: string };
const numeric = (value: string) => Number(value.replace(",", "."));

/** Local extraction of explicit facts. No capacity, classification of hazardous goods or consent is inferred. */
export function explicitCargoFacts(text: string, draft: V2IntakePrototypeDraft, options: IntakeOptionsData, currentField: GuidedConversationField | null): Fact[] {
  const spoken = normalizeSpokenQuantities(text).trim();
  const facts: Fact[] = [];
  if (isOpenQuestion(spoken)) return facts;
  const put = (field: GuidedConversationField, value: string) => {
    const parsed = parseConversationField(field, value, options);
    if (parsed !== null) facts.push({field, value: parsed});
  };
  const deterministic = interpretDeterministically({schemaVersion:"2.0", text:spoken, currentField:null});
  for (const fact of deterministic.fields) {
    // Dimensions and dates have their own scope/time clarification. Contact values need a role.
    if (/Contact|Window|unit(?:Length|Width|Height)/.test(fact.field) || fact.field === "categoryCode") continue;
    put(fact.field, fact.value);
  }

  // Resolve route clauses against authorized location vocabulary, avoiding the "de" in cargo descriptions.
  const escape=(value:string)=>Array.from(value).map(char => ".*+?^$()[]{}|".includes(char) || char.charCodeAt(0)===92 ? String.fromCharCode(92)+char : char).join("");
  const aliases=[...new Set(options.facilities.flatMap(f=>[f.label,f.city,f.code]))].filter(Boolean).sort((a,b)=>b.length-a.length);
  for(const alias of aliases){
    const location=escape(alias);
    if(new RegExp('\\b(?:de|desde|from)\\s+'+location+'\\s+(?:a|hacia|hasta|to)\\s+','i').test(spoken)
      ||new RegExp('\\b(?:origen(?: es)?|recojo en|pickup at)\\s*:?\\s*'+location+'(?=[,.;]|$)','i').test(spoken))put("originFacilityId",alias);
    if(new RegExp('\\b(?:a|hacia|to|destino(?: es)?|entrega en)\\s*:?\\s*'+location+'(?=[,.;]|$)','i').test(spoken))put("destinationFacilityId",alias);
  }
  const packageMention=/\b\d+\s+(pallets?|palets?|cajas?|boxes?|crates?)\b/i.exec(spoken);
  if(packageMention)put('packaging',/pall?et/i.test(packageMention[1])?'PALLET':/crate/i.test(packageMention[1])?'CRATE':'BOX');
  const perUnitWeight=/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogramos?|kilograms?)\s*(?:cada (?:uno|una)|cada|por (?:unidad|pallet|palet|caja)|each|per (?:unit|pallet|box))\b/i.exec(spoken)
    ?? /\b(?:cada|each|every)\s+(?:pallet|palet|caja|unidad|box|unit)(?:\s+still)?\s+(?:pesa|weighs?)\s+(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogramos?|kilograms?)\b/i.exec(spoken);
  if(perUnitWeight)put("unitWeightPerUnitKg",String(numeric(perUnitWeight[1])));

  const product = /\b(?:boxes?|pallets?|crates?)\s+with\s+(?:one|a|an|\d+)\s+([^;,.]+?)\s+(?:inside(?: of)? each|in each)/i.exec(spoken)
    ?? /\b(?:transporto|transportar|enviar|env[ií]o|mercanc[ií]a(?: es)?|producto(?: es)?|carga(?: es)?|contienen|shipping|ship|cargo is)\s*:?\s+(?:\d+\s+(?:pallets?|palets?|cajas?|boxes?)\s+(?:de|of)\s+)?([^,;.]{3,180}?)(?=\s+(?:desde|from|con un peso|que pesa)\b|[,;.]|$)/i.exec(spoken)
    ?? /\b(?:pallets?|palets?|cajas?|boxes?)\s+(?:de|of)\s+([^,;.]{3,180}?)(?=\s+(?:desde|from)\b|[,;.]|$)/i.exec(spoken);
  if (product && !/^(?:puede|pueden|debe|deben|necesita|necesitan|requiere|requieren|se puede|es urgente)\b/i.test(product[1].trim())) {
    let description=product[1].trim();
    for(const alias of aliases) description=description.replace(new RegExp('\\s+de\\s+'+escape(alias)+'\\s+(?:a|hacia|hasta)\\s+.*$','i'),'');
    put("cargoDescription", description);
  }
  else if (!product && currentField === "cargoDescription" && !/[?¿]|\b(?:requisitos|refrigeraci[oó]n|apilar|dividir|requirements|stack|split)\b/i.test(spoken)) put("cargoDescription", spoken.slice(0,200));
  if (/\b(?:art[ií]culos del hogar|household goods|carga general)\b/i.test(spoken)) {
    put("categoryCode", "GENERAL");
    if(!product)put("cargoDescription",spoken.slice(0,200));
  }
  for (const category of options.cargoCategories) {
    if ([category.code,category.labelEs,category.labelEn].some(label => label.toLowerCase() === spoken.toLowerCase())) put("categoryCode",category.code);
  }

  // Accept an explicitly named per-unit axis, including metres; partial axes remain partial.
  const perUnit=/\b(?:cada|por unidad|por pallet|por palet|per unit|each)\b/i.test(spoken);
  const axes: Array<["unitLengthCm"|"unitWidthCm"|"unitHeightCm",string]> = [["unitLengthCm","largo|length"],["unitWidthCm","ancho|width"],["unitHeightCm","alto|altura|height"]];
  if (!/[?¿]|\b(?:en total|conjunto|whole shipment)\b/i.test(spoken)) {
    for (const [field,label] of axes) {
      const match=new RegExp('\\b(?:'+label+')\\s*(?:es|de|is|of)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(cm|cent[ií]metros?|centimeters?|metros?|meters?|m)\\b','i').exec(spoken)
        ?? new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(cm|cent[ií]metros?|centimeters?|metros?|meters?|m)\\s*(?:de\\s+)?(?:'+label+')\\b','i').exec(spoken);
      const prompted=currentField===field ? /^(\d+(?:[.,]\d+)?)\s*(cm|cent[ií]metros?|centimeters?|metros?|meters?|m)?$/i.exec(spoken) : null;
      const found=match??prompted;
      if(found&&(perUnit||currentField===field))put(field,String(numeric(found[1])*(found[2]&&/^(?:m|metro|meter)/i.test(found[2])?100:1)));
    }
    if(facts.some(f=>axes.some(([axis])=>axis===f.field))) {
      const values=axes.map(([field])=>numeric(facts.find(f=>f.field===field)?.value??draft[field]));
      if(values.every(value=>Number.isFinite(value)&&value>0))put("unitVolumePerUnitM3",String(Number((values[0]*values[1]*values[2]/1_000_000).toFixed(6))));
    }
  }

  // Totals alone do not prove identical units; divide only when explicitly stated.
  const count = numeric(facts.find(f=>f.field==="unitQuantity")?.value ?? draft.unitQuantity);
  const identical = !/\b(?:no (?:son |son todas )?iguales|no (?:son )?id[eé]ntic|not identical|not equal)\b/i.test(spoken) && /\b(?:iguales|id[eé]ntic[oa]s?|mismo peso|same weight|identical|equal weight)\b/i.test(spoken);
  const total = /\b(?:peso total(?: es| de)?|en total pesan|total weight(?: is| of)?)\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilogramos?|toneladas?|tonnes?|tons?)\b/i.exec(spoken);
  if (identical && total && Number.isInteger(count) && count>0 && !draft.additionalUnits?.length) {
    const kg=numeric(total[1]) * (/ton/i.test(total[2])?1000:1);
    put("unitWeightPerUnitKg",String(Number((kg/count).toFixed(6))));
  }

  const temperature=/\b(?:entre|de|between|from)\s+(-?\d+(?:[.,]\d+)?)\s*(?:a|y|and|to|hasta)\s+(-?\d+(?:[.,]\d+)?)\s*(?:°?\s*c\b|grados? celsius|celsius)/i.exec(spoken);
  if(temperature&&!/[?¿]|\b(?:no requiere|no necesita|maybe|quiz[aá]s)\b/i.test(spoken)){put("requirements","TEMP_CONTROLLED");put("temperatureMinCelsius",String(numeric(temperature[1])));put("temperatureMaxCelsius",String(numeric(temperature[2])));}
  if(currentField&&(currentField==="temperatureMinCelsius"||currentField==="temperatureMaxCelsius")&&/^-?\d+(?:[.,]\d+)?(?:\s*°?\s*c)?$/i.test(spoken))put(currentField,spoken.replace(/\s*°?\s*c$/i,""));
  if (!/[?¿]|\b(?:quiz[aá]s|tal vez|no sé|no se si|maybe|not sure)\b/i.test(spoken)) {
    if (/\b(?:no (?:se )?puede (?:ser )?(?:dividir(?:se)?|repartir(?:se)?)|no (?:dividir|repartir)|deben viajar junt[oa]s?|un solo cami[oó]n|must travel together|cannot (?:split|divide))\b/i.test(spoken)) put("divisible","false");
    else if (/\b(?:(?:se )?puede (?:ser )?(?:dividir(?:se)?|repartir(?:se)?)|(?:dividir|repartir) (?:la carga|los bultos)|(?:pueden viajar|puede ir|acepto|permito) en (?:dos|2|varios) camiones|es divisible|may (?:split|divide)|can (?:be split|split))\b/i.test(spoken)) put("divisible","true");
    if (/\b(?:no (?:se )?pueden apilar|no apilable|not stackable|cannot stack)\b/i.test(spoken)) put("unitStackable","false");
    else if (/\b(?:(?:se )?pueden apilar|son apilables|stackable|can stack)\b/i.test(spoken)) put("unitStackable","true");
    if (/\b(?:cada (?:unidad|bulto|pallet) (?:es indivisible|debe (?:ir|viajar) entero)|unidades indivisibles|each (?:unit|package) is indivisible)\b/i.test(spoken)) put("unitIndivisible","true");
    if (/\b(?:cada (?:unidad|bulto) (?:se )?puede (?:dividir|desmontar)|units may be divided)\b/i.test(spoken)) put("unitIndivisible","false");
    if (/\b(?:sin (?:requisitos|condiciones|cuidados) especiales|ning[uú]n requisito especial|no special requirements)\b/i.test(spoken)) put("requirements","NONE");
    const requirements: Array<[string,RegExp]> = [
      ["TEMP_CONTROLLED",/\b(?:refrigeraci[oó]n|refrigerad[oa]|temperatura controlada|temperature controlled|refrigerated)\b/i],
      ["FRAGILE",/\b(?:fr[aá]gil(?:es)?|fragile)\b/i], ["KEEP_DRY",/\b(?:mantener sec[oa]|keep dry)\b/i],
      ["SECURITY_SEAL",/\b(?:sello de seguridad|security seal)\b/i], ["HAZARDOUS",/\b(?:material peligroso|carga peligrosa|hazardous|hazmat)\b/i],
      ["FOOD_GRADE",/\b(?:grado alimentario|food grade)\b/i], ["HIGH_VALUE",/\b(?:alto valor|high value)\b/i],
      ["OVERSIZED",/\b(?:sobredimensionad[oa]|oversized)\b/i], ["TANK_COMPATIBILITY",/\b(?:compatibilidad de cisterna|tank compatibility)\b/i],
    ];
    for (const [code,pattern] of requirements) {
      const match=pattern.exec(spoken); if (!match) continue;
      const prefix=spoken.slice(Math.max(0,match.index-36),match.index);
      const negated=/\b(?:no (?:es|son|necesita|requiere)|sin|not|no)\s*$/i.test(prefix);
      put("requirements",(negated?"!":"")+code);
    }
    if (currentField && ["divisible","unitStackable","unitIndivisible","requirements"].includes(currentField) && facts.every(f=>f.field!==currentField)) put(currentField,spoken);
  }

  const roles=[...spoken.matchAll(/\b(?:recepcionar|recibir|recibe|destinatario|recipient|receiver|despachar|despacho|remitente|pickup contact|sender)\b/gi)];
  const contact = (part:string, role:"pickup"|"recipient") => {
    const prefix=role==="pickup"?"pickupContact":"recipientContact";
    const name=/^(?:\s*(?:es|ser[aá]|se llama|is|:))\s*([\p{L}][\p{L}'’-]*(?:\s+(?!con\b|sin\b|y\b|no\b|with\b)[\p{L}][\p{L}'’-]*){0,3})/iu.exec(part);
    if(name) put(`${prefix}Name`,name[1].trim());
    const phone=/(?:n[uú]mero|tel[eé]fono|celular|phone|number|con)\s*(?:es|:)?\s*(\+?[\d][\d ()-]{7,18}\d)/i.exec(part)?.[1];
    if(phone) {
      const digits=phone.replace(/\D/g,"");
      const routeField=role==="pickup"?"originFacilityId":"destinationFacilityId";
      const facility=options.facilities.find(f=>f.facilityId===(facts.findLast(f=>f.field===routeField)?.value??draft[routeField]));
      const normalized=phone.trim().startsWith("+")?"+"+digits:facility?.countryCode==="PE"&&/^9\d{8}$/.test(digits)?"+51"+digits:null;
      if(normalized) put(`${prefix}PhoneE164`,normalized);
    }
    const email=/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.exec(part)?.[0];
    if(email) put(`${prefix}Email`,email);
    else if(/\b(?:no tiene (?:correo|email)|sin correo|no email)\b/i.test(part)) put(`${prefix}Email`,"NONE");
  };
  roles.forEach((match,index)=>contact(spoken.slice(match.index!+match[0].length,roles[index+1]?.index??spoken.length),/despach|remitente|pickup|sender/i.test(match[0])?"pickup":"recipient"));
  if (!roles.length && currentField?.includes("Contact")) {
    const role=currentField.startsWith("pickup")?"pickup":"recipient";
    if(currentField.endsWith("PhoneE164"))contact(" con "+spoken,role);
    else if(currentField.endsWith("Email"))contact(" "+spoken,role);
    else if(currentField.endsWith("Name")&&!/[?¿\d]/.test(spoken))contact(" es "+spoken,role);
  }
  const result:Fact[]=[];
  for(const fact of facts){
    const previous=result.findIndex(item=>item.field===fact.field&&(fact.field!=='requirements'||item.value===fact.value));
    if(previous>=0)result.splice(previous,1);
    result.push(fact);
  }
  return result;
}

/** Local facts win over model suggestions, for both text and voice. Sensitive or
 * scope-dependent facts must be extracted locally, never merely acknowledged by Nova. */
export function groundedCargoSuggestions(text:string,draft:V2IntakePrototypeDraft,options:IntakeOptionsData,currentField:GuidedConversationField|null,proposals:Array<{field:ConversationField;value:string}>):Fact[] {
  const local=explicitCargoFacts(text,draft,options,currentField);
  const owned=new Set<ConversationField>(local.map(f=>f.field));
  if(isOpenQuestion(text)) return [];
  const normalized=normalizeSpokenQuantities(text).trim().replace(/[.!]+$/,'');
  const protectedField=(field:string)=>/Contact|Window|^unit(?:Quantity|Weight|Volume|Length|Width|Height)|^(?:divisible|requirements|unitIndivisible|unitStackable|temperatureMinCelsius|temperatureMaxCelsius)$/.test(field);
  const remaining=proposals.filter(f=>{
    if(owned.has(f.field))return false;
    if(f.field==='originFacilityId'||f.field==='destinationFacilityId'){
      const resolved=parseConversationField(f.field,normalized,options);
      if(resolved&&resolved===parseConversationField(f.field,f.value,options))return true;
      return !local.length&&/\b(?:from|desde|origen|destino|pickup|delivery|recojo|entrega)\b/i.test(text)&&normalized.toLowerCase().includes(f.value.toLowerCase());
    }
    if(protectedField(f.field)) {
      // Short scalar answers are meaningful only for the actual question asked.
      if(f.field!==currentField||!/^(?:unitQuantity|unitWeightPerUnitKg|unitVolumePerUnitM3)$/.test(f.field))return false;
      const scalar=/^(\d+(?:[.,]\d+)?)(?:\s*(?:kg|kilos?|kilograms?|kilogramos?|m3|m³))?$/.exec(normalized);
      return Boolean(scalar&&Number(scalar[1].replace(',','.'))===Number(f.value));
    }
    // A model may identify a catalog term, but cannot choose an unstated category/equipment.
    if(f.field==='categoryCode'||f.field==='requiredEquipment')return parseConversationField(f.field,normalized,options)===f.value;
    if(f.field==='cargoDescription')return false;
    return true;
  });
  return [...remaining as Fact[],...local];
}

/** A recommendation is a type suggestion, never a hard requirement or a capacity claim. */
export function suggestedRoadEquipment(draft: V2IntakePrototypeDraft, options: IntakeOptionsData): string[] {
  if (draft.requirements.includes("TEMP_CONTROLLED")) return options.equipmentOptions.filter(o=>o.code==="REEFER_TRUCK").map(o=>o.code);
  if (draft.requirements.includes("TANK_COMPATIBILITY")) return options.equipmentOptions.filter(o=>o.code==="TANKER_TRUCK").map(o=>o.code);
  return (options.cargoCategories.find(c=>c.code===draft.categoryCode)?.guidance.recommendedVehicleClasses??[])
    .filter(code=>options.equipmentOptions.some(o=>o.code===code));
}
