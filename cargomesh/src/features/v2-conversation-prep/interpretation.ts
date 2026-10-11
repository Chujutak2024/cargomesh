import { z } from "zod";

export const ConversationFieldNameSchema = z.enum([
  "originFacilityId", "destinationFacilityId", "categoryCode", "packaging", "cargoDescription",
  "unitQuantity", "unitWeightPerUnitKg", "unitVolumePerUnitM3", "unitLengthCm", "unitWidthCm",
  "unitHeightCm", "pickupWindowStartsAt", "pickupWindowEndsAt", "deliveryWindowStartsAt",
  "deliveryWindowEndsAt", "requiredEquipment", "pickupContactName", "pickupContactPhoneE164",
  "pickupContactEmail", "recipientContactName", "recipientContactPhoneE164", "recipientContactEmail",
]);

// Only non-contact provisional facts cross the Bedrock boundary. IDs, when present,
// are hints for interpreting a correction, never proof of authorization or coverage.
export const ConversationContextFieldSchema = ConversationFieldNameSchema.exclude([
  "cargoDescription",
  "pickupContactName", "pickupContactPhoneE164", "pickupContactEmail",
  "recipientContactName", "recipientContactPhoneE164", "recipientContactEmail",
]);

export const ConversationContextSchema = z.object({
  knownFields: z.array(z.object({
    field: ConversationContextFieldSchema,
    value: z.string().trim().min(1).max(100),
  }).strict()).max(16),
  lastAskedField: ConversationFieldNameSchema.nullable(),
  failedAttempts: z.number().int().min(0).max(3),
  previousHelpTopic: z.enum(["PURPOSE", "SELECTION", "SERVICES"]).nullable().optional(),
}).strict();

export const InterpretationRequestSchema = z.object({
  schemaVersion: z.literal("2.0"),
  text: z.string().trim().min(1).max(1000),
  currentField: ConversationFieldNameSchema.nullable(),
  context: ConversationContextSchema.optional(),
}).strict();

export const InterpretationSchema = z.object({
  intent: z.enum(["PROVIDE", "CORRECT", "CREATE", "READ", "EVALUATE", "PRICE", "BOOKING", "HELP", "START_OVER"]),
  fields: z.array(z.object({ field: ConversationFieldNameSchema, value: z.string().trim().min(1).max(200) }).strict()).max(12),
  acknowledgment: z.string().trim().min(1).max(420).optional(),
}).strict();

export const InterpretationResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  interpretation: InterpretationSchema,
  mode: z.enum(["BEDROCK", "DETERMINISTIC"]),
  telemetry: z.object({ modelId: z.string(), region: z.string(), inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), latencyMs: z.number().nonnegative(), estimatedCostUsd: z.number().nonnegative().nullable() }).strict().nullable(),
}).strict();

export type InterpretationRequest = z.infer<typeof InterpretationRequestSchema>;
export type Interpretation = z.infer<typeof InterpretationSchema>;

export function isProductHelpQuestion(text: string): boolean {
  return /\b(?:para qu[eé] sirve|qu[eé] es cargomesh|c[oó]mo funciona|c[oó]mo (?:me )?ayuda|qu[eé] puedes hacer|escoger|elegir|comparar|servicios|qu[eé] ofrecen|what is cargomesh|what can you do|how (?:does it|can you) help|how does it work|choose|compare|services|what do you offer)\b/i.test(text);
}

export function helpTopic(text: string): "PURPOSE" | "SELECTION" | "SERVICES" {
  if (/\b(?:servicios|qu[eé] ofrecen|services|what do you offer)\b/i.test(text)) return "SERVICES";
  return /\b(?:escoger|elegir|comparar|choose|compare)\b/i.test(text) ? "SELECTION" : "PURPOSE";
}

export function isNoisyTranscript(text: string): boolean {
  return /\b(?:hello|hola)(?:[\s,]+(?:hello|hola)){2,}\b/i.test(text);
}

export function isHelpFollowUp(text: string): boolean {
  return /^(?:y eso|y entonces|por qu[eé]|expl[ií]came m[aá]s|tell me more|why|and how)$/i
    .test(text.trim().replace(/^[¿¡\s]+|[?.!\s]+$/g, ""));
}

export function productHelpFallback(text: string): string {
  const compare = /\b(?:escoger|elegir|comparar|choose|compare)\b/i.test(text);
  if (helpTopic(text) === "SERVICES") return "Today this chat can prepare a ROAD freight request and review preliminary ROAD eligibility with backend data; it cannot guarantee carrier coverage. SEA, RAIL and AIR are modeled for future work, not operational services here. What cargo and route do you have?";
  return compare
    ? "I can help you prepare a freight request and review preliminary ROAD eligibility. When carrier-authored offers exist, you can compare their evidence and terms; I cannot confirm a price or booking here. What cargo and route do you have in mind?"
    : "CargoMesh helps you prepare a freight request and review preliminary ROAD eligibility using authorized backend data. Tell me what you need to ship and where it should go; I will ask for missing details before you save a draft.";
}

/** A bounded, local fallback. It extracts only explicit statements and never infers domain facts. */
export function interpretDeterministically(input: InterpretationRequest): Interpretation {
  const text = input.text.trim();
  const lower = text.toLowerCase();
  if (isNoisyTranscript(text)) return { intent: "HELP", fields: [], acknowledgment: "I heard your voice, but the transcript is unclear. I can help you prepare a ROAD freight request. What would you like to ship?" };
  if (isProductHelpQuestion(text)) return { intent: "HELP", fields: [], acknowledgment: productHelpFallback(text) };
  if (input.context?.previousHelpTopic && isHelpFollowUp(text)) {
    return { intent: "HELP", fields: [], acknowledgment: productHelpFallback(input.context.previousHelpTopic === "SELECTION" ? "¿Cómo me ayuda a escoger?" : input.context.previousHelpTopic === "SERVICES" ? "¿Qué servicios ofrecen?" : "¿Para qué sirve CargoMesh?") };
  }
  if (/\b(price|quote|cost|rate|precio|cotizaci[oó]n|costo|tarifa)\b/.test(lower)) return { intent: "PRICE", fields: [] };
  if (/\b(book(?:ed|ing)?|reserv(?:e|ed|ation|ations|ar|a|as)|contratar)\b/.test(lower)) return { intent: "BOOKING", fields: [] };
  if (/^(start over|reset|new request|empezar de nuevo|reiniciar|nueva solicitud)$/i.test(text)) return { intent: "START_OVER", fields: [] };
  if (/^(help|what can you do|ayuda|qu[eé] puedes hacer)\??$/i.test(text)) return { intent: "HELP", fields: [], acknowledgment: productHelpFallback(text) };
  if (/\b(evaluate|eligib|road options|road result|check road|availability|available|evaluar|elegibilidad|opciones road|revisar road|disponibilidad|disponible)\b/.test(lower)) return { intent: "EVALUATE", fields: [] };
  if (/\b(read|show|retrieve|leer|mostrar|ver)\b.*\b(draft|request|borrador|solicitud)\b/.test(lower)) return { intent: "READ", fields: [] };
  if (/\b(create|save|submit|crear|guardar|enviar)\b.*\b(draft|request|borrador|solicitud)\b/.test(lower)) return { intent: "CREATE", fields: [] };
  const correcting = /^(?:correct|change|update|corregir|cambiar|actualizar)\b/i.test(text);
  if (correcting) {
    const correction = /^(?:correct|change|update)\s+(?:the\s+)?(pickup|origin|delivery|destination|cargo category|packaging|quantity|weight|volume|equipment)\s+(?:to|as)\s+(.+)$/i.exec(text);
    const fieldsByName = { pickup: "originFacilityId", origin: "originFacilityId", delivery: "destinationFacilityId", destination: "destinationFacilityId", "cargo category": "categoryCode", packaging: "packaging", quantity: "unitQuantity", weight: "unitWeightPerUnitKg", volume: "unitVolumePerUnitM3", equipment: "requiredEquipment" } as const;
    if (!correction) return { intent: "CORRECT", fields: [] };
    return { intent: "CORRECT", fields: [{ field: fieldsByName[correction[1].toLowerCase() as keyof typeof fieldsByName], value: correction[2].trim() }] };
  }
  const fields: Interpretation["fields"] = [];
  const route = /\b(?:from|de)\s+([^,]+?)\s+(?:to|a)\s+([^,]+?)(?:[,.]|$)/i.exec(text);
  if (route) {
    fields.push({ field: "originFacilityId", value: route[1].trim() });
    fields.push({ field: "destinationFacilityId", value: route[2].trim() });
  } else {
    const origin = /\b(?:from|pickup (?:in|at)|recojo (?:en|desde)|recoger (?:en|desde))\s+([^,.]+?)(?:[,.]|$)/i.exec(text);
    const destination = /\b(?:to|deliver (?:in|at)|entrega (?:en|a)|entregar (?:en|a))\s+([^,.]+?)(?:[,.]|$)/i.exec(text);
    if (origin) fields.push({ field: "originFacilityId", value: origin[1].trim() });
    if (destination) fields.push({ field: "destinationFacilityId", value: destination[1].trim() });
  }
  const count = /\b(\d+)\s+(units?|pallets?|boxes?|crates?|unidades?|palets?|pallets?|cajas?)\b/i.exec(text);
  if (count) {
    fields.push({ field: "unitQuantity", value: count[1] });
    const packaging = count[2].toLowerCase();
    if (packaging.startsWith("pallet")) fields.push({ field: "packaging", value: "PALLET" });
    if (packaging.startsWith("box") || packaging.startsWith("caja")) fields.push({ field: "packaging", value: "BOX" });
    if (packaging.startsWith("crate")) fields.push({ field: "packaging", value: "CRATE" });
  }
  const weight = /\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilograms?)\s*(?:each|per unit|per pallet|per box|cada|por unidad|por pallet|por caja)\b/i.exec(text);
  if (weight) fields.push({ field: "unitWeightPerUnitKg", value: weight[1] });
  const volume = /\b(\d+(?:[.,]\d+)?)\s*(?:m3|m³|cubic meters?|metros c[uú]bicos?)\s*(?:each|per unit|per pallet|per box|cada|por unidad|por pallet|por caja)\b/i.exec(text);
  if (volume) fields.push({ field: "unitVolumePerUnitM3", value: volume[1] });
  const dimensions = /\b(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*cm\b/i.exec(text);
  if (dimensions) fields.push({ field: "unitLengthCm", value: dimensions[1] }, { field: "unitWidthCm", value: dimensions[2] }, { field: "unitHeightCm", value: dimensions[3] });
  if (!fields.length && input.currentField) {
    const cleaned = text.replace(/^(?:i need|it is|it's|the (?:answer|value) is|please use|change (?:it )?to|necesito|es|la (?:respuesta|cantidad) es|usa|cambia(?:lo)? a)\s+/i, "").trim().replace(",", ".");
    const location = input.currentField === "originFacilityId" || input.currentField === "destinationFacilityId";
    const plausibleLocation = !/[¿?]/.test(cleaned) && cleaned.split(/\s+/).length <= 6
      && !/\b(?:hello|hola|how|what|why|can|could|tell|feel|help|c[oó]mo|qu[eé]|puedes|dime|ayuda)\b/i.test(cleaned);
    if (!location || plausibleLocation) fields.push({ field: input.currentField, value: cleaned });
  }
  return { intent: "PROVIDE", fields };
}
