export type WorkflowChatIntent = "offers" | "bookings" | "executions";

/** Read-only workflow questions are resolved before freight-detail interpretation. */
export function workflowChatIntent(text: string): WorkflowChatIntent | null {
  if (/\b(?:offers?|quotes?|prices?|compare|cotizaciones?|ofertas?)\b/i.test(text)) return "offers";
  if (/\b(?:book(?:ed|ing|s)?|reserv(?:e|ed|ation|ations|ar|a|as)|confirmaci[oó]n)\b/i.test(text)) return "bookings";
  if (/\b(?:track|tracking|shipment status|execution|seguimiento|rastrear|estado del env[ií]o)\b/i.test(text)) return "executions";
  return null;
}
