import { z } from "zod";

export const ConversationFieldNameSchema = z.enum([
  "originFacilityId", "destinationFacilityId", "categoryCode", "packaging", "cargoDescription",
  "unitQuantity", "unitWeightPerUnitKg", "unitVolumePerUnitM3", "unitLengthCm", "unitWidthCm",
  "unitHeightCm", "pickupWindowStartsAt", "pickupWindowEndsAt", "deliveryWindowStartsAt",
  "deliveryWindowEndsAt", "requiredEquipment", "pickupContactName", "pickupContactPhoneE164",
  "pickupContactEmail", "recipientContactName", "recipientContactPhoneE164", "recipientContactEmail",
]);

export const InterpretationRequestSchema = z.object({
  schemaVersion: z.literal("2.0"),
  text: z.string().trim().min(1).max(1000),
  currentField: ConversationFieldNameSchema.nullable(),
}).strict();

export const InterpretationSchema = z.object({
  intent: z.enum(["PROVIDE", "CORRECT", "CREATE", "READ", "EVALUATE", "PRICE", "BOOKING", "HELP", "START_OVER"]),
  fields: z.array(z.object({ field: ConversationFieldNameSchema, value: z.string().trim().min(1).max(200) }).strict()).max(12),
  acknowledgment: z.enum(["Got it.", "Thanks, I have that.", "Understood."]).optional(),
}).strict();

export const InterpretationResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  interpretation: InterpretationSchema,
  mode: z.enum(["BEDROCK", "DETERMINISTIC"]),
  telemetry: z.object({ modelId: z.string(), region: z.string(), inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), latencyMs: z.number().nonnegative(), estimatedCostUsd: z.number().nonnegative().nullable() }).strict().nullable(),
}).strict();

export type InterpretationRequest = z.infer<typeof InterpretationRequestSchema>;
export type Interpretation = z.infer<typeof InterpretationSchema>;

/** A bounded, local fallback. It extracts only explicit statements and never infers domain facts. */
export function interpretDeterministically(input: InterpretationRequest): Interpretation {
  const text = input.text.trim();
  const lower = text.toLowerCase();
  if (/\b(price|quote|cost|rate)\b/.test(lower)) return { intent: "PRICE", fields: [] };
  if (/\b(book|booking|reserve|reservation)\b/.test(lower)) return { intent: "BOOKING", fields: [] };
  if (/^(start over|reset|new request)$/i.test(text)) return { intent: "START_OVER", fields: [] };
  if (/^(help|what can you do)\??$/i.test(text)) return { intent: "HELP", fields: [] };
  if (/\b(evaluate|eligib|road options|road result|check road)\b/.test(lower)) return { intent: "EVALUATE", fields: [] };
  if (/\b(read|show|retrieve)\b.*\b(draft|request)\b/.test(lower)) return { intent: "READ", fields: [] };
  if (/\b(create|save|submit)\b.*\b(draft|request)\b/.test(lower)) return { intent: "CREATE", fields: [] };
  const correcting = /^(?:correct|change|update)\b/i.test(text);
  if (correcting) {
    const correction = /^(?:correct|change|update)\s+(?:the\s+)?(pickup|origin|delivery|destination|cargo category|packaging|quantity|weight|volume|equipment)\s+(?:to|as)\s+(.+)$/i.exec(text);
    const fieldsByName = { pickup: "originFacilityId", origin: "originFacilityId", delivery: "destinationFacilityId", destination: "destinationFacilityId", "cargo category": "categoryCode", packaging: "packaging", quantity: "unitQuantity", weight: "unitWeightPerUnitKg", volume: "unitVolumePerUnitM3", equipment: "requiredEquipment" } as const;
    if (!correction) return { intent: "CORRECT", fields: [] };
    return { intent: "CORRECT", fields: [{ field: fieldsByName[correction[1].toLowerCase() as keyof typeof fieldsByName], value: correction[2].trim() }] };
  }
  const fields: Interpretation["fields"] = [];
  const route = /\bfrom\s+([^,]+?)\s+to\s+([^,]+?)(?:[,.]|$)/i.exec(text);
  if (route) {
    fields.push({ field: "originFacilityId", value: route[1].trim() });
    fields.push({ field: "destinationFacilityId", value: route[2].trim() });
  } else {
    const origin = /\b(?:from|pickup (?:in|at))\s+([^,.]+?)(?:[,.]|$)/i.exec(text);
    const destination = /\b(?:to|deliver (?:in|at))\s+([^,.]+?)(?:[,.]|$)/i.exec(text);
    if (origin) fields.push({ field: "originFacilityId", value: origin[1].trim() });
    if (destination) fields.push({ field: "destinationFacilityId", value: destination[1].trim() });
  }
  const count = /\b(\d+)\s+(units?|pallets?|boxes?|crates?)\b/i.exec(text);
  if (count) {
    fields.push({ field: "unitQuantity", value: count[1] });
    const packaging = count[2].toLowerCase();
    if (packaging.startsWith("pallet")) fields.push({ field: "packaging", value: "PALLET" });
    if (packaging.startsWith("box")) fields.push({ field: "packaging", value: "BOX" });
    if (packaging.startsWith("crate")) fields.push({ field: "packaging", value: "CRATE" });
  }
  const weight = /\b(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)\s*(?:each|per unit|per pallet|per box)\b/i.exec(text);
  if (weight) fields.push({ field: "unitWeightPerUnitKg", value: weight[1] });
  const volume = /\b(\d+(?:\.\d+)?)\s*(?:m3|m³|cubic meters?)\s*(?:each|per unit|per pallet|per box)\b/i.exec(text);
  if (volume) fields.push({ field: "unitVolumePerUnitM3", value: volume[1] });
  const dimensions = /\b(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*cm\b/i.exec(text);
  if (dimensions) fields.push({ field: "unitLengthCm", value: dimensions[1] }, { field: "unitWidthCm", value: dimensions[2] }, { field: "unitHeightCm", value: dimensions[3] });
  if (!fields.length && input.currentField) {
    const cleaned = text.replace(/^(?:i need|it is|it's|the (?:answer|value) is|please use|change (?:it )?to)\s+/i, "").trim();
    fields.push({ field: input.currentField, value: cleaned });
  }
  return { intent: "PROVIDE", fields };
}
