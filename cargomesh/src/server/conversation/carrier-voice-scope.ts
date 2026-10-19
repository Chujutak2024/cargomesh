import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";

/** Defense in depth: a signed voice grant must contain only the exact authorized row. */
export function carrierVoiceOpportunity(raw: unknown, carrierId: string, opportunityId: string) {
  const record = WorkflowRecordV2Schema.parse(raw);
  if (record.kind !== "opportunities" || record.id !== opportunityId || record.carrierId !== carrierId) {
    throw new Error("FORBIDDEN_VOICE_SCOPE");
  }
  return record;
}

export function voiceFact(value: unknown): string {
  return String(value ?? "unknown").replace(/[^\p{L}\p{N} .,\/()-]/gu, " ").slice(0, 100);
}
