import type { IntakeOptionsData } from "./contracts";
import type { VoiceTurn } from "@/features/v2-conversation-prep/voice-transcript";
import { lastSpokenQuestionField } from "./spoken-field-guard";

/** A yes can choose one explicit non-hazardous catalog category, never authorize a mutation. */
export function spokenCategoryAcceptance(text: string, turns: VoiceTurn[], options: IntakeOptionsData) {
  if (!/^(?:yes(?:[ ,]+(?:that one(?: is good| is fine)?|please|that(?:'s| is) (?:good|fine|correct)))?|s[ií](?:[ ,]+(?:esa|esa est[aá] bien|correcto))?)[.!]?$/i.test(text.trim()) || lastSpokenQuestionField(turns) !== "categoryCode") return [];
  const question = [...turns].reverse().find(turn => turn.speaker === "assistant" && !turn.provisional)?.text.toLowerCase() || "";
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = options.cargoCategories.filter(item => [item.code.replace(/_/g, " "), item.labelEn, item.labelEs].some(label => new RegExp(`\\b${escape(label.toLowerCase())}\\b`, "i").test(question)));
  return candidates.length === 1 && candidates[0].code !== "CHEMICAL" ? [{ field: "categoryCode" as const, value: candidates[0].code }] : [];
}
