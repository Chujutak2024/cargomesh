import { ConversationContextFieldSchema, type InterpretationRequest } from "@/features/v2-conversation-prep/interpretation";
import { CONVERSATION_FIELDS, type GuidedConversationField } from "./conversation-fields";
import type { V2IntakePrototypeDraft } from "./prototype-model";

/** Only validated, non-contact provisional fields are sent as interpretation hints. */
export function conversationContext(
  draft: V2IntakePrototypeDraft,
  lastAskedField: GuidedConversationField | null,
  failedAttempts: number,
): NonNullable<InterpretationRequest["context"]> {
  const knownFields = CONVERSATION_FIELDS.flatMap((field) => {
    if (!ConversationContextFieldSchema.safeParse(field).success) return [];
    const value = String(draft[field] ?? "").trim();
    return value && value.length <= 100 ? [{ field: field as (typeof ConversationContextFieldSchema.options)[number], value }] : [];
  });
  return { knownFields, lastAskedField, failedAttempts: Math.min(3, Math.max(0, failedAttempts)) };
}
