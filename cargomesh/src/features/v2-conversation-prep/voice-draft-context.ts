import { z } from "zod";
import { ConversationContextSchema, ConversationContextFieldSchema } from "./interpretation";
import { conversationContext } from "@/features/v2-intake/conversation-context";
import { CONVERSATION_FIELDS } from "@/features/v2-intake/conversation-fields";
import type { V2IntakePrototypeDraft } from "@/features/v2-intake/prototype-model";

/** Browser draft hints are provisional, never identity, consent or persisted facts. */
export const VoiceDraftContextSchema = z.object({
  knownFields: ConversationContextSchema.shape.knownFields,
  missingFields: z.array(ConversationContextFieldSchema).max(24),
  ambiguities: z.array(z.enum(["MEASUREMENT_SCOPE_PENDING","DATE_WINDOW_PENDING","CLASSIFICATION_PENDING"])).max(3).optional(),
  pendingMeasurement: z.object({
    values: z.tuple([z.number().finite().nonnegative().max(1_000_000),z.number().finite().nonnegative().max(1_000_000),z.number().finite().nonnegative().max(1_000_000)]),
    unit: z.enum(["m","cm"]).nullable(), scope: z.enum(["UNIT","SHIPMENT"]).nullable(),
  }).strict().nullable().optional(),
  timeZone:z.string().min(1).max(100).optional(),
  pendingDates:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(6).optional(),
  savedVersion: z.number().int().positive().nullable(),
}).strict();
export type VoiceDraftContext = z.infer<typeof VoiceDraftContextSchema>;

export function voiceDraftContext(draft: V2IntakePrototypeDraft, savedVersion: number | null, ambiguities: Array<"MEASUREMENT_SCOPE_PENDING"|"DATE_WINDOW_PENDING"|"CLASSIFICATION_PENDING"> = [], pendingMeasurement: VoiceDraftContext["pendingMeasurement"] = null, session:{timeZone:string;pendingDates:string[]} = {timeZone:"UTC",pendingDates:[]}): VoiceDraftContext {
  return VoiceDraftContextSchema.parse({
    knownFields: conversationContext(draft, null, 0).knownFields,
    missingFields: CONVERSATION_FIELDS.filter(field => ConversationContextFieldSchema.safeParse(field).success && !String(draft[field] ?? "").trim()),
    savedVersion,
    timeZone:session.timeZone,
    pendingDates:session.pendingDates,
    ambiguities,
    pendingMeasurement: VoiceDraftContextSchema.shape.pendingMeasurement.safeParse(pendingMeasurement).success ? pendingMeasurement : null,
  });
}
