import { sessionDate, type DateClarification } from "@/features/v2-intake/capture-clarification";
import { z } from "zod";
import {DispatchPreferencesSchema} from "@/shared/schemas/v2/dispatch";
import {draftDispatchPreferences} from "@/features/v2-intake/prototype-model";
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
  planningPreferences:DispatchPreferencesSchema.optional(),
  timeZone:z.string().min(1).max(100).optional(),
  pendingDates:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(6).optional(),
  cargoDescription: z.string().trim().min(1).max(200).optional(),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pendingWindow: z.object({ role:z.enum(["pickup","delivery"]).optional(), startTime:z.string().regex(/^\d{2}:\d{2}$/).optional(), endTime:z.string().regex(/^\d{2}:\d{2}$/).optional() }).strict().optional(),
  savedVersion: z.number().int().positive().nullable(),
}).strict();
export type VoiceDraftContext = z.infer<typeof VoiceDraftContextSchema>;

function voiceCargoDescription(draft: V2IntakePrototypeDraft) {
  const value = draft.cargoDescription.trim();
  const contacts = [draft.pickupContactName,draft.pickupContactPhoneE164,draft.pickupContactEmail,draft.recipientContactName,draft.recipientContactPhoneE164,draft.recipientContactEmail].filter(v => v.trim().length >= 3);
  return value && value.length <= 200 && !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?[\d ()-]{8,}/i.test(value) && !contacts.some(v => value.toLowerCase().includes(v.trim().toLowerCase())) ? value : undefined;
}

export function voiceDraftContext(draft: V2IntakePrototypeDraft, savedVersion: number | null, ambiguities: Array<"MEASUREMENT_SCOPE_PENDING"|"DATE_WINDOW_PENDING"|"CLASSIFICATION_PENDING"> = [], pendingMeasurement: VoiceDraftContext["pendingMeasurement"] = null, session:{timeZone:string;pendingDates:string[];pendingWindow?:DateClarification} = {timeZone:"UTC",pendingDates:[]}): VoiceDraftContext {
  let planningPreferences;try{planningPreferences=draftDispatchPreferences(draft);}catch{/* Partial dates remain pending until the user clarifies them. */}
  return VoiceDraftContextSchema.parse({
    ...(planningPreferences?{planningPreferences}:{}),
    knownFields: conversationContext(draft, null, 0).knownFields,
    missingFields: CONVERSATION_FIELDS.filter(field => ConversationContextFieldSchema.safeParse(field).success && !String(draft[field] ?? "").trim()),
    savedVersion,
    timeZone:session.timeZone,
    pendingDates:session.pendingDates,
    ...(voiceCargoDescription(draft)?{cargoDescription:voiceCargoDescription(draft)}:{}),
    referenceDate:sessionDate(Date.now(),session.timeZone),
    ...(session.pendingWindow ? {pendingWindow:{role:session.pendingWindow.role,startTime:session.pendingWindow.startTime,endTime:session.pendingWindow.endTime}} : {}),
    ambiguities,
    pendingMeasurement: VoiceDraftContextSchema.shape.pendingMeasurement.safeParse(pendingMeasurement).success ? pendingMeasurement : null,
  });
}
