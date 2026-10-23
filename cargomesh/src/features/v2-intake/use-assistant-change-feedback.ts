"use client";
import { useEffect, useRef, useState } from "react";
import type { V2IntakePrototypeDraft } from "./prototype-model";

export type DraftField = keyof V2IntakePrototypeDraft;
export type AssistantChange = { fields: DraftField[]; sequence: number };
export const ASSISTANT_FEEDBACK_MS = 4500;

/** Observe committed draft changes; merely recognizing or proposing a value is not success. */
export function useAssistantChangeFeedback(draft: V2IntakePrototypeDraft) {
  const [assistantChange, setAssistantChange] = useState<AssistantChange | null>(null);
  const [epoch, setEpoch] = useState(0);
  const previous = useRef(draft);
  const pending = useRef(new Set<DraftField>());
  const sequence = useRef(0);
  const trackAssistantFields = (fields: ReadonlyArray<{ field: DraftField }>) => {
    for (const { field } of fields) {
      pending.current.add(field);
      if (field === "packaging") pending.current.add("unitPackageType");
      if (["unitQuantity", "unitWeightPerUnitKg", "unitVolumePerUnitM3"].includes(field)) {
        pending.current.add("totalWeightKg"); pending.current.add("totalVolumeM3");
      }
    }
    if (fields.length) setEpoch(value => value + 1);
  };
  const clearAssistantChange = () => { pending.current.clear(); setAssistantChange(null); };
  useEffect(() => {
    const changed = (Object.keys(draft) as DraftField[]).filter(field =>
      JSON.stringify(previous.current[field]) !== JSON.stringify(draft[field]));
    previous.current = draft;
    const applied = changed.filter(field => pending.current.has(field));
    pending.current.clear();
    if (applied.length) setAssistantChange({ fields: applied, sequence: ++sequence.current });
    else if (changed.length) setAssistantChange(current => {
      if (!current || !current.fields.some(field => changed.includes(field))) return current;
      const fields = current.fields.filter(field => !changed.includes(field));
      return fields.length ? { ...current, fields } : null;
    });
  }, [draft, epoch]);
  useEffect(() => {
    if (!assistantChange) return;
    const id = setTimeout(() => setAssistantChange(current =>
      current?.sequence === assistantChange.sequence ? null : current), ASSISTANT_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [assistantChange?.sequence]);
  return { assistantChange, trackAssistantFields, clearAssistantChange };
}
