"use client";
import type { ComponentProps, ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { Input, Select, Textarea, Checkbox } from "@/components/ui";
import { useOptionalIntakeSession } from "./intake-session";
import type { DraftField } from "./use-assistant-change-feedback";
import { assistantAppliedDetails, assistantFormProgress, assistantNextQuestion, intakeStepLabels } from "./assistant-form-guide";
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

export function AssistantChangeNotice({ chat = false }: { chat?: boolean }) {
  const session = useOptionalIntakeSession();
  if (!session) return null;
  const { draft, activeOptions, t, assistantChange } = session;
  const fields = assistantChange?.fields ?? [];
  const details = assistantAppliedDetails(draft, fields, activeOptions, t);
  const { sections, nextStep } = assistantFormProgress(draft, activeOptions);
  const labels = intakeStepLabels(t);
  return <aside className={`${styles.guide} ${chat ? styles.chatGuide : ""}`} aria-label={t("Guía de tu solicitud", "Your shipment guide")}>
    <div className={styles.guideHeading}><Sparkles size={15} aria-hidden="true" /><strong>{labels[nextStep - 1]}</strong><span>{sections.filter(s => !s.issues.length).length}/3</span></div>
    <div className={styles.guideSteps} aria-hidden="true">{labels.slice(0, 3).map((label, index) => <span key={label} data-complete={!sections[index].issues.length}>{label}</span>)}</div>
    <div className={styles.receiptSlot} role={chat ? undefined : "status"} aria-live={chat ? "off" : "polite"} aria-atomic="true">
      {details.length > 0 && <div key={assistantChange?.sequence} className={styles.receipt}>
        <strong><Check size={13} aria-hidden="true" />{t("Anotado en tu borrador", "Noted in your draft")}</strong>
        <dl>{details.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      </div>}
    </div>
    <p className={styles.nextQuestion}>{assistantNextQuestion(draft, t, activeOptions)}</p>
    {nextStep === 4 && <small>{t("No se guarda ni se envía automáticamente.", "Nothing is saved or sent automatically.")}</small>}
  </aside>;
}
