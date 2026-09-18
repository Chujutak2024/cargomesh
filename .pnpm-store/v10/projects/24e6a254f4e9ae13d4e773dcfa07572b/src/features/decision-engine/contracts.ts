import type { AvailabilityClass } from "@/features/providers/contracts";

export const BALANCED_AVAILABILITY_CLASSES = [
  "EXACT_CONFIRMED_SLOT",
  "AVAILABLE_IN_WINDOW",
  "LIMITED_WINDOW",
  "WAITLIST",
  "UNAVAILABLE",
] as const satisfies readonly AvailabilityClass[];

export function isBalancedAvailabilityClass(value: string): value is AvailabilityClass {
  return (BALANCED_AVAILABILITY_CLASSES as readonly string[]).includes(value);
}

export type CarrierOffer = {
  offerId: string;
  orchestrationRunId: string;
  carrierId: string;
  providerOfferReference: string;
  totalPrice: number;
  currency: "USD";
  transitHours: number;
  status: "RECEIVED" | "ELIGIBLE" | "INELIGIBLE";
};

export type FreightRanking = {
  orchestrationRunId: string;
  strategy: "BALANCED";
  recommendedOfferId: string | null;
  decisionConfidence: number;
  options: Array<{
    offerId: string;
    rank: number;
    rawScore: number;
    roundedScore: number;
    eligible: boolean;
    reasons: string[];
  }>;
};

export type BalancedOfferInput = CarrierOffer & {
  availabilityClass: AvailabilityClass;
  reliabilityScore: number;
  routeOperations: number;
  organizationHistoryScore: number;
  historicalAveragePrice: number | null;
  eligible: boolean;
  ineligibilityReasons: string[];
};

export type BalancedSubscores = {
  cost: number;
  reliability: number;
  eta: number;
  availability: number;
  routeExperience: number;
  organizationHistory: number;
};

export type ConfidenceComponents = {
  dataCompleteness: number;
  constraintCertainty: number;
  historicalEvidence: number;
  candidateSeparation: number;
  anomalySafety: number;
  rawDecisionConfidence: number;
};

export type BalancedCandidateSnapshot = {
  scoringVersion: "BALANCED_V1";
  weights: typeof BALANCED_WEIGHTS;
  candidates: Array<{
    offerId: string;
    carrierId: string;
    eligible: boolean;
    eligibilityReasons: string[];
    rawValues: {
      price: number;
      transitHours: number;
      reliabilityScore: number;
      availabilityClass: AvailabilityClass;
      routeOperations: number;
      organizationHistoryScore: number;
      historicalAveragePrice: number | null;
    };
    subscores: BalancedSubscores | null;
    rawScore: number;
    displayScore: number;
    anomaly: {
      evaluable: boolean;
      deviationPct: number | null;
      detected: boolean;
    };
  }>;
};

export type BalancedDecisionEvaluation = {
  ranking: FreightRanking;
  runStatus: "OPTIONS_READY" | "NO_MATCH";
  requiresReview: boolean;
  confidenceComponents: ConfidenceComponents;
  candidateSnapshot: BalancedCandidateSnapshot;
  subscores: Record<string, BalancedSubscores>;
  anomalyEvidence: Record<
    string,
    { evaluable: boolean; deviationPct: number | null; detected: boolean }
  >;
};

export const BALANCED_WEIGHTS = {
  cost: 0.25,
  reliability: 0.25,
  eta: 0.2,
  availability: 0.1,
  routeExperience: 0.1,
  organizationHistory: 0.1,
} as const;
