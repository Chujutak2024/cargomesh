import type { IntakeOptionsData } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";
import { parseConversationField, type ConversationField } from "./conversation-fields";
import { spokenUserDetails, type VoiceTurn } from "@/features/v2-conversation-prep/voice-transcript";

export type SpokenRequestReview = {
  pickup: string;
  destination: string;
  cargo: string;
  weight: string;
  timing: string;
  handling: string[];
  fields: Array<{ field: ConversationField; value: string }>;
};

/** Only an explicit command in the open review may authorize a draft mutation. */
export function spokenReviewCommand(text: string): "apply" | "confirm" | "review" | "continue" | null {
  const normalized = text.trim().toLowerCase().replace(/[.!?]+$/g, "").replace(/[,]+/g, " ").replace(/\s+/g, " ");
  if (/^(?:cargomesh )?(?:revisa(?:r)? (?:el )?resumen|mu[eé]strame (?:el )?resumen|quiero revisar(?: el resumen)?|termin[eé]|finalizar|review (?:the )?(?:summary|request)|show (?:the )?summary|i am done)$/.test(normalized)) return "review";
  if (/^(?:cargomesh )?(?:quiero corregir|seguir (?:hablando|corrigiendo)|continuar por voz|continue by voice|keep editing)$/.test(normalized)) return "continue";
  if (/^(?:cargomesh )?(?:confirmo (?:crear|guardar) (?:el |mi )?borrador(?: corregido| actualizado)?|confirma(?:r)? y (?:crea(?:r)?|guarda(?:r)?) (?:el |mi )?borrador)$/.test(normalized)) return "confirm";
  if (/^(?:cargomesh )?apply (?:the )?(?:recognized|recognised) details(?: to (?:the |my )?draft)?$/.test(normalized)) return "apply";
  if (/^(?:cargomesh )?confirm and (?:create|save) (?:my |the )?draft(?: revision)?$/.test(normalized)) return "confirm";
  return null;
}

export function spokenTotalWeightKg(value: string): number | null {
  const number = /\b(\d[\d,.]*)\s*(?:kg|kilograms?|tons?|tonnes?)\b/i.exec(value);
  const multiplier = /\b(?:tons?|tonnes?)\b/i.test(value) ? 1000 : 1;
  if (number) {
    const parsed = Number(number[1].replaceAll(",", ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed * multiplier : null;
  }
  const words = /\b(?:(one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(thousand|hundred)\s*(?:kg|kilograms?|tons?|tonnes?)\b/i.exec(value);
  if (!words) return null;
  const digits: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const digit = digits[words[1]?.toLowerCase() ?? "one"] ?? 1;
  return digit * (words[2].toLowerCase() === "thousand" ? 1000 : 100) * multiplier;
}

export function spokenRouteConflictsWithDraft(review: SpokenRequestReview, options: IntakeOptionsData, draft: V2IntakePrototypeDraft): boolean {
  return ([[review.pickup, draft.originFacilityId], [review.destination, draft.destinationFacilityId]] as const)
    .some(([spoken, id]) => {
      if (!spoken || !id) return false;
      const facility = options.facilities.find((item) => item.facilityId === id);
      return Boolean(facility && !spoken.toLocaleLowerCase().includes(facility.city.toLocaleLowerCase()));
    });
}

function lastCapture(text: string, pattern: RegExp): string {
  return [...text.matchAll(pattern)].at(-1)?.[1]?.trim() ?? "";
}

function spokenClause(value: string): string {
  return value.split(/\s+(?=(?:i|we)\s+(?:like|want|need|have|am|would|got|can|will|should)\b|(?:and|but|then)\s+(?:i|we)\b)/i)[0].trim();
}

/** Speech supplies provisional facts. Only catalog-matched fields can enter the draft. */
export function buildSpokenRequestReview(turns: VoiceTurn[], options: IntakeOptionsData, draft: V2IntakePrototypeDraft): SpokenRequestReview {
  const text = spokenUserDetails(turns);
  const route = [...text.matchAll(/\b(?:from|desde|de)\s+([^;,.]+?)\s+(?:to|a|hasta|i (?:want|wanna|need) to go to)\s+([^;,.]+)/gi)].at(-1);
  const pickup = spokenClause(route?.[1]?.trim() ?? "")
    || lastCapture(text, /\b(?:pickup|origin)\s+(?:in|at|is)\s+([^;,.]+)/gi)
    || lastCapture(text, /\bhere\s+in\s+([^;,.]+?)(?=\s+(?:i|we|and|but|would|want|need)\b|[;,.]|$)/gi);
  const destination = spokenClause(route?.[2]?.trim() ?? "")
    || lastCapture(text, /\b(?:going|go|ship|send|deliver(?:ing)?)\s+to\s+([^;,.]+)/gi);
  const cargo = spokenClause(lastCapture(text, /\b(?:i(?:'m| am)\s+shipping|shipping|transporting|(?:i|we)\s+(?:like|want|need|would like)\s+to\s+(?:send|ship|transport))\s+([^;,.]+)/gi))
    || lastCapture(text, /\bin\s+(?:the\s+)?boxes\s+i\s+have\s+([^;,.]+?)(?=\s+(?:and|with|i need)\b|[;,.]|$)/gi)
    || lastCapture(text, /\b(?:boxes|pallets|crates)\s+of\s+([^;,.]+)/gi);
  const latestWeightTurn=[...turns].reverse().find(turn=>turn.speaker==="user"&&/\b(?:kg|kilograms?|kilogramos?|tons?|tonnes?|toneladas?)\b/i.test(turn.text))?.text??"";
  const weight = /\b(?:cada|por unidad|per unit|each)\b/i.test(latestWeightTurn)?"":lastCapture(latestWeightTurn, /\b((?:\d[\d,.]*|one|two|three|four|five|ten|hundred|thousand|a couple of)(?:\s+(?:hundred|thousand))?\s*(?:kg|kilograms?|tons?|tonnes?))\b/gi);
  const timing = lastCapture(text, /\b((?:in|within)(?:\s+at\s+least)?\s+(?:a\s+)?(?:couple of|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+(?:days?|weeks?|months?))\b/gi)
    || lastCapture(text, /\b((?:next|this)\s+(?:week|month|monday|tuesday|wednesday|thursday|friday))\b/gi);
  const handling = [
    /\bfragile\b/i.test(text) ? "Fragile handling" : "",
    /\bdry (?:environment|handling|storage)\b/i.test(text) ? "Dry environment" : "",
    /\btemperature[- ]controlled\b/i.test(text) ? "Temperature control" : "",
  ].filter(Boolean);
  const fields: SpokenRequestReview["fields"] = [];
  const matchFacility = (field: "originFacilityId" | "destinationFacilityId", spoken: string) => {
    const exact = parseConversationField(field, spoken, options);
    if (exact && draft[field] !== exact) fields.push({ field, value: exact });
  };
  if (pickup) matchFacility("originFacilityId", pickup);
  if (destination) matchFacility("destinationFacilityId", destination);
  if (cargo && draft.cargoDescription !== cargo) fields.push({ field: "cargoDescription", value: cargo.slice(0, 200) });
  if (/\bbox(?:es)?\b/i.test(text) && draft.packaging !== "BOX" && options.packagingOptions.some((item) => item.code === "BOX")) {
    fields.push({ field: "packaging", value: "BOX" });
  }
  if (handling.includes("Fragile handling") && !draft.requirements.includes("FRAGILE")
    && options.requirementOptions.some((item) => item.code === "FRAGILE")) fields.push({ field: "requirements", value: "FRAGILE" });
  return { pickup, destination, cargo, weight, timing, handling, fields };
}
