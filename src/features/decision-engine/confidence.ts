import { ScoredOffer } from "./heuristic";
import { OrganizationPreferences } from "../freight/types";

export interface ConfidenceEvaluation {
  confidenceScore: number; // 0 - 100
  canAutoBook: boolean;
  topScore: number;
  secondScore: number;
  scoreDelta: number;
  reason: string;
}

export function evaluateDecisionConfidence(
  rankedOffers: ScoredOffer[],
  preferences?: OrganizationPreferences,
  hasPriceAnomaly = false
): ConfidenceEvaluation {
  if (rankedOffers.length === 0) {
    return {
      confidenceScore: 0,
      canAutoBook: false,
      topScore: 0,
      secondScore: 0,
      scoreDelta: 0,
      reason: "No eligible carrier candidates found to evaluate.",
    };
  }

  const top = rankedOffers[0];
  const second = rankedOffers[1] || null;

  const topScore = top.scores.total_score;
  const secondScore = second ? second.scores.total_score : Math.max(0, topScore - 20);
  const scoreDelta = topScore - secondScore;

  // Base confidence formula: weighted blend of top score strength and separation margin
  // Margin bonus: +10 if top candidate clearly dominates by >= 5 points
  let baseConfidence = topScore * 0.7 + (scoreDelta >= 5 ? 25 : scoreDelta * 3);

  // High reliability boost
  if (top.scores.reliability_score >= 95) {
    baseConfidence += 5;
  }

  const finalConfidence = Math.min(99, Math.max(10, Math.round(baseConfidence)));
  const threshold = preferences?.confidence_threshold ?? 85;
  const autoBookingAllowedByOrg = preferences?.allow_auto_booking ?? true;

  if (hasPriceAnomaly) {
    return {
      confidenceScore: finalConfidence,
      canAutoBook: false,
      topScore,
      secondScore,
      scoreDelta,
      reason: `Human review required: Price anomaly detected on winning quote despite confidence score ${finalConfidence}%.`,
    };
  }

  if (!autoBookingAllowedByOrg) {
    return {
      confidenceScore: finalConfidence,
      canAutoBook: false,
      topScore,
      secondScore,
      scoreDelta,
      reason: "Organization policy mandates manual human confirmation for all bookings.",
    };
  }

  if (finalConfidence >= threshold) {
    return {
      confidenceScore: finalConfidence,
      canAutoBook: true,
      topScore,
      secondScore,
      scoreDelta,
      reason: `Confidence score (${finalConfidence}%) meets threshold (${threshold}%). Clear candidate superiority with +${scoreDelta} score delta.`,
    };
  }

  return {
    confidenceScore: finalConfidence,
    canAutoBook: false,
    topScore,
    secondScore,
    scoreDelta,
    reason: `Confidence score (${finalConfidence}%) is below organization threshold (${threshold}%). Top candidates are too close (delta: ${scoreDelta} pts).`,
  };
}

export const evaluateConfidence = evaluateDecisionConfidence;
