export type ConversationLanguage = "es" | "en";

/** Numeric answers and ambiguous short turns retain the session language. */
export function conversationLanguage(text: string, previous: ConversationLanguage): ConversationLanguage {
  if (/\b(?:in English|speak English|en ingl[eé]s)\b/i.test(text)) return "en";
  if (/\b(?:en espa[nñ]ol|speak Spanish|in Spanish)\b/i.test(text)) return "es";
  if (/[¿¡ñ]|\b(?:quiero|necesito|carga|mercanc[ií]a|vac[ií]os|cu[aá]nto|recoger|entregar|ay[uú]dame|contienen|cada uno|diez|espa[nñ]ol)\b/i.test(text)) return "es";
  return previous;
}
