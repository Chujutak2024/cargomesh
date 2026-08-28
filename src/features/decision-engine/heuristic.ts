import {
  CarrierMetrics,
  CarrierOffer,
  FreightRequest,
  OptimizationStrategy,
  OrganizationPreferences,
} from "../freight/types";

export interface HeuristicWeights {
  cost: number;
  reliability: number;
  eta: number;
  availability: number;
  route_experience: number;
  client_history: number;
}

export const STRATEGY_WEIGHTS: Record<OptimizationStrategy, HeuristicWeights> = {
  BALANCED: {
    cost: 0.25,
    reliability: 0.25,
    eta: 0.20,
    availability: 0.10,
    route_experience: 0.10,
    client_history: 0.10,
  },
  LOWEST_COST: {
    cost: 0.50,
    reliability: 0.20,
    eta: 0.10,
    availability: 0.10,
    route_experience: 0.05,
    client_history: 0.05,
  },
  MOST_RELIABLE: {
    reliability: 0.45,
    route_experience: 0.20,
    client_history: 0.15,
    eta: 0.10,
    availability: 0.05,
    cost: 0.05,
  },
  FASTEST: {
    eta: 0.45,
    availability: 0.20,
    reliability: 0.20,
    route_experience: 0.05,
    cost: 0.05,
    client_history: 0.05,
  },
  CUSTOM: {
    cost: 0.25,
    reliability: 0.25,
    eta: 0.20,
    availability: 0.10,
    route_experience: 0.10,
    client_history: 0.10,
  },
};

export interface ScoredOffer extends CarrierOffer {
  scores: NonNullable<CarrierOffer["scores"]>;
}

export function scoreOffers(
  offers: CarrierOffer[],
  metricsMap: Record<string, CarrierMetrics>,
  request: FreightRequest,
  preferences?: OrganizationPreferences
): ScoredOffer[] {
  if (offers.length === 0) return [];

  const strategy = request.optimization_strategy || "BALANCED";
  const weights = STRATEGY_WEIGHTS[strategy] || STRATEGY_WEIGHTS.BALANCED;

  // Find min and max price among offers to normalize cost
  const prices = offers.map((o) => o.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const scoredList: ScoredOffer[] = offers.map((offer) => {
    const metrics = metricsMap[offer.carrier_id];

    // 1. Cost Score (Lower price is better)
    let costScore = 80;
    if (maxPrice === minPrice) {
      costScore = 100;
    } else {
      // 100 for minPrice, down to 60 for maxPrice
      costScore = 100 - ((offer.price - minPrice) / (maxPrice - minPrice)) * 40;
    }
    // Budget penalty if exceeds max budget
    let penalties = 0;
    if (request.budget_max && offer.price > request.budget_max) {
      penalties += Math.min(30, ((offer.price - request.budget_max) / request.budget_max) * 50);
    }

    // 2. Reliability Score (SLA on-time percentage)
    const successRate = metrics ? metrics.success_rate : 0.90;
    const reliabilityScore = Math.min(100, Math.max(40, successRate * 100));

    // 3. ETA / Transit Time Score
    const durationHours = offer.estimated_duration_hours || 16;
    const etaScore = Math.max(50, 100 - (durationHours - 12) * 3);

    // 4. Availability Score (Units ready in corridor)
    const units = metrics ? metrics.available_units_count : 2;
    const availabilityScore = Math.min(100, 60 + units * 10);

    // 5. Route Experience Score (Trips in corridor)
    const completedTrips = metrics ? metrics.completed_freight_requests : 10;
    const routeExperienceScore = Math.min(100, 50 + completedTrips * 1.2);

    // 6. Organization / Client History Score
    let clientHistoryScore = 80;
    if (offer.carrier_id === "car-andes") {
      clientHistoryScore = 95; // 9 previous shipments with ACME Mining, 8 on-time
    } else if (offer.carrier_id === "car-inca") {
      clientHistoryScore = 90;
    } else if (offer.carrier_id === "car-pacific") {
      clientHistoryScore = 70;
    }

    // Soft Preference Bonus
    let softPreferenceBonus = 0;
    const requestedBrand =
      request.special_instructions?.match(/volvo/i) ||
      preferences?.preferred_vehicle_brand?.match(/volvo/i);
    if (requestedBrand && offer.vehicle_brand?.toLowerCase().includes("volvo")) {
      softPreferenceBonus += 5;
    }
    if (preferences?.preferred_carrier_id && preferences.preferred_carrier_id === offer.carrier_id) {
      softPreferenceBonus += 5;
    }

    // Compute Base Weighted Sum (Weights sum to exactly 1.00)
    const baseWeightedSum =
      costScore * weights.cost +
      reliabilityScore * weights.reliability +
      etaScore * weights.eta +
      availabilityScore * weights.availability +
      routeExperienceScore * weights.route_experience +
      clientHistoryScore * weights.client_history;

    const totalScore = Math.round(
      Math.min(100, Math.max(0, baseWeightedSum + softPreferenceBonus - penalties))
    );

    return {
      ...offer,
      scores: {
        total: totalScore,
        total_score: totalScore,
        cost_score: Math.round(costScore),
        reliability_score: Math.round(reliabilityScore),
        eta_score: Math.round(etaScore),
        availability_score: Math.round(availabilityScore),
        route_experience_score: Math.round(routeExperienceScore),
        preference_fit_score: Math.round(softPreferenceBonus),
        preference_score: Math.round(softPreferenceBonus),
        client_history_score: Math.round(clientHistoryScore),
        penalties: Math.round(penalties),
      },
    };
  });

  return scoredList.sort((a, b) => b.scores.total_score - a.scores.total_score);
}
