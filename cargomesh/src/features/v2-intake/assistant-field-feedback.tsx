"use client";
import type { ComponentProps, ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { Input, Select, Textarea, Checkbox } from "@/components/ui";
import { useOptionalIntakeSession } from "./intake-session";
import type { DraftField } from "./use-assistant-change-feedback";
import styles from "./assistant-field-feedback.module.css";

type FieldTarget = DraftField | readonly DraftField[];
export function AssistantFieldFeedback({ field, children, className }: { field: FieldTarget; children: ReactNode; className?: string }) {
  const session = useOptionalIntakeSession();
  const fields: readonly DraftField[] = typeof field === "string" ? [field] : field;
  const change = session?.assistantChange;
  const updated = change && fields.some(key => change.fields.includes(key));
  return <div className={[styles.field, className].filter(Boolean).join(" ")} data-assistant-updated={updated ? "true" : undefined}>
    {children}
    {updated && <><span key={change.sequence} className={styles.glow} aria-hidden="true" /><span className={styles.badge} aria-hidden="true"><Check size={11} />{session?.t("Actualizado", "Updated")}</span></>}
  </div>;
}

export function FeedbackInput({ field, fieldClassName, feedbackEnabled = true, ...props }: ComponentProps<typeof Input> & { field: DraftField; feedbackEnabled?: boolean }) {
  return <AssistantFieldFeedback field={feedbackEnabled ? field : []} className={fieldClassName}><Input {...props} /></AssistantFieldFeedback>;
}
export function FeedbackSelect({ field, fieldClassName, feedbackEnabled = true, ...props }: ComponentProps<typeof Select> & { field: DraftField; feedbackEnabled?: boolean }) {
  return <AssistantFieldFeedback field={feedbackEnabled ? field : []} className={fieldClassName}><Select {...props} /></AssistantFieldFeedback>;
}
export function FeedbackTextarea({ field, fieldClassName, ...props }: ComponentProps<typeof Textarea> & { field: DraftField }) {
  return <AssistantFieldFeedback field={field} className={fieldClassName}><Textarea {...props} /></AssistantFieldFeedback>;
}
export function FeedbackCheckbox({ field, feedbackEnabled = true, ...props }: ComponentProps<typeof Checkbox> & { field: DraftField; feedbackEnabled?: boolean }) {
  return <AssistantFieldFeedback field={feedbackEnabled ? field : []}><Checkbox {...props} /></AssistantFieldFeedback>;
}

export function AssistantChangeNotice() {
  const session = useOptionalIntakeSession();
  const fields = session?.assistantChange?.fields ?? [];
  const groups = new Set<string>();
  if (session) for (const field of fields) {
    groups.add(field === "originFacilityId" ? session.t("origen", "origin")
      : field === "destinationFacilityId" ? session.t("destino", "destination")
      : field.includes("Contact") ? session.t("contactos", "contacts")
      : field.includes("Window") ? session.t("horarios", "schedule")
      : field === "requiredEquipment" ? session.t("equipo", "equipment")
      : session.t("carga", "cargo"));
  }
  return <div className={styles.noticeSlot} role="status" aria-live="polite" aria-atomic="true">
    {session && fields.length > 0 && <div className={styles.notice}><Sparkles size={14} aria-hidden="true" /><span><strong>{session.t("CargoMesh actualizó", "CargoMesh updated")}: {Array.from(groups).join(", ")}.</strong> {session.t("Cambios en tu borrador.", "Changes are in your draft.")}</span></div>}
  </div>;
}
