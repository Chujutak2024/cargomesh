import type { V2IntakePrototypeDraft } from "./prototype-model";
import type { ConversationField } from "./conversation-fields";

export type PendingMeasurement = {
  values: [number, number, number];
  unit: "m" | "cm" | null;
  scope: "UNIT" | "SHIPMENT" | null;
};
export type MeasurementTurn = {
  handled: boolean;
  pending: PendingMeasurement | null;
  fields: Array<{field: ConversationField; value: string}>;
  question: "UNIT" | "SCOPE" | "PER_UNIT" | "INVALID" | "APPLIED" | "DISCARDED" | null;
  volumeM3?: number;
};
const number = String.raw`(-?\d+(?:[.,]\d+)?)`;
const triple = new RegExp(String.raw`(?<![\w.,-])${number}\s*(?:x|×|by|por)\s*${number}\s*(?:x|×|by|por)\s*${number}\s*(cm|cent[ií]metros?|centimeters?|m(?![\p{L}\d³])|metros?|meters?)?`, "iu");
const unitScope = /\b(?:por (?:cada )?(?:unidad|pallet|palet|caja)|cada (?:unidad|pallet|palet|caja|uno|una)|per (?:unit|pallet|box)|each(?: unit| pallet| box)?)\b/i;
const totalScope = /\b(?:conjunto|en total|todo el (?:grupo|env[ií]o)|total shipment|whole shipment|all (?:pallets|boxes)|group)\b/i;
function unitOf(text: string): "m" | "cm" | null {
  if (/\b(?:cm|cent[ií]metros?|centimeters?)\b/i.test(text)) return "cm";
  if (/\b(?:m|metros?|meters?)\b/i.test(text)) return "m";
  return null;
}
function scopeOf(text: string): PendingMeasurement["scope"] {
  const unit = unitScope.test(text), total = totalScope.test(text);
  return unit === total ? null : unit ? "UNIT" : "SHIPMENT";
}
function round(value: number) { return Number(value.toFixed(6)); }

/** Resolves only explicit measurement facts. A group bounding box never becomes per-unit dimensions. */
export function measurementTurn(text: string, pending: PendingMeasurement | null, draft: V2IntakePrototypeDraft): MeasurementTurn {
  if (pending && /^(?:descarta(?:r)? (?:estas |las )?medidas|cancel measurements|discard (?:these )?measurements)[.!]?$/i.test(text.trim())) return {handled:true,pending:null,fields:[],question:"DISCARDED"};
  const match = triple.exec(text);
  let next: PendingMeasurement | null = match ? {
    values: [Number(match[1].replace(",", ".")), Number(match[2].replace(",", ".")), Number(match[3].replace(",", "."))],
    unit: unitOf(match[4] ?? ""), scope: scopeOf(text),
  } : null;
  if (!next && pending) {
    const unit = unitOf(text), scope = scopeOf(text);
    if (!unit && !scope) return {handled:false,pending,fields:[],question:null};
    next = {...pending, unit:unit ?? pending.unit, scope:scope ?? pending.scope};
  }
  if (!next && !pending) {
    const correction = /\b(?:altura|alto|height|ancho|width|largo|length)\s*(?:es|a|de|to|is)?\s*(\d+(?:[.,]\d+)?)\s*(cm|cent[ií]metros?|centimeters?|metros?|meters?|m)\b/i.exec(text);
    if (correction && [draft.unitLengthCm,draft.unitWidthCm,draft.unitHeightCm].every(v=>Number(v)>0)) {
      const values: [number,number,number] = [Number(draft.unitLengthCm),Number(draft.unitWidthCm),Number(draft.unitHeightCm)];
      const index = /altura|alto|height/i.test(correction[0]) ? 2 : /ancho|width/i.test(correction[0]) ? 1 : 0;
      values[index] = Number(correction[1].replace(",", ".")) * (unitOf(correction[2]) === "m" ? 100 : 1);
      next = {values,unit:"cm",scope: totalScope.test(text) ? "SHIPMENT" : "UNIT"};
    }
  }
  if (!next) return {handled:false,pending,fields:[],question:null};
  if (next.values.some(v=>!Number.isFinite(v)||v<=0||v>1_000_000)) return {handled:true,pending:next,fields:[],question:"INVALID"};
  if (!next.unit) return {handled:true,pending:next,fields:[],question:"UNIT"};
  const cm = next.values.map(v=>round(v*(next.unit==="m"?100:1))) as [number,number,number];
  const volumeM3 = round(cm[0]*cm[1]*cm[2]/1_000_000);
  if (!Number.isFinite(volumeM3)||volumeM3<=0) return {handled:true,pending:next,fields:[],question:"INVALID"};
  if (!next.scope) return {handled:true,pending:next,fields:[],question:"SCOPE",volumeM3};
  if (next.scope==="SHIPMENT") return {handled:true,pending:next,fields:[],question:"PER_UNIT",volumeM3};
  return {handled:true,pending:null,question:"APPLIED",volumeM3,fields:[
    {field:"unitLengthCm",value:String(cm[0])},{field:"unitWidthCm",value:String(cm[1])},
    {field:"unitHeightCm",value:String(cm[2])},{field:"unitVolumePerUnitM3",value:String(volumeM3)},
  ]};
}

export function measurementReply(turn: MeasurementTurn, language: "es" | "en"): string {
  if (language==="es") {
    if(turn.question==="DISCARDED") return "Descarté la propuesta de medidas pendiente. Los datos anteriores se conservan; revisa el resumen antes de confirmar.";
    if(turn.question==="UNIT") return "¿Esas medidas están en metros o centímetros? Todavía no las apliqué.";
    if(turn.question==="SCOPE") return `Esas medidas dan ${turn.volumeM3} m³. ¿Son de cada unidad o de todo el conjunto? No guardaré una interpretación sin aclararlo.`;
    if(turn.question==="PER_UNIT") return `El conjunto mide ${turn.volumeM3} m³. Para describir cada unidad necesito sus medidas; no repartiré ese volumen ni inventaré sus dimensiones. ¿Cuánto mide cada unidad?`;
    if(turn.question==="INVALID") return "Las medidas deben ser positivas y estar dentro del rango admitido. Indica largo, ancho, alto, unidad de medida y si corresponden a cada unidad.";
    return `Apliqué las medidas por unidad: ${turn.volumeM3} m³ por unidad. Conservé los demás datos y recalculé el volumen total. Revisa el resumen antes de guardar.`;
  }
  if(turn.question==="DISCARDED") return "Discarded the pending measurement proposal. Previous fields are preserved; review before confirming.";
  if(turn.question==="UNIT") return "Are those measurements in meters or centimeters? They have not been applied.";
  if(turn.question==="SCOPE") return `Those dimensions give ${turn.volumeM3} m³. Do they describe each unit or the whole shipment? I will not save an assumed interpretation.`;
  if(turn.question==="PER_UNIT") return `The whole shipment is ${turn.volumeM3} m³. Please give each unit's dimensions; I will not divide that volume or invent dimensions.`;
  if(turn.question==="INVALID") return "Please give positive length, width and height, their measurement unit, and whether they describe each unit.";
  return `Applied per-unit dimensions: ${turn.volumeM3} m³ per unit. Other fields were preserved and total volume recalculated. Review before saving.`;
}
