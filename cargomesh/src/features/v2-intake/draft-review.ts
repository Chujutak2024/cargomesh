import type { V2IntakePrototypeDraft } from "./prototype-model";

export type DraftReview = {
  snapshot: string;
  expiresAt: number;
};

const REVIEW_LIFETIME_MS = 5 * 60 * 1000;

export function proposeDraftReview(draft: V2IntakePrototypeDraft, now = Date.now()): DraftReview {
  return { snapshot: JSON.stringify(draft), expiresAt: now + REVIEW_LIFETIME_MS };
}

export function canApproveDraftReview(review: DraftReview | null, draft: V2IntakePrototypeDraft, now = Date.now()): boolean {
  return review !== null && now < review.expiresAt && review.snapshot === JSON.stringify(draft);
}
