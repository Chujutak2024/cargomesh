import type { AvailabilityClass } from "@/features/providers/contracts";
import {
  BALANCED_WEIGHTS,
  type BalancedCandidateSnapshot,
  type BalancedDecisionEvaluation,
  type BalancedOfferInput,
  type BalancedSubscores,
  type ConfidenceComponents,
  type FreightRanking,
  isBalancedAvailabilityClass,
} from "./contracts";

const AVAILABILITY_SCORES: Record<AvailabilityClass, number> = {
  EXACT_CONFIRMED_SLOT: 100,
  AVAILABLE_IN_WINDOW: 90,
  LIMITED_WINDOW: 60,
  WAITLIST: 30,
  UNAVAILABLE: 0,
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function anomalyFor(offer: BalancedOfferInput) {
  if (offer.historicalAveragePrice === null || offer.historicalAveragePrice <= 0) {
    return { evaluable: false, deviationPct: null, detected: false };
  }

  const deviationPct = roundTo(
    ((offer.totalPrice - offer.historicalAveragePrice) / offer.historicalAveragePrice) * 100,
    4,
  );
  return { evaluable: true, deviationPct, detected: deviationPct > 30 };
}

function normalizedEligibility(offer: BalancedOfferInput) {
  const reasons = [...offer.ineligibilityReasons];
  if (offer.status !== "RECEIVED" && offer.status !== "ELIGIBLE") {
    reasons.push(`La oferta no puede evaluarse desde el estado ${offer.status}.`);
  }
  if (!Number.isFinite(offer.totalPrice) || offer.totalPrice <= 0) {
    reasons.push("La oferta no contiene un precio positivo.");
  }
  if (!Number.isFinite(offer.transitHours) || offer.transitHours <= 0) {
    reasons.push("La oferta no contiene un tránsito positivo.");
  }
  if (offer.currency !== "USD") reasons.push("La moneda no coincide con el contrato USD.");
  if (!isBalancedAvailabilityClass(offer.availabilityClass)) {
    reasons.push("La clase de disponibilidad no pertenece al contrato BALANCED.");
  }
  if (offer.availabilityClass === "UNAVAILABLE") {
    reasons.push("El provider declaró la capacidad como no disponible.");
  }

  return {
    eligible: offer.eligible && reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
  };
}

function scoreReasons(subscores: BalancedSubscores, rawScore: number): string[] {
  return [
    `Costo normalizado: ${roundTo(subscores.cost, 2)}/100.`,
    `Confiabilidad histórica: ${roundTo(subscores.reliability, 2)}/100.`,
    `ETA normalizado: ${roundTo(subscores.eta, 2)}/100.`,
    `Disponibilidad: ${roundTo(subscores.availability, 2)}/100.`,
    `Experiencia de ruta: ${roundTo(subscores.routeExperience, 2)}/100.`,
    `Historial con la organización: ${roundTo(subscores.organizationHistory, 2)}/100.`,
    `Score BALANCED sin redondear: ${roundTo(rawScore, 4)}.`,
  ];
}

export function evaluateBalancedOffers(
  orchestrationRunId: string,
  offers: BalancedOfferInput[],
): BalancedDecisionEvaluation {
  const eligibility = new Map(
    offers.map((offer) => [offer.offerId, normalizedEligibility(offer)] as const),
  );
  const eligibleOffers = offers.filter((offer) => eligibility.get(offer.offerId)?.eligible);
  const lowestPrice = eligibleOffers.length
    ? Math.min(...eligibleOffers.map((offer) => offer.totalPrice))
    : 0;
  const bestTransit = eligibleOffers.length
    ? Math.min(...eligibleOffers.map((offer) => offer.transitHours))
    : 0;

  const scored = eligibleOffers.map((offer) => {
    const subscores: BalancedSubscores = {
      cost: clamp((lowestPrice / offer.totalPrice) * 100),
      reliability: clamp(offer.reliabilityScore),
      eta: clamp((bestTransit / offer.transitHours) * 100),
      availability: isBalancedAvailabilityClass(offer.availabilityClass)
        ? AVAILABILITY_SCORES[offer.availabilityClass]
        : 0,
      routeExperience: clamp(offer.routeOperations),
      organizationHistory: clamp(offer.organizationHistoryScore),
    };
    const preciseRawScore =
      subscores.cost * BALANCED_WEIGHTS.cost +
        subscores.reliability * BALANCED_WEIGHTS.reliability +
        subscores.eta * BALANCED_WEIGHTS.eta +
        subscores.availability * BALANCED_WEIGHTS.availability +
        subscores.routeExperience * BALANCED_WEIGHTS.routeExperience +
        subscores.organizationHistory * BALANCED_WEIGHTS.organizationHistory;
    const rawScore = roundTo(preciseRawScore, 4);

    return { offer, subscores, preciseRawScore, rawScore, anomaly: anomalyFor(offer) };
  });

  scored.sort((left, right) => {
    if (right.preciseRawScore !== left.preciseRawScore) {
      return right.preciseRawScore - left.preciseRawScore;
    }
    if (right.offer.reliabilityScore !== left.offer.reliabilityScore) {
      return right.offer.reliabilityScore - left.offer.reliabilityScore;
    }
    if (left.offer.totalPrice !== right.offer.totalPrice) {
      return left.offer.totalPrice - right.offer.totalPrice;
    }
    if (left.offer.transitHours !== right.offer.transitHours) {
      return left.offer.transitHours - right.offer.transitHours;
    }
    return left.offer.carrierId.localeCompare(right.offer.carrierId);
  });

  const rankedOptions: FreightRanking["options"] = scored.map((candidate, index) => ({
    offerId: candidate.offer.offerId,
    rank: index + 1,
    rawScore: candidate.rawScore,
    roundedScore: Math.round(candidate.rawScore),
    eligible: true,
    reasons: scoreReasons(candidate.subscores, candidate.rawScore),
  }));

  const ineligibleOptions: FreightRanking["options"] = offers
    .filter((offer) => !eligibility.get(offer.offerId)?.eligible)
    .sort((left, right) => left.carrierId.localeCompare(right.carrierId))
    .map((offer) => ({
      offerId: offer.offerId,
      rank: 0,
      rawScore: 0,
      roundedScore: 0,
      eligible: false,
      reasons: eligibility.get(offer.offerId)?.reasons ?? ["Oferta inelegible."],
    }));

  const top = scored[0];
  const second = scored[1];
  const candidateSeparation = top && second
    ? clamp(((top.preciseRawScore - second.preciseRawScore) / 20) * 100)
    : 0;
  const historicalEvidence = top
    ? clamp(Math.min(100, top.offer.routeOperations) * (clamp(top.offer.reliabilityScore) / 100))
    : 0;
  const anomalySafety = top?.anomaly.evaluable && !top.anomaly.detected ? 100 : 0;
  const rawDecisionConfidence = top
    ? 100 * 0.25 +
      100 * 0.2 +
      historicalEvidence * 0.2 +
      candidateSeparation * 0.15 +
      anomalySafety * 0.2
    : 0;
  const confidenceComponents: ConfidenceComponents = {
    dataCompleteness: top ? 100 : 0,
    constraintCertainty: top ? 100 : 0,
    historicalEvidence: roundTo(historicalEvidence, 4),
    candidateSeparation: roundTo(candidateSeparation, 4),
    anomalySafety,
    rawDecisionConfidence: roundTo(rawDecisionConfidence, 4),
  };

  const ranking: FreightRanking = {
    orchestrationRunId,
    strategy: "BALANCED",
    recommendedOfferId: top?.offer.offerId ?? null,
    decisionConfidence: Math.round(rawDecisionConfidence),
    options: [...rankedOptions, ...ineligibleOptions],
  };

  const candidateSnapshot: BalancedCandidateSnapshot = {
    scoringVersion: "BALANCED_V1",
    weights: BALANCED_WEIGHTS,
    candidates: offers.map((offer) => {
      const scoredCandidate = scored.find((candidate) => candidate.offer.offerId === offer.offerId);
      const normalized = eligibility.get(offer.offerId)!;
      const anomaly = anomalyFor(offer);
      return {
        offerId: offer.offerId,
        carrierId: offer.carrierId,
        eligible: normalized.eligible,
        eligibilityReasons: normalized.reasons,
        rawValues: {
          price: offer.totalPrice,
          transitHours: offer.transitHours,
          reliabilityScore: offer.reliabilityScore,
          availabilityClass: offer.availabilityClass,
          routeOperations: offer.routeOperations,
          organizationHistoryScore: offer.organizationHistoryScore,
          historicalAveragePrice: offer.historicalAveragePrice,
        },
        subscores: scoredCandidate?.subscores ?? null,
        rawScore: scoredCandidate?.rawScore ?? 0,
        displayScore: scoredCandidate ? Math.round(scoredCandidate.rawScore) : 0,
        anomaly,
      };
    }),
  };

  return {
    ranking,
    runStatus: top ? "OPTIONS_READY" : "NO_MATCH",
    requiresReview:
      !top ||
      scored.length < 2 ||
      top.anomaly.detected ||
      ranking.decisionConfidence < 85,
    confidenceComponents,
    candidateSnapshot,
    subscores: Object.fromEntries(scored.map((candidate) => [candidate.offer.offerId, candidate.subscores])),
    anomalyEvidence: Object.fromEntries(
      offers.map((offer) => [offer.offerId, anomalyFor(offer)]),
    ),
  };
}

export function rankBalancedOffers(
  orchestrationRunId: string,
  offers: BalancedOfferInput[],
): FreightRanking {
  return evaluateBalancedOffers(orchestrationRunId, offers).ranking;
}
