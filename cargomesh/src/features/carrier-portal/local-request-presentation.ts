import type { LocalDraft } from "./local-draft-model";

/** Display references only. Storage keys, route IDs and recovery data stay stable. */
export function localRequestReference(id: string): string {
  if (id === "CM-LOCAL-01") return "SOL-0001";
  const match = /^CM-DEMO-(0[2-7])$/.exec(id);
  return match ? `SOL-${match[1].padStart(4, "0")}` : id;
}
export function localRequestState(draft: LocalDraft): "draft" | "review" | "ready" {
  return draft.savedForReview ? "ready" : draft.completedStep > 0 ? "review" : "draft";
}
export function localRequestStateLabel(draft: LocalDraft, locale: "es" | "en") {
  const state = localRequestState(draft);
  return state === "ready" ? locale === "es" ? "Revisada" : "Reviewed"
    : state === "review" ? locale === "es" ? "En revisión" : "In review"
      : locale === "es" ? "Pendiente de revisión" : "Awaiting review";
}
