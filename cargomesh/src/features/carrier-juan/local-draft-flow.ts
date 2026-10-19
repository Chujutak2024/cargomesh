import { canCompleteLocalStep, type LocalDraftEnvelope } from "./local-draft-model";

export const localDraftSteps = [
  { id: "origin", es: "Origen y destino", en: "Origin and destination" },
  { id: "route", es: "Ruta y camión", en: "Route and truck" },
  { id: "cargo", es: "Carga", en: "Cargo" },
  { id: "dates", es: "Fechas", en: "Dates" },
  { id: "review", es: "Revisión final", en: "Final review" },
] as const;

export function localDraftStepFromHash(hash: string, completedStep: number): number {
  const [, scope, step] = hash.match(/^#\/(request|desk)(?:\/([^/?#]+))?/) ?? [];
  const index = localDraftSteps.findIndex(item => item.id === step);
  return scope && index >= 0 ? index : Math.min(Math.max(completedStep, 0), 4);
}

export function localDraftStepHref(step: number): string {
  return `#/request/${localDraftSteps[Math.min(Math.max(step, 0), 4)].id}`;
}

export type LocalStepResult =
  | { ok: true; record: LocalDraftEnvelope; nextStep: number }
  | { ok: false; reason: "invalid" | "previous"; step: number };

/** Visiting a screen never verifies it. Only the checked prefix may advance. */
export function completeLocalDraftStep(record: LocalDraftEnvelope, step: number, now: string): LocalStepResult {
  if (!Number.isInteger(step) || step < 0 || step > 4)
    return { ok: false, reason: "invalid", step };
  if (step > record.draft.completedStep)
    return { ok: false, reason: "previous", step: record.draft.completedStep };
  // Recheck the earlier fields too: legacy progress alone cannot certify a draft.
  const invalidPrevious = Array.from({ length: step }, (_, index) => index)
    .find(index => !canCompleteLocalStep(record.draft, index));
  if (invalidPrevious !== undefined) return { ok: false, reason: "previous", step: invalidPrevious };
  if (!canCompleteLocalStep(record.draft, step)) return { ok: false, reason: "invalid", step };
  const completedStep = Math.max(record.draft.completedStep, step + 1);
  return { ok: true, nextStep: Math.min(step + 1, 4), record: {
    ...record, updatedAt: now,
    draft: { ...record.draft, completedStep, savedForReview: completedStep === 5 },
  } };
}
