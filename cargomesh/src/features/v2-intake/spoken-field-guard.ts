import type { ConversationField, GuidedConversationField } from "./conversation-fields";
import type { VoiceTurn } from "@/features/v2-conversation-prep/voice-transcript";

export function lastSpokenQuestionField(turns: VoiceTurn[]): GuidedConversationField | null {
  const question = [...turns].reverse().find((turn) => turn.speaker === "assistant" && !turn.provisional)?.text ?? "";
  if (!question.includes("?")) return null;
  const rules: Array<[RegExp, GuidedConversationField]> = [
    [/\b(?:urgente|urgencia|urgent|urgency|priority|prioridad)\b/i,"urgency"],
    [/\b(?:liviana|mediana|pesada|light|medium|heavy)\b/i,"loadSize"],
    [/\b(?:pickup|collection|sender)\b.*\bemail\b/i, "pickupContactEmail"],
    [/\b(?:recipient|receiver|delivery)\b.*\bemail\b/i, "recipientContactEmail"],
    [/\b(?:pickup|collection|sender)\b.*\bphone\b/i, "pickupContactPhoneE164"],
    [/\b(?:recipient|receiver|delivery)\b.*\bphone\b/i, "recipientContactPhoneE164"],
    [/\b(?:pickup|collection|sender)\b.*\bcontact\b.*\bname\b/i, "pickupContactName"],
    [/\b(?:recipient|receiver|delivery)\b.*\b(?:contact|name)\b/i, "recipientContactName"],
    [/\b(?:how many|number of)\b.*\b(?:units?|boxes?|packages?|pallets?|crates?)\b/i, "unitQuantity"],
    [/\b(?:weight|weigh)\b.*\b(?:per|each)\b.*\b(?:unit|box|package|pallet|crate)\b/i, "unitWeightPerUnitKg"],
    [/\bvolume\b.*\b(?:per|each)\b/i, "unitVolumePerUnitM3"],
    [/\b(?:length|width|height|dimensions?)\b.*\b(?:cm|centimet|each|per)\b/i, "unitLengthCm"],
    [/\b(?:pickup|collection)\b.*\b(?:start|begin)\b/i, "pickupWindowStartsAt"],
    [/\b(?:pickup|collection)\b.*\b(?:end|until)\b/i, "pickupWindowEndsAt"],
    [/\bdelivery\b.*\b(?:start|begin)\b/i, "deliveryWindowStartsAt"],
    [/\bdelivery\b.*\b(?:end|until)\b/i, "deliveryWindowEndsAt"],
    [/\b(?:what|which)\b.*\b(?:truck|equipment)\b/i, "requiredEquipment"],
    [/\b(?:what|which)\b.*\b(?:cargo category|type of cargo)\b/i, "categoryCode"],
    [/\b(?:what|how)\b.*\b(?:packaged|packaging)\b/i, "packaging"],
    [/\b(?:what are you shipping|describe the cargo)\b/i, "cargoDescription"],
    [/\b(?:where)\b.*\b(?:picked up|pickup)\b/i, "originFacilityId"],
    [/\b(?:where)\b.*\b(?:delivered|destination)\b/i, "destinationFacilityId"],
  ];
  return rules.find(([pattern]) => pattern.test(question))?.[1] ?? null;
}

/** The voice model proposes data; the app accepts only values grounded in the latest turn. */
export function checkedSpokenField(field: ConversationField, parsed: string, utterance: string, turns: VoiceTurn[]): string | null {
  const spoken = utterance.trim();
  const promptedField = lastSpokenQuestionField(turns);
  const prompt = [...turns].reverse().find((turn) => turn.speaker === "assistant" && !turn.provisional)?.text ?? "";
  const asked = (pattern: RegExp) => pattern.test(prompt);
  if (field === "unitWeightPerUnitKg" && promptedField !== field && !/\b(?:per|each|every)\s+(?:unit|box|package|pallet|crate)\b|\b(?:unit|box|package|pallet|crate)\s+weighs\b/i.test(spoken)) return null;
  if (field === "unitQuantity" && ((promptedField !== field && !/\b(?:units?|boxes?|packages?|pallets?|crates?|cajas?|palets?)\b/i.test(spoken)) || /\b(?:kg|kilograms?|tons?|tonnes?)\b/i.test(spoken))) return null;
  if (field === "unitVolumePerUnitM3" && promptedField !== field && !/\b(?:m3|m³|cubic met(?:er|re)s?)\b/i.test(spoken)) return null;
  if (["unitLengthCm", "unitWidthCm", "unitHeightCm"].includes(field) && !/\b(?:cm|centimet(?:er|re)s?)\b/i.test(spoken)) return null;
  if (field.endsWith("At")) {
    if (!/\b\d{4}\b/.test(spoken) || !/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(spoken)) return null;
    const date = new Date(parsed);
    if (Number.isNaN(date.getTime())) return null;
    const part = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
  }
  if (field.endsWith("Email") && !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(spoken)) return null;
  if (field.endsWith("PhoneE164") && !/[+\d][\d\s()+-]{7,}/.test(spoken)) return null;
  if (field === "pickupContactName" && !/\b(?:pickup|collection|sender)\s+contact\b/i.test(spoken)
    && !asked(/\b(?:pickup|collection|sender)\s+contact(?:'s)?\s+name\b/i)) return null;
  if (field === "recipientContactName" && !/\b(?:recipient|delivery|receiver)\s+contact\b/i.test(spoken)
    && !asked(/\b(?:recipient|delivery|receiver)\s+(?:contact(?:'s)?\s+)?name\b/i)) return null;
  if (field === "cargoDescription" && !/\b(?:send|ship|shipping|transport|cargo|boxes? of|pallets? of)\b/i.test(spoken)
    && !asked(/\b(?:describe the cargo|what are you shipping|what.*inside)\b/i)) return null;
  return parsed;
}
