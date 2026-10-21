export type WorkflowChatIntent = "offers" | "bookings" | "executions" | "readiness";

/** Read-only workflow questions are resolved before freight-detail interpretation. */
export function workflowChatIntent(text: string): WorkflowChatIntent | null {
  if (/\b(?:qu[eé] (?:me )?falta|campos pendientes|est[aá] completa|what is missing|what's missing|readiness|missing fields)\b/i.test(text)) return "readiness";
  // Mixed capture questions must reach interpretation; a price keyword is not a read-only request.
  if (/\b(?:\d+|diez|ten)\s*(?:pallets?|palets?|cajas?|boxes?|kg|kilos?|toneladas?|tonnes?)\b/i.test(text)
    || /\b(?:from|desde)\s+.{1,60}\s+(?:to|hasta|a)\s+/i.test(text)) return null;
  if (/\b(?:offers?|quotes?|prices?|compare|cotizaciones?|ofertas?)\b/i.test(text)) return "offers";
  if (/\b(?:book(?:ed|ing|s)?|reserv(?:e|ed|ation|ations|ar|a|as)|confirmaci[oó]n)\b/i.test(text)) return "bookings";
  if (/\b(?:track|tracking|shipment status|execution|seguimiento|rastrear|estado del env[ií]o)\b/i.test(text)) return "executions";
  return null;
}
